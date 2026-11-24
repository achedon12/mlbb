import { currentStreak, dayUtc, shiftDay, STATS_EMPTY, type StatsQuiz } from "./quiz";
import { monthStart } from "./reminders";

/**
 * Player progress kept on the account, next to the browser copy.
 *
 * The browser stays the working copy: favourites, the daily quiz and
 * MLBBdle stats, the practice records and the reminder months live in
 * `localStorage` and every page reads them there, signed in or not. Signed
 * in, the same data is also kept on the account so it follows the player to
 * another device. This module holds the decisions, with no network and no
 * storage: the shape of the data, how two copies merge, and the badges. Data
 * free, so a client component can import it.
 *
 * Merging never loses anything a player earned:
 * - lists (favourites) merge three ways from the last agreed copy, like the
 *   skin collection: a hero removed here and untouched elsewhere stays
 *   removed, one added elsewhere appears here;
 * - counters (days played, score distribution, practice totals) add what each
 *   side gained since the last agreed copy; with no agreed copy yet (the
 *   first sign-in on this browser), the larger of the two is kept, so a
 *   count is never inflated by being counted twice;
 * - a streak is a run of consecutive days ending on `dernier`: two runs that
 *   touch or overlap join into one, otherwise the most recent wins;
 * - records keep the best of both; reminders are the union of both, minus
 *   the months already past.
 */

/** Ceilings of a synced copy: far above real use, low enough to bound a row. */
export const MAX_FAVOURITES = 200;
export const MAX_REMINDER_MONTHS = 24;
export const MAX_DISTRIBUTION = 16;
export const MAX_COUNT = 1_000_000;
export const HERO_SLUG = /^[a-z0-9-]{1,40}$/;
export const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The MLBBdle practice record, as `mlbbdle-storage.ts` keeps it. */
export interface MlbbdlePractice {
  found: number;
  guesses: number;
  best: number | null;
}

/** The quiz practice record, as `quiz-storage.ts` keeps it. */
export interface QuizPractice {
  meilleure: number;
  jouees: number;
  reussies: number;
}

export interface SyncData {
  /** Hero slugs, in the order they were added. */
  favourites: string[];
  quiz: { daily: StatsQuiz; practice: QuizPractice };
  mlbbdle: { classic: StatsQuiz; skill: StatsQuiz; practice: MlbbdlePractice };
  /** Months ("2026-12") the player asked to be reminded of, on any device. */
  reminders: string[];
}

export const EMPTY_QUIZ_PRACTICE: QuizPractice = { meilleure: 0, jouees: 0, reussies: 0 };
export const EMPTY_MLBBDLE_PRACTICE: MlbbdlePractice = { found: 0, guesses: 0, best: null };

export function emptyData(): SyncData {
  return {
    favourites: [],
    quiz: { daily: { ...STATS_EMPTY, distribution: [] }, practice: { ...EMPTY_QUIZ_PRACTICE } },
    mlbbdle: {
      classic: { ...STATS_EMPTY, distribution: [] },
      skill: { ...STATS_EMPTY, distribution: [] },
      practice: { ...EMPTY_MLBBDLE_PRACTICE },
    },
    reminders: [],
  };
}

// ── Normalising ────────────────────────────────────────────────────

const count = (x: unknown): number =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(MAX_COUNT, Math.max(0, Math.floor(x))) : 0;

const isDay = (x: unknown): x is string => typeof x === "string" && DAY.test(x) && dayUtc(new Date(`${x}T00:00:00Z`)) === x;

/**
 * Whatever the browser or the database holds, as a clean `StatsQuiz`: counts
 * as non-negative integers, a real day or null, a bounded distribution. A
 * streak without a day is no streak.
 */
export function cleanStats(raw: unknown): StatsQuiz {
  if (!raw || typeof raw !== "object") return { ...STATS_EMPTY, distribution: [] };
  const s = raw as Partial<Record<keyof StatsQuiz, unknown>>;
  const dernier = isDay(s.dernier) ? s.dernier : null;
  const distribution = Array.isArray(s.distribution) ? s.distribution.slice(0, MAX_DISTRIBUTION).map(count) : [];
  const serie = dernier ? count(s.serie) : 0;
  return {
    joues: Math.max(count(s.joues), sum(distribution)),
    serie,
    meilleure: Math.max(count(s.meilleure), serie),
    dernier,
    distribution,
  };
}

