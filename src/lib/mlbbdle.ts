import { decalerJour, enregistrerPartie, hacher, type StatsQuiz } from "./quiz";
import type { Lane, Role } from "./types";

/**
 * MLBBdle: one secret hero per day, guessed by comparing their traits with
 * the heroes you propose (classic mode), or from a skill icon (skill mode).
 * Unlimited guesses, as on Loldle.
 *
 * Pure module, with no data and no browser: the server uses it to draw the
 * daily secrets, the client to compare guesses, fill the share grid and keep
 * the stats.
 *
 * The secret depends only on the UTC date and the roster: the same for
 * everyone, in every language. It is drawn day after day from the epoch so a
 * hero never returns within `WINDOW` days; a hero only becomes a candidate a
 * few days after release, so a newly synced hero never reshuffles the days
 * already played.
 */

/** First day of the game: a day's number counts from this one. */
export const EPOCH = "2026-09-11";

/** Days during which a secret does not come back, in each mode. */
export const WINDOW = 60;

/**
 * Delay between a hero's release and their first appearance: time for the
 * sync to bring them in and for players to get to know them.
 */
export const NEW_HERO_DELAY = 14;

/** Last bucket of the guess distribution: "10 and more". */
export const LAST_BUCKET = 10;

/** Guess rows in the shared grid, beyond which the grid is summarised. */
export const SHARE_ROWS = 8;

/** Beyond this, a skill-mode grid is written as a count rather than squares. */
const MAX_SQUARES = 12;

export type Gender = "male" | "female" | "none";

/** Traits compared by classic mode, in column order. */
export type Column =
  | "gender"
  | "roles"
  | "lanes"
  | "specialties"
  | "damage"
  | "range"
  | "resource"
  | "region"
  | "year";

export const COLUMNS: Column[] = [
  "gender",
  "roles",
  "lanes",
  "specialties",
  "damage",
  "range",
  "resource",
  "region",
  "year",
];

/**
 * A hero as MLBBdle compares them. Values are language-independent keys
 * (`magic`, `moniyan-empire`): the comparison holds in every language, and
 * the labels are sent separately.
 */
export interface MlbbdleHero {
  slug: string;
  name: string;
  icon: string | null;
  gender: Gender | null;
  roles: Role[];
  lanes: Lane[];
  specialties: string[];
  damage: string | null;
  range: string | null;
  resource: string | null;
  region: string | null;
  year: number | null;
}

// ─────────────────────────────────────────────────────────────
// Comparison
// ─────────────────────────────────────────────────────────────

/** Green, orange, red; grey when either value is missing. */
export type Verdict = "match" | "partial" | "miss" | "unknown";
/** Where the secret sits relative to the guess: `newer` = released later. */
export type Direction = "same" | "newer" | "older" | "unknown";

export interface ComparedCell {
  verdict: Verdict;
  /** Year only: which way to look. */
  direction?: Direction;
}

function overlap<T>(guess: T[], target: T[]): Verdict {
  if (!guess.length || !target.length) return "unknown";
  const shared = guess.filter((x) => target.includes(x)).length;
  if (shared === 0) return "miss";
  return shared === target.length && guess.length === target.length ? "match" : "partial";
}

/**
 * Single value. `wide` covers the trait's two other values (mixed damage,
 * hybrid range): it gives a partial match with either of them.
 */
function single(guess: string | null, target: string | null, wide?: string): Verdict {
  if (!guess || !target) return "unknown";
  if (guess === target) return "match";
  return wide && (guess === wide || target === wide) ? "partial" : "miss";
}

function direction(guess: number | null, target: number | null): Direction {
  if (guess === null || target === null) return "unknown";
  return guess === target ? "same" : target > guess ? "newer" : "older";
}

