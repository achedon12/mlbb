/**
 * Game account login.
 *
 * Moonton exposes no API, but its official code-based login flow exists:
 * the game sends a four-digit code to the player's in-game mailbox, and
 * that code, valid for five minutes, proves account ownership.
 * A community API relays this flow and returns an access token.
 *
 * Everything goes through the server: the token is never exposed to the
 * browser, and no password is ever requested or transmitted.
 */
import { createHash } from "node:crypto";
import {
  ID,
  readDetailMatch,
  readFrequentHeroes,
  readJson,
  readMatches,
  readStats,
  seasonsOf,
  type FrequentHero,
  type Page,
  type Participant,
  type MatchSummary,
  type StatsPlayer,
} from "@/lib/player-api";
import { logError } from "@/lib/log";

const BASE = "https://arena.rone.dev/api/user";

/**
 * Moonton authentication subsystem.
 *
 * Separate from the battle report: this is the service that manages accounts,
 * and it stays online when match statistics are down. The token obtained
 * through the login flow is accepted there as is.
 */
const MOONTON = "https://sg-api.mobilelegends.com/base";
const X_ACTID = "2728785";
const X_APPID = "2713644";
const BROWSER =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const UA = "MLBBDex/1.0 (+https://mlbbdex.com)";

export interface Friend {
  name: string;
  /** Avatar path on the CDN, or null for the default avatar. */
  avatar: string | null;
}

export interface Profile {
  roleId: number;
  zoneId: number;
  name: string;
  level: number;
  rankCurrent: number;
  rankMax: number;
  country: string;
  avatar: string | null;
}

async function apiCall(path: string, options: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
}

/**
 * Requests a verification code in the player's in-game mailbox.
 * Does not reveal whether the account exists: an unknown ID fails just like
 * an unavailable service, with no exploitable difference.
 */
export async function sendCode(
  roleId: number,
  zoneId: number,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const response = await apiCall("/auth/send-vc", {
      method: "POST",
      body: JSON.stringify({ role_id: roleId, zone_id: zoneId }),
    });

    const data = (await response.json()) as { code?: number; message?: string };
    if (response.ok && data.code === 0) return { ok: true };

    // errorInvalidZoneId / null role: the input matches no account.
    // Reasons are catalogue keys: the form translates them.
    return { ok: false, reason: "loginForm.errors.unknown" };
  } catch (e) {
    void logError("sending the verification code", e);
    return { ok: false, reason: "loginForm.errors.unavailable" };
  }
}

/**
 * Exchanges the code for an access token.
 * The token is a JWT signed by the service, valid for several days.
 */
export async function connect(
  roleId: number,
  zoneId: number,
  code: number,
): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  try {
    const response = await apiCall("/auth/login", {
      method: "POST",
      body: JSON.stringify({ role_id: roleId, zone_id: zoneId, vc: code }),
    });

    const data = (await response.json()) as {
      code?: number;
      data?: { jwt?: string };
    };

    if (response.ok && data.code === 0 && data.data?.jwt) {
      return { ok: true, token: data.data.jwt };
    }
    return { ok: false, reason: "loginForm.errors.wrongCode" };
  } catch (e) {
    void logError("exchanging the code for a token", e);
    return { ok: false, reason: "loginForm.errors.unavailable" };
  }
}

/**
 * State of an authenticated response.
 *
 * Three cases are kept apart because they call for different reactions:
 * the session has expired (log out), the data exists, or the Moonton source
 * is temporarily down — which it signals with its own code, and which must
 * not look like a site outage.
 */
export type Result<T> =
  | { status: "ok"; data: T }
  | { status: "expired" }
  | { status: "unavailable" };

async function authenticated<T>(
  path: string,
  token: string,
  transform: (data: unknown) => T,
): Promise<Result<T>> {
  try {
    const response = await apiCall(path, { headers: { Authorization: `Bearer ${token}` } });

    if (response.status === 401) return { status: "expired" };
    if (!response.ok) return { status: "unavailable" };

    // Read as text: cursors and match IDs exceed number precision,
    // `readJson` keeps them as strings.
    const envelope = (readJson(await response.text()) ?? {}) as { code?: unknown; data?: unknown };
    // 10407: the relayed Moonton endpoint is temporarily out of service. Any
    // other non-zero code likewise means there is nothing usable.
    if ((typeof envelope.code === "number" && envelope.code !== 0) || envelope.data == null) {
      return { status: "unavailable" };
    }

    return { status: "ok", data: transform(envelope.data) };
  } catch (e) {
    void logError("authenticated call to the Moonton service", e);
    return { status: "unavailable" };
  }
}

/**
 * Short-lived cache of authenticated responses.
 *
 * A profile visit calls the service about fifteen times — seasons, heroes,
 * matches, then the details of the latest matches. Reloading the page or
 * paginating must not request everything again: each successful response is
 * kept a few minutes in server memory, under a key derived from the token —
 * never the token itself. Nothing is written to disk or shared between
 * players, and a failure is never kept. Two simultaneous calls to the same
 * path share the same request.
 */