function cleanQuizPractice(raw: unknown): QuizPractice {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof QuizPractice, unknown>>;
  return { meilleure: count(p.meilleure), jouees: count(p.jouees), reussies: count(p.reussies) };
}

function cleanMlbbdlePractice(raw: unknown): MlbbdlePractice {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof MlbbdlePractice, unknown>>;
  const best = typeof p.best === "number" && Number.isFinite(p.best) && p.best >= 1 ? Math.min(MAX_COUNT, Math.floor(p.best)) : null;
  return { found: count(p.found), guesses: count(p.guesses), best };
}

const uniqueInOrder = (values: Iterable<string>) => [...new Set(values)];

/** Months still worth keeping at `now`: not opened more than two days ago. */
export function liveMonths(months: Iterable<string>, now: number): string[] {
  return uniqueInOrder(months)
    .filter((m) => MONTH.test(m))
    .filter((m) => {
      const start = monthStart(m);
      return start !== null && now - start <= 2 * 86_400_000;
    })
    .sort()
    .slice(0, MAX_REMINDER_MONTHS);
}

/** Any stored or received value, as clean `SyncData`. Unknown keys are dropped. */
export function cleanData(raw: unknown, now = Date.now()): SyncData {
  if (!raw || typeof raw !== "object") return emptyData();
  const d = raw as Record<string, unknown>;
  const quiz = (d.quiz && typeof d.quiz === "object" ? d.quiz : {}) as Record<string, unknown>;
  const mlbbdle = (d.mlbbdle && typeof d.mlbbdle === "object" ? d.mlbbdle : {}) as Record<string, unknown>;
  const strings = (x: unknown) => (Array.isArray(x) ? x.filter((e): e is string => typeof e === "string") : []);
  return {
    favourites: uniqueInOrder(strings(d.favourites).filter((s) => HERO_SLUG.test(s))).slice(0, MAX_FAVOURITES),
    quiz: { daily: cleanStats(quiz.daily), practice: cleanQuizPractice(quiz.practice) },
    mlbbdle: { classic: cleanStats(mlbbdle.classic), skill: cleanStats(mlbbdle.skill), practice: cleanMlbbdlePractice(mlbbdle.practice) },
    reminders: liveMonths(strings(d.reminders), now),
  };
}

// ── Comparing ──────────────────────────────────────────────────────

function sum(values: number[]): number {
  return values.reduce((n, x) => n + x, 0);
}

const sameList = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => v === b[i]);

function sameStats(a: StatsQuiz, b: StatsQuiz): boolean {
  return a.joues === b.joues && a.serie === b.serie && a.meilleure === b.meilleure && a.dernier === b.dernier && sameList(a.distribution, b.distribution);
}

/** Same content, favourites order included (the order is the player's). */
export function sameData(a: SyncData, b: SyncData): boolean {
  return (
    sameList(a.favourites, b.favourites) &&
    sameList([...a.reminders].sort(), [...b.reminders].sort()) &&
    sameStats(a.quiz.daily, b.quiz.daily) &&
    sameStats(a.mlbbdle.classic, b.mlbbdle.classic) &&
    sameStats(a.mlbbdle.skill, b.mlbbdle.skill) &&
    a.quiz.practice.meilleure === b.quiz.practice.meilleure &&
    a.quiz.practice.jouees === b.quiz.practice.jouees &&
    a.quiz.practice.reussies === b.quiz.practice.reussies &&
    a.mlbbdle.practice.found === b.mlbbdle.practice.found &&
    a.mlbbdle.practice.guesses === b.mlbbdle.practice.guesses &&
    a.mlbbdle.practice.best === b.mlbbdle.practice.best
  );
}

// ── Merging ────────────────────────────────────────────────────────