/** One cell per column: what the guess shares with the secret. */
export function compare(guess: MlbbdleHero, target: MlbbdleHero): Record<Column, ComparedCell> {
  const year = direction(guess.year, target.year);
  return {
    gender: { verdict: single(guess.gender, target.gender) },
    roles: { verdict: overlap(guess.roles, target.roles) },
    lanes: { verdict: overlap(guess.lanes, target.lanes) },
    specialties: { verdict: overlap(guess.specialties, target.specialties) },
    damage: { verdict: single(guess.damage, target.damage, "mixed") },
    range: { verdict: single(guess.range, target.range, "hybrid") },
    resource: { verdict: single(guess.resource, target.resource) },
    region: { verdict: single(guess.region, target.region) },
    year: { verdict: year === "same" ? "match" : year === "unknown" ? "unknown" : "miss", direction: year },
  };
}

// ─────────────────────────────────────────────────────────────
// Skill mode
// ─────────────────────────────────────────────────────────────

/** A skill icon, its name and an excerpt of its description, hero name masked. */
export interface SkillPuzzle {
  answer: string;
  name: string;
  icon: string;
  excerpt: string | null;
}

export type SkillClue = "colour" | "name" | "description" | "roles";

/** Skill-mode clues, and the number of misses that unlocks each one. */
export const SKILL_CLUES: { key: SkillClue; threshold: number }[] = [
  { key: "colour", threshold: 2 },
  { key: "name", threshold: 4 },
  { key: "description", threshold: 6 },
  { key: "roles", threshold: 8 },
];

export function unlockedClues(misses: number): Set<SkillClue> {
  return new Set(SKILL_CLUES.filter((c) => misses >= c.threshold).map((c) => c.key));
}

/** Next clue to unlock, and how many misses away it is. */
export function nextClue(misses: number): { key: SkillClue; remaining: number } | null {
  const c = SKILL_CLUES.find((x) => misses < x.threshold);
  return c ? { key: c.key, remaining: c.threshold - misses } : null;
}

// ─────────────────────────────────────────────────────────────
// Daily puzzle
// ─────────────────────────────────────────────────────────────

export interface MlbbdlePuzzle {
  day: string;
  number: number;
  classic: string;
  skill: SkillPuzzle | null;
  /** Yesterday's answers; absent before the first day. */
  yesterday: { classic: string | null; skill: string | null } | null;
}

/** What the draw knows about a hero: their slug, and since when they may come up. */
export interface Candidate {
  slug: string;
  /** First day they can be drawn; null while their release is undated. */
  since: string | null;
  /** Do they have an illustrated skill, for skill mode? */
  hasSkill: boolean;
}

export interface DaySecrets {
  day: string;
  classic: string | null;
  skill: string | null;
}

