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
import { discordAccountId, discordDisplayName, resolveMember, type DiscordLink, type DiscordLogin, type Member } from "./identity";
import { discordLink, type Author } from "./store";

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
  /** Collection saves: debounced by the browser, so a few a minute at most while ticking. */
  collection: limitByMinute(20),
} as const;
export type LimitKind = keyof typeof accountLimits;

type Guarded<T> = { author: Author; body: T } | NextResponse;

/** Signed-in game account, or the refusal. */
async function playerOrRefusal(): Promise<Author | NextResponse> {
  const player: Player = await currentPlayer().catch((): Player => ({ status: "unavailable" }));
  if (player.status === "none") return refused(401, "sign in required");
  if (player.status !== "ok") return refused(503, "login service unavailable");
  return { id: player.id, name: player.name, provider: "game" };
}

/** The Discord login (the dashboard's sealed session cookie), or null; null too when the bot side is not configured. */
export async function currentDiscordLogin(): Promise<DiscordLogin> {
  const config = botConfig();
  if (!config) return null;
  const user = openSession(config, (await cookies()).get(SESSION_COOKIE)?.value);
  return user ? { id: user.id, name: user.name } : null;
}

/**
 * The community member behind this request, game account or Discord account
 * (see `resolveMember`). The Discord member's link is read from the database;
 * when that read fails, a Discord login alone counts as unavailable.
 */
export async function currentMember(now = Date.now()): Promise<Member> {
  const [game, discord] = await Promise.all([
    currentPlayer().catch((): Player => ({ status: "unavailable" })),
    currentDiscordLogin(),
  ]);
  let link: DiscordLink = null;
  if (discord && databaseConfigured()) {
    try {
      link = await discordLink(discordAccountId(discord.id));
    } catch (error) {
      await logError("community: discord link read failed", error);
      if (game.status !== "ok") return { status: "unavailable" };
      return resolveMember({ game, discord: null, link: null, now });
    }
  }
  return resolveMember({ game, discord, link, now });
}

/** Signed-in member, game account or Discord account, or the refusal. */
async function memberOrRefusal(): Promise<Author | NextResponse> {
  const member = await currentMember();
  if (member.status === "none") return refused(401, "sign in required");
  if (member.status === "discordTooNew") return refused(403, "discordTooNew");
  if (member.status === "banned") return refused(403, "banned");
  if (member.status !== "ok") return refused(503, "login service unavailable");
  return member.author;
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
 * Gate of the community's mutating routes: a game account or a Discord
 * account. `schema` null: no body (a DELETE).
 */
export function guardMember<S extends z.ZodType>(request: Request, kind: LimitKind, schema: S | null): Promise<Guarded<z.infer<S>>> {
  return guard(request, kind, schema, memberOrRefusal);
}

/** Gate of the routes tied to the game account itself (the collection): no Discord login. */
export function guardPlayer<S extends z.ZodType>(request: Request, kind: LimitKind, schema: S | null): Promise<Guarded<z.infer<S>>> {
  return guard(request, kind, schema, playerOrRefusal);
}

async function guard<S extends z.ZodType>(
  request: Request,
  kind: LimitKind,
  schema: S | null,
  who: () => Promise<Author | NextResponse>,
): Promise<Guarded<z.infer<S>>> {
  if (!databaseConfigured()) return refused(404, "not found");
  if (!isSameOrigin(request)) return refused(403, "origin refused");
  if (!byAddress(addressOf(request))) return refused(429, "too many requests");
  const author = await who();
  if (author instanceof NextResponse) return author;
  if (!accountLimits[kind](author.id)) return refused(429, "too many requests");
  if (!schema) return { author, body: undefined as z.infer<S> };
  const body = await readJsonBody(request, schema);
  if (body instanceof NextResponse) return body;
  return { author, body: body.data };
}

const linkRate = limitByMinute(3);

/**
 * Gate of the account link and of its undoing: both logins on this request,
 * the game one confirmed by the login service, the Discord one by its sealed
 * cookie. No body. The Discord account's age does not matter here: once
 * linked, it acts as the game account; once unlinked, `resolveMember` checks
 * it again on every request.
 */
export async function guardLink(request: Request): Promise<{ game: Author; discord: Author } | NextResponse> {
  if (!databaseConfigured()) return refused(404, "not found");
  if (!isSameOrigin(request)) return refused(403, "origin refused");
  if (!byAddress(addressOf(request))) return refused(429, "too many requests");
  const [game, discord] = await Promise.all([playerOrRefusal(), currentDiscordLogin()]);
  if (game instanceof NextResponse) return game;
  if (!discord) return refused(401, "sign in required");
  if (!linkRate(game.id)) return refused(429, "too many requests");
  const id = discordAccountId(discord.id);
  return { game, discord: { id, name: discordDisplayName(discord.name, id), provider: "discord" } };
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
  taken: 409,
  notLinked: 409,
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

/** Whether the forum offers the Discord login: the bot side (and its OAuth app) is configured. */
export const discordLoginEnabled = () => botConfig() !== null;