/**
 * Three-way merge of the favourites: an entry this side changed since the
 * common ancestor keeps this side's choice, otherwise the other side's.
 * Without an ancestor, the union. This side's order first, then the heroes
 * only the other side has, in its order.
 */
export function mergeFavourites(base: readonly string[] | null, local: readonly string[], remote: readonly string[]): string[] {
  const l = new Set(local);
  const r = new Set(remote);
  if (!base) return uniqueInOrder([...local, ...remote]).slice(0, MAX_FAVOURITES);
  const b = new Set(base);
  const keep = (id: string) => (l.has(id) !== b.has(id) ? l.has(id) : r.has(id));
  return uniqueInOrder([...local, ...remote]).filter(keep).slice(0, MAX_FAVOURITES);
}

/**
 * A counter both sides moved on from `base`: the other side's value plus
 * what this side gained. Without `base`, the larger of the two (each device
 * may already count the same days: adding would count them twice).
 */
export function mergeCount(base: number | null, local: number, remote: number): number {
  if (base === null) return Math.max(local, remote);
  return Math.min(MAX_COUNT, remote + Math.max(0, local - base));
}

function mergeDistribution(base: number[] | null, local: number[], remote: number[]): number[] {
  const length = Math.min(MAX_DISTRIBUTION, Math.max(local.length, remote.length));
  return Array.from({ length }, (_, i) => mergeCount(base ? (base[i] ?? 0) : null, local[i] ?? 0, remote[i] ?? 0));
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * The streak of two copies: each is a run of `serie` consecutive days ending
 * on `dernier`. Runs that overlap or touch (one ends the day before the other
 * starts) are one run; otherwise the most recent one is the streak.
 */
export function mergeStreak(a: Pick<StatsQuiz, "serie" | "dernier">, b: Pick<StatsQuiz, "serie" | "dernier">): { serie: number; dernier: string | null } {
  if (!a.dernier || a.serie < 1) return b.dernier && b.serie >= 1 ? { serie: b.serie, dernier: b.dernier } : { serie: 0, dernier: b.dernier ?? a.dernier };
  if (!b.dernier || b.serie < 1) return { serie: a.serie, dernier: a.dernier };
  const [early, late] = a.dernier <= b.dernier ? [a, b] : [b, a];
  const lateDay = late.dernier!;
  const earlyDay = early.dernier!;
  const lateStart = shiftDay(lateDay, -(late.serie - 1));
  const earlyStart = shiftDay(earlyDay, -(early.serie - 1));
  if (earlyDay < shiftDay(lateStart, -1)) return { serie: late.serie, dernier: lateDay };
  const start = earlyStart < lateStart ? earlyStart : lateStart;
  return { serie: daysBetween(start, lateDay) + 1, dernier: lateDay };
}

export function mergeStats(base: StatsQuiz | null, local: StatsQuiz, remote: StatsQuiz): StatsQuiz {
  const distribution = mergeDistribution(base?.distribution ?? null, local.distribution, remote.distribution);
  const streak = mergeStreak(local, remote);
  return {
    joues: Math.max(mergeCount(base?.joues ?? null, local.joues, remote.joues), sum(distribution)),
    serie: streak.serie,
    meilleure: Math.max(local.meilleure, remote.meilleure, streak.serie),
    dernier: streak.dernier,
    distribution,
  };
}

/**
 * Two copies of the whole progress. `base` is the copy both last agreed on
 * (null: none, the first sync of this browser with this account).
 */
export function mergeData(base: SyncData | null, local: SyncData, remote: SyncData, now = Date.now()): SyncData {
  const qb = base?.quiz.practice ?? null;
  const mb = base?.mlbbdle.practice ?? null;
  const ql = local.quiz.practice;
  const qr = remote.quiz.practice;
  const ml = local.mlbbdle.practice;
  const mr = remote.mlbbdle.practice;
  const bests = [ml.best, mr.best].filter((x): x is number => x !== null);
  return {
    favourites: mergeFavourites(base?.favourites ?? null, local.favourites, remote.favourites),
    quiz: {
      daily: mergeStats(base?.quiz.daily ?? null, local.quiz.daily, remote.quiz.daily),
      practice: {
        meilleure: Math.max(ql.meilleure, qr.meilleure),
        jouees: mergeCount(qb?.jouees ?? null, ql.jouees, qr.jouees),
        reussies: mergeCount(qb?.reussies ?? null, ql.reussies, qr.reussies),
      },
    },
    mlbbdle: {
      classic: mergeStats(base?.mlbbdle.classic ?? null, local.mlbbdle.classic, remote.mlbbdle.classic),
      skill: mergeStats(base?.mlbbdle.skill ?? null, local.mlbbdle.skill, remote.mlbbdle.skill),
      practice: {
        found: mergeCount(mb?.found ?? null, ml.found, mr.found),
        guesses: mergeCount(mb?.guesses ?? null, ml.guesses, mr.guesses),
        best: bests.length ? Math.min(...bests) : null,
      },
    },
    reminders: liveMonths([...local.reminders, ...remote.reminders], now),
  };
}

// ── Reconciling ────────────────────────────────────────────────────

/** The copy kept on the account, as the API returns it. */
export interface RemoteSync {
  data: SyncData;
  /** ISO time of the last save: the version a write is based on. */
  updatedAt: string;
}

/**
 * What this browser remembers of the account copy: the account it was synced
 * with (an opaque key, not the account id), and the version and content last
 * agreed with the server, the common ancestor of the next merge. Local
 * changes are whatever differs from `base`: no flag to lose.
 */
export interface SyncMeta {
  account: string;
  updatedAt: string | null;
  base: SyncData;
}

export const KEY_ACCOUNT_SYNC = "mlbbdex:account-sync";

export type Reconciled = {
  /** The progress to keep in the browser. */
  result: SyncData;
  /** Whether `result` must be sent to the account. */
  upload: boolean;
  /** The first time this browser meets this account: its data joined the account's. */
  firstMerge: boolean;
  /** The account copy this browser had agreed on is gone: it was deleted (from another device). */
  deleted: boolean;
};

/**
 * What to do when a signed-in page opens, from the browser copy, what the
 * browser remembers, and the account copy:
 * - first sync of this browser with this account (or a browser last synced
 *   with another one): both copies merged with no ancestor (union, larger
 *   counts, joined streaks) and sent, so nothing played on either side is
 *   lost;
 * - the copy this browser agreed on was deleted: the player asked for the
 *   account copy to go, so nothing is sent back; the browser keeps its own;
 * - otherwise a three-way merge from the last agreed copy, sent when it
 *   differs from the account's.
 */
export function reconcile(local: SyncData, meta: SyncMeta | null, remote: RemoteSync | null, account: string, now = Date.now()): Reconciled {
  const empty = sameData(local, emptyData());
  if (!meta || meta.account !== account || (meta.updatedAt === null && !remote)) {
    if (!remote) return { result: local, upload: !empty, firstMerge: true, deleted: false };
    const result = mergeData(null, local, remote.data, now);
    return { result, upload: !sameData(result, remote.data), firstMerge: true, deleted: false };
  }
  if (!remote) return { result: local, upload: false, firstMerge: false, deleted: true };
  if (remote.updatedAt === meta.updatedAt) return { result: local, upload: !sameData(local, meta.base), firstMerge: false, deleted: false };
  const result = mergeData(meta.base, local, remote.data, now);
  return { result, upload: !sameData(result, remote.data), firstMerge: false, deleted: false };
}

export function readSyncMeta(raw: string | null): SyncMeta | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SyncMeta> | null;
    if (!v || typeof v !== "object" || typeof v.account !== "string") return null;
    return { account: v.account, updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : null, base: cleanData(v.base) };
  } catch {
    return null;
  }
}

