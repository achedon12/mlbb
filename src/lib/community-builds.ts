import { encodeBuild, validateBuild, type BuildCode, type CodeCatalog } from "./build-code";

/**
 * Community builds: rules shared by the API routes, the storage and the
 * pages. Pure functions, no I/O: the tests drive them with hand-made builds.
 *
 * User text is plain text only. It is cleaned here (control and bidi
 * characters removed, whitespace normalised), links are refused outright,
 * and it is only ever rendered through React's escaping - never as HTML.
 */

export const TITLE_MIN = 3;
export const TITLE_MAX = 80;
export const NOTES_MAX = 600;
/** Votes a build page needs before search engines may index it. */
export const INDEX_THRESHOLD = 5;
export const WEEK_MS = 7 * 24 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
/** Largest request body accepted by the mutating routes, in bytes. */
export const MAX_BODY_BYTES = 4096;

export const LIMITS = {
  /** Builds one account may publish in 24 hours. */
  perAccountPerDay: 10,
  /** Builds one account may keep at once. */
  perAccountTotal: 50,
  /** Builds the whole store may hold: past this, publishing stops until some are deleted. */
  totalBuilds: 20_000,
} as const;

/** Build ids: 9 random bytes in base64url. */
export const BUILD_ID = /^[A-Za-z0-9_-]{12}$/;

export interface Vote {
  /** Voter account id (hash, never the in-game id). */
  voter: string;
  /** Epoch milliseconds. */
  at: number;
}

export interface StoredBuild {
  id: string;
  title: string;
  notes: string;
  build: BuildCode & { hero: string };
  author: { id: string; name: string };
  /** ISO date. */
  createdAt: string;
  votes: Vote[];
}

/** What the API and the pages show: no voter ids, no author id. */
export interface PublicBuild {
  id: string;
  hero: string;
  title: string;
  notes: string;
  authorName: string;
  createdAt: string;
  votes: number;
  weekVotes: number;
  /** The viewer has voted for it. */
  voted: boolean;
  /** The viewer wrote it. */
  own: boolean;
  build: BuildCode;
  /** Simulator query string (`src/lib/build-code.ts`). */
  code: string;
}

export const weekVotes = (b: StoredBuild, now: number) => b.votes.filter((v) => now - v.at < WEEK_MS).length;

export function toPublic(b: StoredBuild, viewer: string | null, now: number): PublicBuild {
  return {
    id: b.id,
    hero: b.build.hero,
    title: b.title,
    notes: b.notes,
    authorName: b.author.name,
    createdAt: b.createdAt,
    votes: b.votes.length,
    weekVotes: weekVotes(b, now),
    voted: viewer !== null && b.votes.some((v) => v.voter === viewer),
    own: viewer !== null && b.author.id === viewer,
    build: b.build,
    code: encodeBuild(b.build),
  };
}

// -- Text ------------------------------------------------------------------

/** C0/C1 controls (tab and newline aside), bidi overrides and zero-width characters. */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

/**
 * Plain text as it will be stored: Unicode NFC, invisible characters out, a
 * title on one line, notes with at most one blank line in a row.
 */
