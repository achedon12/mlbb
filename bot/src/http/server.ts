import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { z } from "zod";
import { isLocale, type Locale } from "../i18n/index.js";
import { log } from "../log.js";
import { ReplayGuard, SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from "../security/signing.js";
import { GREETING_KINDS, GREETING_MAX_LENGTH, roleMenu, SNOWFLAKE, type RoleMenu } from "../site/schemas.js";

/**
 * The bot's internal HTTP server, called by the site only.
 *
 * Bound to the internal docker network (BOT_HTTP_HOST), never published.
 * Every route but `/health` requires the HMAC signature of the request,
 * verified in constant time within ±300 s; mutating calls cannot be replayed.
 * Bodies are capped at 64 KB and each source address is rate limited, which
 * still holds if the secret leaked.
 */

export const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 10_000;

/**
 * A greeting test: the text being edited on the dashboard (saved or not),
 * shown with the dashboard user as the member and the server's name and
 * size as the site knows them.
 */
export interface GreetingTest {
  kind: (typeof GREETING_KINDS)[number];
  message: string | null;
  member: { id: string; username: string; avatar: string | null };
  guildName: string;
  memberCount: number;
}

/** What the routes do, implemented by the manager (and by fakes in tests). */
export interface InternalApi {
  ready(): boolean;
  manageableGuilds(userId: string): Promise<{ id: string; name: string; icon: string | null }[]>;
  isManageable(guildId: string, userId: string): Promise<boolean>;
  channels(guildId: string): Promise<{ channels: unknown[]; roles: unknown[] } | null>;
  /** Which roles this user may hand out (auto-roles), the member fetched live. */
  grantable(guildId: string, userId: string): Promise<{ member: boolean; roles: unknown[] } | null>;
  flush(): Promise<unknown>;
  /** The server's custom emojis (for the role menu pickers); null: server not here. */
  emojis(guildId: string): Promise<{ id: string; name: string; animated: boolean }[] | null>;
  /** The dashboard saved this server: its shard forgets the settings and role menus it cached. */
  refresh(guildId: string): Promise<void>;
  /** Posts a role menu's message, or edits the one already posted. */
  publishRoleMenu(guildId: string, locale: Locale, menu: RoleMenu): Promise<{ ok: boolean; messageId?: string; channelId?: string; error?: string }>;
  /** Deletes a deleted menu's message, in a channel of that server. */
  removeRoleMenu(guildId: string, channelId: string, messageId: string): Promise<{ ok: boolean }>;
  /** Without `greeting`, the announcement test post. */
  testPost(guildId: string, channelId: string, locale: Locale, greeting?: GreetingTest): Promise<{ ok: boolean; error?: string }>;
  stats(): Promise<unknown>;
}

export interface ServerOptions {
  secret: string | undefined;
  api: InternalApi;
  now?: () => number;
}

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

const target = {
  guildId: z.string().regex(SNOWFLAKE),
  channelId: z.string().regex(SNOWFLAKE),
  locale: z.string().optional(),
};
/** `kind` absent: the announcement test, as before greetings existed. */
const testPostBody = z.union([
  z.object({ ...target, kind: z.literal("announcement").optional() }).strict(),
  z
    .object({
      ...target,
      kind: z.enum(GREETING_KINDS),
      message: z.string().max(GREETING_MAX_LENGTH).nullable(),
      member: z.object({
        id: z.string().regex(SNOWFLAKE),
        username: z.string().min(1).max(64),
        // Discord's avatar hash: 32 hex digits, "a_" first when animated.
        avatar: z.string().regex(/^(a_)?[0-9a-f]{32}$/).nullable(),
      }),
      guildName: z.string().min(1).max(100),
      memberCount: z.number().int().min(0).max(100_000_000),
    })
    .strict(),
]);

const publishBody = z.object({ locale: z.string().optional(), menu: roleMenu }).strict();
const removeBody = z.object({ channelId: z.string().regex(SNOWFLAKE), messageId: z.string().regex(SNOWFLAKE) }).strict();

function parseBody<T>(body: string, schema: z.ZodType<T>): T {
  let json: unknown;
  try {
    json = JSON.parse(body || "{}");
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new HttpError(400, "invalid_body");
  return parsed.data;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] ?? 0);
    if (declared > MAX_BODY_BYTES) {
      reject(new HttpError(413, "body_too_large"));
      req.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, "body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(json);
}

const userParam = (url: URL) => {
  const user = url.searchParams.get("user");
  if (!user || !SNOWFLAKE.test(user)) throw new HttpError(400, "invalid_user");
  return user;
};

/** A secret shorter than this is treated as unset (the config refuses it too). */
export const MIN_SECRET_LENGTH = 32;

export function createInternalServer({ secret: given, api, now = Date.now }: ServerOptions): Server {
  const secret = given && given.length >= MIN_SECRET_LENGTH ? given : undefined;
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const replay = new ReplayGuard();

  const rateLimited = (ip: string): boolean => {
    const t = now();
    const bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt <= t) {
      if (buckets.size > 1000) for (const [k, v] of buckets) if (v.resetAt <= t) buckets.delete(k);
      buckets.set(ip, { count: 1, resetAt: t + RATE_LIMIT_WINDOW_MS });
      return false;
    }
    bucket.count += 1;
    return bucket.count > RATE_LIMIT_MAX;
  };

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    const rawPath = req.url ?? "/";
    const url = new URL(rawPath, "http://bot.internal");

    if (method === "GET" && url.pathname === "/health") {
      // Unsigned, for the container healthcheck: says nothing but up or starting.
      const ready = api.ready();
      return send(res, ready ? 200 : 503, { status: ready ? "ok" : "starting" });
    }

    if (rateLimited(req.socket.remoteAddress ?? "unknown")) throw new HttpError(429, "rate_limited");
    if (!url.pathname.startsWith("/internal/")) throw new HttpError(404, "not_found");
    if (!secret) throw new HttpError(503, "not_configured");

    const body = method === "POST" ? await readBody(req) : "";
    const header = (name: string) => {
      const v = req.headers[name];
      return Array.isArray(v) ? v[0] : v;
    };
    const signature = header(SIGNATURE_HEADER);
    const check = verify({ secret, timestamp: header(TIMESTAMP_HEADER), signature, method, path: rawPath, body, now: now() });
    if (!check.ok) {
      log.warn("internal request refused", { reason: check.reason, path: url.pathname });
      throw new HttpError(401, "unauthorized");
    }
    if (method === "POST" && !replay.accept(signature!, now())) {
      log.warn("internal request refused", { reason: "replay", path: url.pathname });
      throw new HttpError(401, "unauthorized");
    }

    const parts = url.pathname.split("/").filter(Boolean); // ["internal", ...]
    const [, first, second, third, fourth] = parts;

    if (method === "GET" && first === "guilds" && second === "manageable" && parts.length === 3) {
      return send(res, 200, { guilds: await api.manageableGuilds(userParam(url)) });
    }
    if (method === "GET" && first === "guilds" && second && SNOWFLAKE.test(second) && parts.length === 4) {
      if (third === "manageable") return send(res, 200, { manageable: await api.isManageable(second, userParam(url)) });
      if (third === "channels") {
        const result = await api.channels(second);
        return result ? send(res, 200, result) : send(res, 404, { error: "unknown_guild" });
      }
      if (third === "can-assign") {
        const result = await api.grantable(second, userParam(url));
        return result ? send(res, 200, result) : send(res, 404, { error: "unknown_guild" });
      }
      if (third === "emojis") {
        const emojis = await api.emojis(second);
        return emojis ? send(res, 200, { emojis }) : send(res, 404, { error: "unknown_guild" });
      }
    }
    if (method === "POST" && first === "guilds" && second && SNOWFLAKE.test(second)) {
      if (third === "refresh" && parts.length === 4) {
        await api.refresh(second);
        return send(res, 202, { accepted: true });
      }
      if (third === "role-menus" && fourth === "publish" && parts.length === 5) {
        const { locale, menu } = parseBody(body, publishBody);
        return send(res, 200, await api.publishRoleMenu(second, isLocale(locale) ? locale : "en", menu));
      }
      if (third === "role-menus" && fourth === "remove" && parts.length === 5) {
        const { channelId, messageId } = parseBody(body, removeBody);
        return send(res, 200, await api.removeRoleMenu(second, channelId, messageId));
      }
    }
    if (method === "POST" && first === "announcements" && second === "flush" && parts.length === 3) {
      // Answer at once: the site does not wait for a whole delivery round.
      void api.flush();
      return send(res, 202, { accepted: true });
    }
    if (method === "POST" && first === "test-post" && parts.length === 2) {
      let json: unknown;
      try {
        json = JSON.parse(body || "{}");
      } catch {
        throw new HttpError(400, "invalid_json");
      }
      const parsed = testPostBody.safeParse(json);
      if (!parsed.success) throw new HttpError(400, "invalid_body");
      const { guildId, channelId, locale: given, ...rest } = parsed.data;
      const locale = isLocale(given) ? given : "en";
      const greeting = "member" in rest ? rest : undefined;
      return send(res, 200, await api.testPost(guildId, channelId, locale, greeting));
    }
    if (method === "GET" && first === "stats" && parts.length === 2) {
      return send(res, 200, await api.stats());
    }
    throw new HttpError(404, "not_found");
  }

  const server = createServer((req, res) => {
    route(req, res).catch((error: unknown) => {
      if (error instanceof HttpError) return send(res, error.status, { error: error.code });
      log.error("internal route failed", { path: (req.url ?? "").split("?")[0], error });
      send(res, 500, { error: "internal_error" });
    });
  });
  // A client that trickles its headers or body is cut off quickly.
  server.headersTimeout = 5_000;
  server.requestTimeout = 10_000;
  return server;
}