// ── Progress and badges ────────────────────────────────────────────

export const BADGES = ["streak7", "streak30", "mlbbdle10", "mlbbdle50", "firstTry", "quiz10", "allGames", "favourites5"] as const;
export type Badge = (typeof BADGES)[number];

/** Highest score with at least one day on it, or null. */
export function bestScore(stats: StatsQuiz): number | null {
  for (let i = stats.distribution.length - 1; i >= 0; i--) if ((stats.distribution[i] ?? 0) > 0) return i;
  return null;
}

/** Fewest guesses on a won MLBBdle day, over both modes; null before the first win. */
export function fewestGuesses(...modes: StatsQuiz[]): number | null {
  let best: number | null = null;
  for (const s of modes) {
    const i = s.distribution.findIndex((n, k) => k >= 1 && n > 0);
    if (i >= 1 && (best === null || i < best)) best = i;
  }
  return best;
}

export interface Progress {
  quiz: { days: number; streak: number; bestStreak: number; bestScore: number | null; practiceBest: number };
  mlbbdle: { solved: number; streak: number; bestStreak: number; fewestGuesses: number | null; practiceFound: number };
  favourites: number;
  badges: Badge[];
}

/** What the profile shows, from the data and today's day (a streak not continued yesterday or today is over). */
export function progressOf(d: SyncData, today: string): Progress {
  const { classic, skill } = d.mlbbdle;
  const quizDaily = d.quiz.daily;
  const mlbbdleStreak = Math.max(currentStreak(classic, today), currentStreak(skill, today));
  const mlbbdleBest = Math.max(classic.meilleure, skill.meilleure);
  const solved = classic.joues + skill.joues;
  const bestStreak = Math.max(quizDaily.meilleure, mlbbdleBest);
  const first = fewestGuesses(classic, skill);
  const badges: Badge[] = [];
  if (bestStreak >= 7) badges.push("streak7");
  if (bestStreak >= 30) badges.push("streak30");
  if (solved >= 10) badges.push("mlbbdle10");
  if (solved >= 50) badges.push("mlbbdle50");
  if (first === 1) badges.push("firstTry");
  if (quizDaily.joues >= 10) badges.push("quiz10");
  if (quizDaily.joues > 0 && classic.joues > 0 && skill.joues > 0) badges.push("allGames");
  if (d.favourites.length >= 5) badges.push("favourites5");
  return {
    quiz: {
      days: quizDaily.joues,
      streak: currentStreak(quizDaily, today),
      bestStreak: quizDaily.meilleure,
      bestScore: bestScore(quizDaily),
      practiceBest: d.quiz.practice.meilleure,
    },
    mlbbdle: { solved, streak: mlbbdleStreak, bestStreak: mlbbdleBest, fewestGuesses: first, practiceFound: d.mlbbdle.practice.found },
    favourites: d.favourites.length,
    badges,
  };
}