export function puzzleNumber(day: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`)) / 86_400_000) + 1;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * First day a hero can be the secret. The wiki dates a release to the day
 * ("26 October 2021"), or only to the month or year for the oldest heroes; an
 * announced hero ("TBA") is not a candidate yet.
 */
export function eligibleFrom(release: string | null): string | null {
  const m = /^(?:(\d{1,2}) )?(?:([A-Za-z]+) )?(\d{4})$/.exec((release ?? "").trim());
  if (!m) return null;
  const month = m[2] ? MONTHS.indexOf(m[2].toLowerCase()) : 0;
  if (month < 0) return null;
  const date = new Date(Date.UTC(Number(m[3]), month, m[1] ? Number(m[1]) : 1));
  return decalerJour(date.toISOString().slice(0, 10), NEW_HERO_DELAY);
}

/** Candidate with the smallest hash: a newcomer only moves the pick if it wins. */
function pick(slugs: string[], seed: string): string | null {
  let best: string | null = null;
  let lowest = Infinity;
  for (const s of slugs) {
    const v = hacher(`mlbbdle:${seed}|${s}`);
    if (v < lowest) {
      lowest = v;
      best = s;
    }
  }
  return best;
}

/** Without the recent secrets; all of them if the window ruled out every last one. */
function withoutRecent(slugs: string[], recent: Set<string | null>): string[] {
  const free = slugs.filter((s) => !recent.has(s));
  return free.length ? free : slugs;
}

/**
 * Secrets of every day from the epoch up to `until` included. A day's draw
 * depends on the previous ones (no repeat within `WINDOW` days), so they are
 * all unrolled: a few milliseconds for years of puzzles.
 */
export function drawSecrets(candidates: Candidate[], until: string, start = EPOCH): DaySecrets[] {
  const sorted = [...candidates].sort((a, b) => a.slug.localeCompare(b.slug));
  const out: DaySecrets[] = [];
  for (let day = until < start ? until : start; day <= until; day = decalerJour(day, 1)) {
    const eligible = sorted.filter((c) => c.since !== null && c.since <= day);
    const recent = out.slice(-WINDOW);
    const classic = pick(
      withoutRecent(eligible.map((c) => c.slug), new Set(recent.map((s) => s.classic))),
      `classic:${day}`,
    );
    // Never the same hero in both modes on the same day.
    const forSkill = eligible.filter((c) => c.hasSkill && c.slug !== classic).map((c) => c.slug);
    const skill = pick(withoutRecent(forSkill, new Set(recent.map((s) => s.skill))), `skill:${day}`);
    out.push({ day, classic, skill });
  }
  return out;
}

/** A random secret for practice, avoiding the latest ones when possible. */
export function drawRandom(slugs: string[], recent: string[], random: () => number = Math.random): string | null {
  const free = withoutRecent(slugs, new Set(recent));
  return free.length ? free[Math.min(free.length - 1, Math.floor(random() * free.length))] : null;
}

// ─────────────────────────────────────────────────────────────
// Sharing and stats
// ─────────────────────────────────────────────────────────────

const EMOJI: Record<Verdict, string> = { match: "🟩", partial: "🟧", miss: "🟥", unknown: "⬛" };

/** One row of squares per guess: the colours, never the names. */
export function emojiRow(guess: MlbbdleHero, target: MlbbdleHero): string {
  const cells = compare(guess, target);
  return COLUMNS.map((c) => EMOJI[guess.slug === target.slug ? "match" : cells[c].verdict]).join("");
}

/**
 * Classic-mode grid, from the first guess to the last. When too long, it
 * keeps the beginning and the winning row, separated by the number of rows
 * left out.
 */
export function classicGrid(
  guesses: string[],
  target: MlbbdleHero,
  bySlug: Map<string, MlbbdleHero>,
  max = SHARE_ROWS,
): string[] {
  const rows = guesses.flatMap((s) => {
    const h = bySlug.get(s);
    return h ? [emojiRow(h, target)] : [];
  });
  if (rows.length <= max) return rows;
  return [...rows.slice(0, max - 1), `⋯ +${rows.length - max}`, rows.at(-1)!];
}

/** Skill-mode grid: one red square per miss, the green one at the end. */
export function skillGrid(guesses: string[], answer: string): string {
  const misses = guesses.filter((g) => g !== answer).length;
  const found = guesses.includes(answer) ? "🟩" : "";
  if (misses >= MAX_SQUARES) return `🟥×${misses}${found}`;
  return `${"🟥".repeat(misses)}${found}`;
}

export function shareText(o: { title: string; rows: string[]; url: string }): string {
  return [o.title, ...o.rows, o.url].join("\n");
}

/** Records a won day, in the bucket of its number of guesses. */
export function recordWin(stats: StatsQuiz, day: string, guesses: number): StatsQuiz {
  return enregistrerPartie(stats, day, Math.min(Math.max(1, guesses), LAST_BUCKET));
}

/** Average guesses per won day; the last bucket counts as its lower bound. */
export function averageGuesses(stats: StatsQuiz): number {
  const total = stats.distribution.reduce((n, x) => n + x, 0);
  return total ? stats.distribution.reduce((s, n, i) => s + n * i, 0) / total : 0;
}