const MEMORY = new Map<string, { end: number; value: Promise<Result<unknown>> }>();
const MEMORY_MAX = 500;

function remember<T>(
  token: string,
  path: string,
  seconds: number,
  call: () => Promise<Result<T>>,
): Promise<Result<T>> {
  const key = `${createHash("sha256").update(token).digest("base64url")}${path}`;
  const now = Date.now();
  const known = MEMORY.get(key);
  if (known && known.end > now) return known.value as Promise<Result<T>>;

  const value = call();
  MEMORY.delete(key);
  MEMORY.set(key, { end: now + seconds * 1000, value });
  void value.then((r) => {
    if (r.status !== "ok" && MEMORY.get(key)?.value === value) MEMORY.delete(key);
  });
  // Beyond the cap, the oldest entries are evicted first.
  for (const old of MEMORY.keys()) {
    if (MEMORY.size <= MEMORY_MAX) break;
    MEMORY.delete(old);
  }
  return value;
}

/** Basic profile: what stays reachable even when stats are down. */
export function profile(token: string): Promise<Result<Profile>> {
  return authenticated("/info?lang=en", token, (data) => {
    const d = data as Record<string, unknown>;
    return {
      roleId: Number(d.roleId),
      zoneId: Number(d.zoneId),
      name: String(d.name ?? ""),
      level: Number(d.level ?? 0),
      rankCurrent: Number(d.rank_level ?? 0),
      rankMax: Number(d.history_rank_level ?? 0),
      country: String(d.reg_country ?? ""),
      avatar: d.avatar ? String(d.avatar) : null,
    } satisfies Profile;
  });
}

/** Overall statistics, over the seasons the service has kept. Often down. */
export function statistics(token: string): Promise<Result<StatsPlayer>> {
  return remember(token, "/stats", 300, () => authenticated("/stats?lang=en", token, readStats));
}

/** Seasons in which the player has matches, from newest to oldest. */
export function seasons(token: string): Promise<Result<number[]>> {
  return remember(token, "/season", 3600, () => authenticated("/season?lang=en", token, seasonsOf));
}

const seasonValid = (s: number) => Number.isInteger(s) && s > 0 && s < 1000;

/** One page of the season's matches, from newest to oldest. */
export function pageMatches(
  token: string,
  season: number,
  cursor: string | null,
  limit = 20,
): Promise<Result<Page<MatchSummary>>> {
  if (!seasonValid(season) || (cursor !== null && !ID.test(cursor))) {
    return Promise.resolve({ status: "unavailable" });
  }
  const request = new URLSearchParams({ sid: String(season), limit: String(limit), lang: "en" });
  if (cursor) request.set("last_cursor", cursor);
  const path = `/matches?${request}`;
  return remember(token, path, 120, () => authenticated(path, token, readMatches));
}

/** Maximum matches read for the season trend: five pages of twenty. */
export const HISTORY_MAX = 100;
/** Maximum pages followed, in case the service returned fewer than twenty matches per page. */
const PAGES_HISTORY_MAX = 10;
/** Past this, the history stops at what has been read: the section must not keep users waiting. */
const HISTORY_BUDGET_MS = 8000;

/** The promise, or null if it did not settle in time. It keeps running without us: its response will land in the cache. */
function inDelay<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const delay = new Promise<null>((r) => {
    timer = setTimeout(() => r(null), ms);
  });
  return Promise.race([promise, delay]).finally(() => clearTimeout(timer));
}

/**
 * Recent matches of the season, pages chained, up to `max`.
 *
 * Each page's cursor comes from the previous one: pages cannot be requested
 * in parallel. They go through the same cache as the match list — the first
 * one is already read by the page, the next ones also serve the "older
 * matches" button. A time budget bounds the wait; a page missing along the
 * way stops reading at what has been gathered. `end` tells whether the start
 * of the season was reached.
 */
export async function historyMatches(
  token: string,
  season: number,
  max = HISTORY_MAX,
  budget = HISTORY_BUDGET_MS,
): Promise<Result<{ matches: MatchSummary[]; end: boolean }>> {
  if (!seasonValid(season)) return { status: "unavailable" };
  const start = Date.now();
  const views = new Set<string>();
  const matches: MatchSummary[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < PAGES_HISTORY_MAX && matches.length < max; page++) {
    const request = pageMatches(token, season, cursor);
    // The first page is awaited without a limit: without it, there is nothing to show.
    const r = page === 0 ? await request : await inDelay(request, budget - (Date.now() - start));
    if (r === null) break;
    if (r.status !== "ok") {
      if (r.status === "expired" || page === 0) return r;
      break;
    }
    for (const p of r.data.entries) {
      if (views.has(p.id)) continue;
      views.add(p.id);
      matches.push(p);
    }
    // A cursor that does not change would request the same page forever.
    if (!r.data.next || r.data.next === cursor) {
      return { status: "ok", data: { matches: matches.slice(0, max), end: matches.length <= max } };
    }
    cursor = r.data.next;
  }
  return { status: "ok", data: { matches: matches.slice(0, max), end: false } };
}

