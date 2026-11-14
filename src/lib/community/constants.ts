/**
 * Community area (forum and teammate finder): names, sizes and limits,
 * shared by the pages, the browser forms, the API routes and the storage.
 * No dependency: client components import it without pulling zod. The
 * request schemas live in `rules.ts`. See docs/community.md.
 */

// -- Categories ------------------------------------------------------------

export const CATEGORIES = ["general", "heroes-builds", "ranked-help", "esports", "guides", "site-feedback"] as const;
export type Category = (typeof CATEGORIES)[number];
export const isCategory = (value: string): value is Category => (CATEGORIES as readonly string[]).includes(value);

// -- Sizes and limits ------------------------------------------------------

export const TITLE_MIN = 5;
export const TITLE_MAX = 120;
export const THREAD_BODY_MIN = 10;
export const THREAD_BODY_MAX = 10_000;
export const REPLY_BODY_MIN = 2;
export const REPLY_BODY_MAX = 5_000;
export const HERO_TAGS_MAX = 5;
export const REPORT_NOTE_MAX = 300;
/** Largest request body the community routes accept, in bytes. */
export const MAX_BODY_BYTES = 48 * 1024;

export const THREADS_PER_PAGE = 20;
export const REPLIES_PER_PAGE = 30;
export const CARDS_PER_PAGE = 24;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** An author may edit a thread or reply for an hour, and delete it for a day. */
export const EDIT_WINDOW_MS = HOUR;
export const DELETE_WINDOW_MS = DAY;
/** Accounts first seen in the community less than three days ago are "new". */
export const NEW_ACCOUNT_MS = 3 * DAY;
/** Open reports from this many accounts hide a post until a moderator looks. */
export const AUTO_HIDE_REPORTS = 3;
/** Teammate cards are listed for a week, then expire. */
export const CARD_TTL_MS = 7 * DAY;

export const DAILY_LIMITS = {
  threads: { regular: 6, newAccount: 2 },
  replies: { regular: 80, newAccount: 15 },
} as const;
/** Links one post may carry; new accounts may post none. */
export const MAX_LINKS = 5;

export const isNewAccount = (firstSeenAt: Date, now: number) => now - firstSeenAt.getTime() < NEW_ACCOUNT_MS;
export const canEdit = (createdAt: Date, now: number) => now - createdAt.getTime() < EDIT_WINDOW_MS;
export const canDelete = (createdAt: Date, now: number) => now - createdAt.getTime() < DELETE_WINDOW_MS;

export const isBanned = (member: { bannedAt: Date | null; banUntil: Date | null } | null, now: number) =>
  Boolean(member?.bannedAt && (!member.banUntil || member.banUntil.getTime() > now));

// -- Thread addresses ------------------------------------------------------

/** URL segment of a thread title: lower case ASCII, dashes, at most 60 characters. */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "thread";
}

export const threadSegment = (thread: { id: number; title: string }) => `${thread.id}-${slugify(thread.title)}`;
export const threadPath = (thread: { id: number; title: string; category: string }) =>
  `/community/${thread.category}/${threadSegment(thread)}`;

/** Thread id from its URL segment (`123-some-title` or `123`), or null. */
export function threadIdOf(segment: string): number | null {
  const match = /^(\d{1,9})(?:-[a-z0-9-]{0,80})?$/.exec(segment);
  if (!match) return null;
  const id = Number(match[1]);
  return id > 0 ? id : null;
}

/** Positive integer id of a route parameter, or null. */
export function idParam(value: string): number | null {
  if (!/^[1-9]\d{0,8}$/.test(value)) return null;
  return Number(value);
}

// -- Lists -----------------------------------------------------------------

export const SORTS = ["latest", "top"] as const;
export type Sort = (typeof SORTS)[number];
export const readSort = (value: string | undefined): Sort => (value === "top" ? "top" : "latest");

/** Page number from a query string: 1 for anything that is not a plain number. */
export function readPageNumber(value: string | undefined, max = 10_000): number {
  if (!value || !/^[1-9]\d{0,4}$/.test(value)) return 1;
  return Math.min(Number(value), max);
}


// -- Teammate finder -------------------------------------------------------

export const REGIONS = ["id", "ph", "mysg", "sea", "asia", "mena", "eu", "na", "latam", "other"] as const;
export type Region = (typeof REGIONS)[number];

/** The game's ranks, low to high (the keys of `rankNames`). */
export const RANKS = [
  "warrior",
  "elite",
  "master",
  "grandmaster",
  "epic",
  "legend",
  "mythic",
  "mythic-honor",
  "mythic-glory",
  "mythic-immortal",
] as const;
export type Rank = (typeof RANKS)[number];

/** Languages a player may list: ISO 639-1 codes, named by `Intl.DisplayNames`. */
export const LANGUAGES = ["en", "id", "tl", "ms", "es", "pt", "fr", "it", "de", "ru", "ar", "tr", "vi", "th"] as const;
export const PLAY_TIMES = ["morning", "afternoon", "evening", "night", "weekdays", "weekends"] as const;
export const CARD_NOTE_MAX = 200;
export const CARD_HEROES_MAX = 6;

export const TARGET_KINDS = ["thread", "post", "card"] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

export const REPORT_REASONS = ["spam", "abuse", "offtopic", "personal", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