// ── Public profile ─────────────────────────────────────────────────

/**
 * What a public profile may show, each one chosen by its owner. The name
 * comes with the page itself; the picture is a choice too (a Discord
 * avatar's address carries the Discord id).
 */
export const PUBLIC_FIELDS = ["avatar", "favourites", "quiz", "mlbbdle", "badges"] as const;
export type PublicField = (typeof PUBLIC_FIELDS)[number];
export const SLUG = /^[A-Za-z0-9_-]{10,16}$/;

/** The public view: only the fields the owner chose, nothing else from the data. */
export interface PublicProfile {
  name: string;
  avatar: string | null;
  favourites?: string[];
  quiz?: Progress["quiz"];
  mlbbdle?: Progress["mlbbdle"];
  badges?: Badge[];
}

export function publicView(o: { name: string; avatar: string | null; fields: readonly string[]; data: SyncData | null; today: string }): PublicProfile {
  const shown = new Set(o.fields);
  const view: PublicProfile = { name: o.name, avatar: shown.has("avatar") ? o.avatar : null };
  const data = o.data ?? emptyData();
  const progress = progressOf(data, o.today);
  if (shown.has("favourites")) view.favourites = data.favourites.slice(0, 24);
  if (shown.has("quiz")) view.quiz = progress.quiz;
  if (shown.has("mlbbdle")) view.mlbbdle = progress.mlbbdle;
  if (shown.has("badges")) view.badges = progress.badges;
  return view;
}