/** Maximum hero pages followed: far more than the number of heroes in the game. */
const MAX_HERO_PAGES = 5;
const HEROES_PER_PAGE = 30;

/**
 * All heroes played in the season, pages chained.
 *
 * Their sum gives the season summary, which the service does not provide
 * ready-made. If an intermediate page is missing, what was read is kept and
 * flagged: the summary is then a minimum, not a total.
 */
export async function seasonHeroes(
  token: string,
  season: number,
): Promise<Result<{ heroes: FrequentHero[]; full: boolean }>> {
  if (!seasonValid(season)) return { status: "unavailable" };
  const seen = new Set<number>();
  const heroes: FrequentHero[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_HERO_PAGES; page++) {
    const request = new URLSearchParams({ sid: String(season), limit: String(HEROES_PER_PAGE), lang: "en" });
    if (cursor) request.set("last_cursor", cursor);
    const path = `/heroes/frequent?${request}`;
    const r = await remember(token, path, 300, () => authenticated(path, token, readFrequentHeroes));

    if (r.status !== "ok") {
      if (r.status === "expired" || page === 0) return r;
      return { status: "ok", data: { heroes, full: false } };
    }
    for (const h of r.data.entries) {
      if (seen.has(h.hero.hid)) continue;
      seen.add(h.hero.hid);
      heroes.push(h);
    }
    // A cursor that does not change would request the same page forever.
    if (!r.data.next || r.data.next === cursor) {
      return { status: "ok", data: { heroes, full: true } };
    }
    cursor = r.data.next;
  }
  return { status: "ok", data: { heroes, full: false } };
}

/** Match details: its participants, teams included. A played match never changes. */
export function detailMatch(token: string, season: number, id: string): Promise<Result<Participant[]>> {
  if (!seasonValid(season) || !ID.test(id)) return Promise.resolve({ status: "unavailable" });
  const path = `/matches/${id}?sid=${season}&lang=en`;
  return remember(token, path, 6 * 3600, () => authenticated(path, token, readDetailMatch));
}

/**
 * Details of several matches, four calls at a time to spare the service.
 * A match whose details are missing is simply absent from the result;
 * an expired session stops everything.
 */
export async function detailsMatches(
  token: string,
  matches: { id: string; season: number }[],
): Promise<Result<Map<string, Participant[]>>> {
  const output = new Map<string, Participant[]>();
  const file = [...matches];
  let expire = false;

  const worker = async () => {
    for (let p = file.shift(); p && !expire; p = file.shift()) {
      const r = await detailMatch(token, p.season, p.id);
      if (r.status === "expired") expire = true;
      else if (r.status === "ok" && r.data.length > 0) output.set(p.id, r.data);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, file.length) }, worker));

  if (expire) return { status: "expired" };
  return output.size > 0 || matches.length === 0 ? { status: "ok", data: output } : { status: "unavailable" };
}

/**
 * The player's friend list.
 *
 * The battle report also exposes friends, but it is offline; this route, on
 * the authentication subsystem, returns names and avatars. IDs are hashed
 * there — so a friend cannot be linked to their profile, only displayed.
 */
export async function friends(token: string): Promise<Result<Friend[]>> {
  const { roleId, zoneId } = identity(token);
  try {
    const response = await fetch(`${MOONTON}/getFriendList`, {
      method: "POST",
      headers: {
        authorization: token,
        "x-token": token,
        "x-actid": X_ACTID,
        "x-appid": X_APPID,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: "https://www.mobilelegends.com",
        Referer: "https://www.mobilelegends.com/",
        "User-Agent": BROWSER,
      },
      body: new URLSearchParams({
        roleId: String(roleId),
        zoneId: String(zoneId),
      }).toString(),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (response.status === 401) return { status: "expired" };
    if (!response.ok) return { status: "unavailable" };

    const envelope = (await response.json()) as {
      code?: number;
      data?: Array<{ sName?: string; sFacePath?: string }>;
    };
    if (envelope.code !== 0 || !Array.isArray(envelope.data)) {
      return { status: "unavailable" };
    }

    const list = envelope.data.map((a) => ({
      name: String(a.sName ?? ""),
      avatar: a.sFacePath
        ? `https://akmpicture.youngjoygame.com/${a.sFacePath}`
        : null,
    }));
    return { status: "ok", data: list };
  } catch (e) {
    void logError("authenticated call to the Moonton service", e);
    return { status: "unavailable" };
  }
}

/** JWT payload (`Ext` claim), without signature verification. */
function load(token: string): Record<string, unknown> {
  try {
    const p = token.split(".")[1];
    return JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  } catch {
    return {};
  }
}

/** ID and server carried by the token. */
export function identity(token: string): { roleId: number; zoneId: number } {
  const ext = (load(token).Ext ?? {}) as Record<string, unknown>;
  return { roleId: Number(ext.roleId ?? 0), zoneId: Number(ext.zoneId ?? 0) };
}

/** Reads the JWT `exp` without verifying its signature — only the service knows it. */
export function expiration(token: string): number | null {
  const exp = load(token).exp;
  return typeof exp === "number" ? exp : null;
}
