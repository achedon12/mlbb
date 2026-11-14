import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { botConfig, isSuperAdmin } from "@/lib/bot/config";
import { isSameOrigin } from "@/lib/bot/dashboard-guard";
import { openSession, SESSION_COOKIE, type DiscordSession } from "@/lib/bot/session";
import { currentPlayer, type Player } from "@/lib/community-builds-server";
import { databaseConfigured } from "@/lib/db";
import { logError } from "@/lib/log";
import { addressOf, limitByMinute } from "@/lib/push-server";
import { readCapped } from "@/lib/read-body";
import { MAX_BODY_BYTES } from "./constants";
import type { Author } from "./store";

/**
 * Request side of the community routes: who is asking, may they, and the
 * shape of refusals. Order on every mutating route: database configured,
 * same origin (required, like the dashboard's routes), the address's rate,
 * the session, the account's rate, then the body (capped while it is read,
 * JSON, zod). Every answer is `no-store`.
 */

const NO_STORE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export const refused = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });
export const answer = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

/** Every mutating community request from one address, per minute. */
const byAddress = limitByMinute(40);

/** Per account and per minute, by kind of action. */
export const accountLimits = {
  thread: limitByMinute(2),
  reply: limitByMinute(6),
  edit: limitByMinute(10),
  vote: limitByMinute(30),
  report: limitByMinute(10),
  card: limitByMinute(6),
} as const;
export type LimitKind = keyof typeof accountLimits;

type Guarded<T> = { author: Author; body: T } | NextResponse;

/** Signed-in game account, or the refusal. */
async function authorOrRefusal(): Promise<Author | NextResponse> {
  const player: Player = await currentPlayer().catch((): Player => ({ status: "unavailable" }));
  if (player.status === "none") return refused(401, "sign in required");
  if (player.status !== "ok") return refused(503, "login service unavailable");
  return { id: player.id, name: player.name };
}

/** Body read under the cap, then JSON, then the schema. */
export async function readJsonBody<S extends z.ZodType>(request: Request, schema: S): Promise<{ data: z.infer<S> } | NextResponse> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return refused(415, "JSON expected");
  const raw = await readCapped(request, MAX_BODY_BYTES);
  if (raw === null) return refused(413, "body too large");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return refused(400, "invalid JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return refused(400, typeof field === "string" ? field : "invalid");
  }
  return { data: parsed.data };
}

/**
 * Gate of the players' mutating routes. `schema` null: no body (a DELETE).
 */
export async function guardPlayer<S extends z.ZodType>(request: Request, kind: LimitKind, schema: S | null): Promise<Guarded<z.infer<S>>> {
  if (!databaseConfigured()) return refused(404, "not found");
  if (!isSameOrigin(request)) return refused(403, "origin refused");
  if (!byAddress(addressOf(request))) return refused(429, "too many requests");
  const author = await authorOrRefusal();
  if (author instanceof NextResponse) return author;
  if (!accountLimits[kind](author.id)) return refused(429, "too many requests");
  if (!schema) return { author, body: undefined as z.infer<S> };
  const body = await readJsonBody(request, schema);
  if (body instanceof NextResponse) return body;
  return { author, body: body.data };
}

/**
 * HTTP status of a storage refusal; the `error` is the reason itself, which
 * the forms turn into a sentence.
 */
const STATUS: Record<string, number> = {
  unknown: 404,
  forbidden: 403,
  banned: 403,
  window: 403,
  own: 403,
  hidden: 403,
  locked: 409,
  duplicate: 409,
  day: 429,
  limit: 429,
  blocked: 422,
  spam: 422,
  links: 422,
  newAccountLinks: 422,
};

export const refusedFor = (reason: string) => refused(STATUS[reason] ?? 400, reason);

/**
 * The request time, for the pages: read once, outside of rendering (a
 * render must stay pure), and passed down to the dates and edit windows.
 */
export async function requestTime(): Promise<number> {
  return Date.now();
}

/** Storage failures answer 503, logged with the route's context. */
export async function storageFailed(what: string, error: unknown, context?: Record<string, unknown>): Promise<NextResponse> {
  await logError(`community: ${what} failed`, error, context);
  return refused(503, "storage unavailable");
}

// -- Moderators ------------------------------------------------------------

/**
 * The site's moderators are the bot's super admins: a Discord login (the
 * dashboard's sealed session cookie) whose id is listed in
 * BOT_SUPER_ADMIN_IDS, checked on every request.
 */
export async function currentModerator(): Promise<DiscordSession | null> {
  const config = botConfig();
  if (!config) return null;
  const user = openSession(config, (await cookies()).get(SESSION_COOKIE)?.value);
  return user && isSuperAdmin(config, user.id) ? user : null;
}

const moderatorRate = limitByMinute(60);

/** Gate of the moderation route: anyone but a moderator gets the same 404. */
export async function guardModerator<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ moderator: DiscordSession; body: z.infer<S> } | NextResponse> {
  if (!databaseConfigured()) return refused(404, "not found");
  if (!isSameOrigin(request)) return refused(403, "origin refused");
  if (!moderatorRate(addressOf(request))) return refused(429, "too many requests");
  const moderator = await currentModerator();
  if (!moderator) return refused(404, "not found");
  const body = await readJsonBody(request, schema);
  if (body instanceof NextResponse) return body;
  return { moderator, body: body.data };
}