export function cleanText(raw: string, multiline: boolean): string {
  const text = raw.normalize("NFC").replace(INVISIBLE, "").replace(/\r\n?/g, "\n");
  if (!multiline) return text.replace(/\s+/g, " ").trim();
  return text
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Length as a reader counts it: by code point, so an emoji counts as one. */
export const textLength = (s: string) => [...s].length;

const LINK_PATTERNS = [
  /\b(?:https?|ftp):\/\//i,
  /\bwww\s*\./i,
  // Bare or disguised domains: "site.com", "site . com", "site[.]com", "site dot com".
  /\b[a-z0-9-]{2,}\s*(?:\.|\[\.\]|\(\.\)|\s+dot\s+)\s*(?:com|net|org|io|gg|co|me|ly|xyz|app|dev|info|biz|ru|cn|tk|to|tv|link|site|online|shop|store|top|club|live|fun|id|ph|my|sg|in|br|fr|es|it|de|uk|us)\b/i,
];

/** Titles and notes carry no links: no URL, no "www.", no domain name. */
export const hasLink = (text: string) => LINK_PATTERNS.some((p) => p.test(text));

// -- Publication -----------------------------------------------------------

export type PublishError = "invalid" | "title" | "notes" | "link" | "build";

export interface Publication {
  title: string;
  notes: string;
  build: BuildCode & { hero: string };
}

/**
 * Strict reading of a publish request (`{ title, notes?, build }`). Lengths
 * are checked on the raw strings first - a megabyte title is refused before
 * any cleaning work - then on the cleaned text.
 */
export function validatePublication(
  raw: unknown,
  catalog: CodeCatalog,
): { ok: true; value: Publication } | { ok: false; error: PublishError } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, error: "invalid" };
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some((k) => k !== "title" && k !== "notes" && k !== "build")) return { ok: false, error: "invalid" };

  if (typeof body.title !== "string" || body.title.length > TITLE_MAX * 4) return { ok: false, error: "title" };
  const title = cleanText(body.title, false);
  if (textLength(title) < TITLE_MIN || textLength(title) > TITLE_MAX) return { ok: false, error: "title" };

  if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > NOTES_MAX * 4)) {
    return { ok: false, error: "notes" };
  }
  const notes = cleanText((body.notes as string | undefined) ?? "", true);
  if (textLength(notes) > NOTES_MAX) return { ok: false, error: "notes" };

  if (hasLink(title) || hasLink(notes)) return { ok: false, error: "link" };

  const build = validateBuild(body.build, catalog);
  if (!build) return { ok: false, error: "build" };
  return { ok: true, value: { title, notes, build } };
}

export type PublishLimit = "ok" | "day" | "total" | "full";

export function canPublish(builds: readonly StoredBuild[], authorId: string, now: number): PublishLimit {
  if (builds.length >= LIMITS.totalBuilds) return "full";
  const own = builds.filter((b) => b.author.id === authorId);
  if (own.length >= LIMITS.perAccountTotal) return "total";
  if (own.filter((b) => now - Date.parse(b.createdAt) < DAY_MS).length >= LIMITS.perAccountPerDay) return "day";
  return "ok";
}

// -- Votes and order -------------------------------------------------------

/** One vote per account and per build: a second call takes it back. */
export function toggleVote(b: StoredBuild, voter: string, now: number): { build: StoredBuild; voted: boolean } {
  const had = b.votes.some((v) => v.voter === voter);
  return had
    ? { build: { ...b, votes: b.votes.filter((v) => v.voter !== voter) }, voted: false }
    : { build: { ...b, votes: [...b.votes, { voter, at: now }] }, voted: true };
}

export type SortOrder = "votes" | "recent" | "week";
export const SORT_ORDERS: readonly SortOrder[] = ["votes", "recent", "week"];

const newer = (a: StoredBuild, b: StoredBuild) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id);

export function sortBuilds(list: readonly StoredBuild[], order: SortOrder, now: number): StoredBuild[] {
  const copy = [...list];
  if (order === "recent") return copy.sort(newer);
  if (order === "week") {
    return copy.sort((a, b) => weekVotes(b, now) - weekVotes(a, now) || b.votes.length - a.votes.length || newer(a, b));
  }
  return copy.sort((a, b) => b.votes.length - a.votes.length || newer(a, b));
}

export const isIndexable = (votes: number) => votes >= INDEX_THRESHOLD;

// -- Requests --------------------------------------------------------------

/**
 * Same-origin check for mutating requests. A browser always sends `Origin`
 * on a cross-origin POST or DELETE, and `Sec-Fetch-Site` when it supports
 * it: either one pointing elsewhere is refused. With neither header the
 * caller is not a browser, and cannot ride a visitor's cookie anyway.
 * `allowedHosts` adds the public host, which a reverse proxy may not forward
 * as `Host`.
 */
export function isSameOrigin(headers: Headers, allowedHosts: readonly string[] = []): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = headers.get("origin");
  if (!origin) return true;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = new Set(
    [headers.get("host"), headers.get("x-forwarded-host")?.split(",")[0]?.trim(), ...allowedHosts].filter(
      (h): h is string => Boolean(h),
    ),
  );
  return hosts.has(host);
}
