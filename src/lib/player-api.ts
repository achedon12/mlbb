/**
 * Reading responses from the player statistics API.
 *
 * The service relays Moonton's "battle report". Its OpenAPI schema makes
 * almost everything optional: a field may be missing, be null or change type.
 * So nothing is taken as is. An unreadable entry is dropped rather than
 * breaking the page, and a missing number stays missing (null) instead of
 * becoming a misleading zero.
 *
 * Module with no server dependency and no site data: tests load it directly,
 * with sample responses.
 */
import { z } from "zod";

/** Hero as the service describes it: game ID, English name, image. */
export interface GameHero {
  hid: number;
  name: string;
  /** Image from Moonton's CDN, only if its host is allowed by the site. */
  image: string | null;
}

export interface StatsPlayer {
  matches: number;
  wins: number;
  /** Average rating out of 10: the service returns it multiplied by a hundred. */
  noteAverage: number | null;
  hoursGame: number | null;
  mvp: number | null;
  bestStreak: number | null;
  /** Seasons covered, from newest to oldest. */
  seasons: number[];
}

export interface FrequentHero {
  hero: GameHero;
  matches: number;
  wins: number;
  note: number | null;
}

export interface MatchSummary {
  /** Match ID, as a string: it exceeds number precision. */
  id: string;
  season: number | null;
  hero: GameHero;
  eliminations: number;
  deaths: number;
  assists: number;
  /** Lane reported by the service: 1 Exp, 2 Mid, 3 Roam, 4 Jungle, 5 Gold. */
  lane: number | null;
  note: number | null;
  mvp: boolean;
  /** null when the service does not give the outcome. */
  win: boolean | null;
  /** Timestamp, in seconds. */
  date: number | null;
}

/** One of the ten players of a match, in its details. */
export interface Participant {
  team: number | null;
  roleId: number | null;
  zoneId: number | null;
  hero: GameHero;
  eliminations: number;
  deaths: number;
  assists: number;
  win: boolean | null;
}

export interface Page<T> {
  entries: T[];
  /** Cursor of the next page, or null when there are no more. */
  next: string | null;
}

/** Match ID or pagination cursor: digits, nothing else. */
export const ID = /^\d{1,25}$/;

/**
 * JSON.parse, with large integers protected.
 *
 * Match IDs and cursors exceed 2^53: read as numbers, they lose their last
 * digits — 4132717739868068534 becomes 4132717739868068400 — and the cursor
 * sent back to the service no longer points to anything. They are turned into
 * strings before parsing.
 */
export function readJson(text: string): unknown {
  return JSON.parse(text.replace(/("(?:nextCursor|bid|last_cursor)"\s*:\s*)(-?\d{16,})(?=\s*[,}\]])/g, '$1"$2"'));
}

const item = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Object schema whose missing keys still reach their field schema, as null.
 * zod 3 ran a field's transform on an absent key; zod 4 skips it and leaves the
 * key undefined, which slips past the `!== null` checks below (an absent `ts`
 * came out of `timestamp` as an undefined date instead of null). Filling
 * absent keys keeps both versions alike.
 */
function itemLenient<T extends z.ZodRawShape>(shape: T) {
  const keys = Object.keys(shape);
  return z.preprocess((v) => {
    const o = item(v);
    return Object.fromEntries(keys.map((c) => [c, o[c] ?? null]));
  }, z.object(shape));
}

/** Lenient number: a numeric string is accepted, anything else becomes null. */
const numberOrNull = z.unknown().transform((v): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
});

/** Counter: non-negative integer, otherwise null. */
const nonNegativeInt = numberOrNull.transform((n) => (n !== null && Number.isInteger(n) && n >= 0 ? n : null));

const text = z.unknown().transform((v): string | null => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
});

/**
 * Hero sheet attached by the service (`hid_e`); if unreadable, it counts as absent.
 * Anything but an object counts as absent; an object gets its missing keys
 * filled like the entries above, so a missing `ix` stays a null image.
 */
const entity = z
  .preprocess(
    (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? v : null),
    itemLenient({ id: numberOrNull, n: text, ix: text }).nullable(),
  )
  .catch(null);

/** Image hosts accepted by the `next/image` configuration. */
const SAFE_IMAGE = /^https:\/\/(akmweb|akmpicture)\.youngjoygame\.com\/\S+$/;

function heroOf(hid: number | null, e: z.output<typeof entity>): GameHero | null {
  const id = hid ?? e?.id ?? null;
  if (id === null || !Number.isInteger(id) || id <= 0) return null;
  return { hid: id, name: e?.n ?? `#${id}`, image: e?.ix && SAFE_IMAGE.test(e.ix) ? e.ix : null };
}

/** Match outcome: 1 win, 0 loss, nothing else is interpreted. */
const issue = (v: number | null): boolean | null => (v === 1 ? true : v === 0 ? false : null);

/** Service rating, multiplied by a hundred: 1180 means 11.8. */
const note = (v: number | null): number | null => (v !== null && v > 0 ? v / 100 : null);

/** Timestamp in seconds; a timestamp in milliseconds is converted to seconds. */
const timestamp = (v: number | null): number | null =>
  v === null || v <= 0 ? null : v > 1e12 ? Math.floor(v / 1000) : v;

