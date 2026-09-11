import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { profil } from "@/lib/mlbb-auth";
import { adresseDe, limiteurParMinute, memeSecret } from "@/lib/push-serveur";
import { jetonCourant } from "@/lib/session";
import { site } from "@/lib/site";
import { MAX_BODY_BYTES, isSameOrigin, type StoredBuild } from "./community-builds";
import { listBuilds } from "./community-builds-store";

/**
 * Request-side helpers of the community builds: who is asking, whether they
 * may, and the shape of refusals. Kept apart from the storage so its tests
 * need neither cookies nor the game's login service.
 */

// -- Identity --------------------------------------------------------------

export type Player = { status: "ok"; id: string; name: string } | { status: "none" } | { status: "unavailable" };

/**
 * Account id stored with builds and votes: a hash of the in-game id and
 * server, never the ids themselves. Stable, so a vote stays tied to its
 * account across sessions.
 */
export const accountId = (roleId: number, zoneId: number) =>
  createHash("sha256").update(`mlbb-builds:${zoneId}:${roleId}`).digest("hex").slice(0, 24);

/**
 * The session token only proves itself through the login service (its
 * signature is not ours to check): each token is confirmed once, then kept a
 * few minutes in memory under a hash of the token - never the token itself.
 */
const CONFIRMED = new Map<string, { until: number; player: Player }>();
const CONFIRMED_TTL_MS = 5 * 60_000;
const CONFIRMED_MAX = 1_000;

export async function currentPlayer(): Promise<Player> {
  const token = await jetonCourant();
  if (!token) return { status: "none" };
  const key = createHash("sha256").update(token).digest("base64url");
  const now = Date.now();
  const known = CONFIRMED.get(key);
  if (known && known.until > now) return known.player;

  const result = await profil(token);
  if (result.etat === "expire") return { status: "none" };
  if (result.etat !== "ok" || !result.donnees.roleId) return { status: "unavailable" };
  const player: Player = {
    status: "ok",
    id: accountId(result.donnees.roleId, result.donnees.zoneId),
    name: result.donnees.name.slice(0, 40) || "?",
  };
  if (CONFIRMED.size >= CONFIRMED_MAX) CONFIRMED.clear();
  CONFIRMED.set(key, { until: now + CONFIRMED_TTL_MS, player });
  return player;
}

/** Viewer id for read requests: null for visitors, and when the login service is down. */
export async function viewerId(): Promise<string | null> {
  const player = await currentPlayer().catch((): Player => ({ status: "unavailable" }));
  return player.status === "ok" ? player.id : null;
}

/** Viewer and request time, read once per request outside of rendering. */
export async function viewerAndTime(): Promise<{ viewer: string | null; now: number }> {
  return { viewer: await viewerId(), now: Date.now() };
}

/**
 * What a community page needs from the request: every stored build (null
 * when the storage cannot be read), the viewer, and the request time that
 * the week's votes are counted from.
 */
export async function readCommunity(): Promise<{ builds: StoredBuild[] | null; viewer: string | null; now: number }> {
  const [builds, context] = await Promise.all([listBuilds().catch(() => null), viewerAndTime()]);
  return { builds, ...context };
}

// -- Administration --------------------------------------------------------

/**
 * Administrator deletion: `Authorization: Bearer <BUILDS_ADMIN_TOKEN>`.
 * Without a token of at least 24 characters configured, nobody is admin.
 */
export function isAdmin(request: Request): boolean {
  const token = process.env.BUILDS_ADMIN_TOKEN?.trim() ?? "";
  if (token.length < 24) return false;
  const given = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  return given.length > 0 && memeSecret(given, token);
}

// -- Rate limits and responses ---------------------------------------------

/** Mutating requests per IP address and per minute. */
export const allowIp = limiteurParMinute(20);
/** Votes per account and per minute. */
export const allowVote = limiteurParMinute(30);
/** Publications per account and per minute (the daily cap is enforced by the storage). */
export const allowPublish = limiteurParMinute(3);

export const ipOf = adresseDe;

export const NO_STORE = { "Cache-Control": "private, no-store" };
export const refuse = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });

const PUBLIC_HOST = new URL(site.url).host;

/**
 * Common gate of the mutating routes: same origin, IP rate, and for bodies,
 * JSON under `MAX_BODY_BYTES`. Returns the parsed body, or the refusal.
 */
export async function guardMutation(request: Request, withBody: boolean): Promise<{ body: unknown } | NextResponse> {
  if (!isSameOrigin(request.headers, [PUBLIC_HOST])) return refuse(403, "origin refused");
  if (!allowIp(ipOf(request))) return refuse(429, "too many requests");
  if (!withBody) return { body: null };
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return refuse(415, "JSON expected");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return refuse(413, "body too large");
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return refuse(413, "body too large");
  try {
    return { body: JSON.parse(raw) as unknown };
  } catch {
    return refuse(400, "invalid JSON");
  }
}
