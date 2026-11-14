import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { addressOf, limitByMinute } from "@/lib/push-server";
import { readCapped } from "@/lib/read-body";
import { site } from "@/lib/site";
import { canManage, guildChannels, type BotChannel, type BotRole } from "./client";
import { botConfig, type BotConfig } from "./config";
import { isSnowflake } from "./public";
import { openSession, SESSION_COOKIE, type DiscordSession } from "./session";

/**
 * Gate of the dashboard's mutating routes (`/api/discord/*`), called from the
 * site's own pages with the session cookie.
 *
 * SameSite=Lax already keeps the cookie off cross-site POSTs; the Origin
 * check makes it explicit: a mutating request must come from the site's
 * public origin (or, in development, from the address it was sent to). A
 * browser that sends `Sec-Fetch-Site` must also call it `same-origin`: a
 * sibling subdomain (same site, other origin) is refused too.
 */

const NO_STORE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export const refused = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });
export const answer = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

const MAX_BODY = 16 * 1024;
/** Per address: a settings save, a test post, a flush are a few a minute at most. */
const allowed = limitByMinute(30);

/** Pure: is this Origin the site's own? A missing Origin is refused on a mutation. */
export function originAllowed(origin: string | null, siteUrl: string, requestUrl: string, production: boolean): boolean {
  if (!origin) return false;
  let given: string;
  try {
    given = new URL(origin).origin;
  } catch {
    return false;
  }
  if (given === new URL(siteUrl).origin) return true;
  return !production && given === new URL(requestUrl).origin;
}

/**
 * Pure: may this state-changing request act on the session? Origin first
 * (required), then Sec-Fetch-Site when the browser sends it ("none" is a
 * typed address or a bookmark: never a mutation).
 */
export function sameOriginRequest(headers: Headers, siteUrl: string, requestUrl: string, production: boolean): boolean {
  if (!originAllowed(headers.get("origin"), siteUrl, requestUrl, production)) return false;
  const fetchSite = headers.get("sec-fetch-site");
  return fetchSite === null || fetchSite === "same-origin";
}

export const isSameOrigin = (request: Request) =>
  sameOriginRequest(request.headers, site.url, request.url, process.env.NODE_ENV === "production");

type Guarded<T> = { config: BotConfig; user: DiscordSession; body: T } | NextResponse;

export async function guardDashboard<S extends z.ZodType>(request: Request, schema: S | null): Promise<Guarded<z.infer<S>>> {
  const config = botConfig();
  if (!config) return refused(404, "not found");
  if (!isSameOrigin(request)) return refused(403, "origin refused");
  if (!allowed(addressOf(request))) return refused(429, "too many requests");
  const user = openSession(config, (await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return refused(401, "not signed in");
  if (!schema) return { config, user, body: undefined as z.infer<S> };

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return refused(415, "JSON expected");
  const raw = await readCapped(request, MAX_BODY);
  if (raw === null) return refused(413, "body too large");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return refused(400, "invalid JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return refused(400, "invalid request");
  return { config, user, body: parsed.data };
}

/**
 * Origin the site's own redirects point to: the public address in
 * production (the container sees itself as http://0.0.0.0:3001), the
 * address in use in development. Never a value from the query string.
 */
export function siteOrigin(request: Request): string {
  return process.env.NODE_ENV === "production" ? new URL(site.url).origin : new URL(request.url).origin;
}

export const redirectUri = (request: Request) => `${siteOrigin(request)}/api/discord/callback`;

/**
 * Authorization of one server's dashboard write, asked live to the bot on
 * this request: the id comes from the route's path and is the only id the
 * route then reads, checks and writes, so a body can never name another
 * server. A malformed id is refused before any call; a user without Manage
 * Server there gets 403; otherwise the channels and roles the bot reports
 * for that same server, to check the body's ids against.
 *
 * `BotUnavailable` propagates: the routes answer 503.
 */
export async function authorizeGuild(
  config: BotConfig,
  guildId: string,
  userId: string,
): Promise<{ channels: BotChannel[]; roles: BotRole[] } | NextResponse> {
  if (!isSnowflake(guildId)) return refused(400, "invalid server id");
  if (!(await canManage(config, guildId, userId))) return refused(403, "not allowed");
  return guildChannels(config, guildId);
}