/** Reads an array entry by entry: an unreadable entry is dropped, not the list. */
function readList<S extends z.ZodTypeAny, R>(raw: unknown, schema: S, to: (e: z.output<S>) => R | null): R[] {
  if (!Array.isArray(raw)) return [];
  const output: R[] = [];
  for (const entry of raw) {
    const lu = schema.safeParse(entry);
    const value = lu.success ? to(lu.data) : null;
    if (value !== null) output.push(value);
  }
  return output;
}

/**
 * Cursor of the next page. The service stops when `hasNext` is false or the
 * cursor is empty — both happen, sometimes together, sometimes alone: a true
 * `hasNext` with an empty cursor leads nowhere.
 */
export function cursorNext(pageInfo: unknown): string | null {
  const p = item(pageInfo);
  if (p.hasNext === false) return null;
  const raw =
    typeof p.nextCursor === "number" && Number.isSafeInteger(p.nextCursor)
      ? String(p.nextCursor)
      : typeof p.nextCursor === "string"
        ? p.nextCursor.trim()
        : "";
  return ID.test(raw) ? raw : null;
}

/** Seasons, deduplicated, from newest to oldest. */
export function readSeasons(v: unknown): number[] {
  const list = Array.isArray(v) ? v : [];
  const valid = list.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 1000);
  return [...new Set(valid)].sort((a, b) => b - a);
}

/** Response of `/season`. */
export function seasonsOf(data: unknown): number[] {
  return readSeasons(item(data).sids);
}

const schemaStats = itemLenient({ wc: nonNegativeInt, tc: nonNegativeInt, as: numberOrNull, gt: numberOrNull, mvpc: nonNegativeInt, wsc: nonNegativeInt, sids: z.unknown() });

/** Response of `/stats`. */
export function readStats(data: unknown): StatsPlayer {
  const d = schemaStats.parse(item(data));
  const matches = d.tc ?? 0;
  return {
    matches,
    wins: Math.min(d.wc ?? 0, matches),
    noteAverage: note(d.as),
    hoursGame: d.gt !== null && d.gt >= 0 ? d.gt : null,
    mvp: d.mvpc,
    bestStreak: d.wsc,
    seasons: readSeasons(d.sids),
  };
}

const schemaFrequent = itemLenient({ hid: numberOrNull, tc: nonNegativeInt, wc: nonNegativeInt, bs: numberOrNull, hid_e: entity });

/** Response of `/heroes/frequent`: the season's heroes, with their matches and wins. */
export function readFrequentHeroes(data: unknown): Page<FrequentHero> {
  const d = item(data);
  const entries = readList(d.result, schemaFrequent, (e) => {
    const hero = heroOf(e.hid, e.hid_e);
    if (!hero || !e.tc) return null;
    return { hero, matches: e.tc, wins: Math.min(e.wc ?? 0, e.tc), note: note(e.bs) };
  });
  return { entries, next: cursorNext(d.pageInfo) };
}

const schemaMatch = itemLenient({
  sid: nonNegativeInt,
  bid: text,
  bid_s: text,
  hid: numberOrNull,
  k: nonNegativeInt,
  d: nonNegativeInt,
  a: nonNegativeInt,
  lid: nonNegativeInt,
  s: numberOrNull,
  mvp: numberOrNull,
  res: numberOrNull,
  ts: numberOrNull,
  hid_e: entity,
});

/** Response of `/matches`: one page of matches, from newest to oldest. */
export function readMatches(data: unknown): Page<MatchSummary> {
  const d = item(data);
  const entries = readList(d.result, schemaMatch, (e): MatchSummary | null => {
    // Text version first: the numeric version may have lost digits.
    const id = [e.bid_s, e.bid].find((v): v is string => v !== null && ID.test(v));
    const hero = heroOf(e.hid, e.hid_e);
    if (!id || !hero) return null;
    return {
      id,
      season: e.sid || null,
      hero,
      eliminations: e.k ?? 0,
      deaths: e.d ?? 0,
      assists: e.a ?? 0,
      lane: e.lid !== null && e.lid >= 1 && e.lid <= 5 ? e.lid : null,
      note: note(e.s),
      mvp: e.mvp === 1,
      win: issue(e.res),
      date: timestamp(e.ts),
    };
  });
  return { entries, next: cursorNext(d.pageInfo) };
}

const schemaParticipant = itemLenient({
  f: nonNegativeInt,
  hid: numberOrNull,
  rid: nonNegativeInt,
  zid: nonNegativeInt,
  k: nonNegativeInt,
  d: nonNegativeInt,
  a: nonNegativeInt,
  fw: numberOrNull,
  hid_e: entity,
});

/** Response of `/matches/{id}`: the match participants. */
export function readDetailMatch(data: unknown): Participant[] {
  return readList(item(data).result, schemaParticipant, (e) => {
    const hero = heroOf(e.hid, e.hid_e);
    if (!hero) return null;
    return {
      team: e.f,
      roleId: e.rid,
      zoneId: e.zid,
      hero,
      eliminations: e.k ?? 0,
      deaths: e.d ?? 0,
      assists: e.a ?? 0,
      win: issue(e.fw),
    };
  });
}
