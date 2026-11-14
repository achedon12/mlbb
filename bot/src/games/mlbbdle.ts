import type { MlbbdleHero } from "../site/schemas.js";

/**
 * MLBBdle in Discord. The secret of the day comes from the site
 * (`/api/bot/daily`), so a server plays the very puzzle of mlbbdex.com; only
 * the comparison runs here, ported from the site's `src/lib/mlbbdle.ts`
 * (same columns, same verdicts, same squares).
 */

export type Mode = "classic" | "skill";
export const MODES: Mode[] = ["classic", "skill"];

export type Verdict = "match" | "partial" | "miss" | "unknown";
export type Direction = "same" | "newer" | "older" | "unknown";

export const COLUMNS = ["gender", "roles", "lanes", "specialties", "damage", "range", "resource", "region", "year"] as const;
export type Column = (typeof COLUMNS)[number];

function overlap(guess: string[], target: string[]): Verdict {
  if (!guess.length || !target.length) return "unknown";
  const shared = guess.filter((x) => target.includes(x)).length;
  if (shared === 0) return "miss";
  return shared === target.length && guess.length === target.length ? "match" : "partial";
}

function single(guess: string | null, target: string | null, wide?: string): Verdict {
  if (!guess || !target) return "unknown";
  if (guess === target) return "match";
  return wide && (guess === wide || target === wide) ? "partial" : "miss";
}

function direction(guess: number | null, target: number | null): Direction {
  if (guess === null || target === null) return "unknown";
  return guess === target ? "same" : target > guess ? "newer" : "older";
}

export function compare(guess: MlbbdleHero, target: MlbbdleHero): Record<Column, { verdict: Verdict; direction?: Direction }> {
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

const EMOJI: Record<Verdict, string> = { match: "🟩", partial: "🟧", miss: "🟥", unknown: "⬛" };

/** One row of squares: the colours, never the names, so it can be shared. */
export function emojiRow(guess: MlbbdleHero, target: MlbbdleHero): string {
  const cells = compare(guess, target);
  return COLUMNS.map((c) => EMOJI[guess.slug === target.slug ? "match" : cells[c].verdict]).join("");
}

/** Year arrow for a row: where to look next. */
export function yearHint(guess: MlbbdleHero, target: MlbbdleHero): "⬆️" | "⬇️" | "" {
  const d = direction(guess.year, target.year);
  return d === "newer" ? "⬆️" : d === "older" ? "⬇️" : "";
}

/** Skill-mode clues and the misses that unlock them, as on the site (the colour clue has no Discord form). */
export const SKILL_CLUES = [
  { key: "name", threshold: 4 },
  { key: "description", threshold: 6 },
  { key: "roles", threshold: 8 },
] as const;
export type SkillClue = (typeof SKILL_CLUES)[number]["key"];

export function unlockedClues(misses: number): Set<SkillClue> {
  return new Set(SKILL_CLUES.filter((c) => misses >= c.threshold).map((c) => c.key));
}

export function nextClue(misses: number): { key: SkillClue; remaining: number } | null {
  const c = SKILL_CLUES.find((x) => misses < x.threshold);
  return c ? { key: c.key, remaining: c.threshold - misses } : null;
}

/** Skill-mode grid: one red square per miss, the green one at the end. */
export function skillGrid(guesses: string[], answer: string): string {
  const misses = guesses.filter((g) => g !== answer).length;
  const found = guesses.includes(answer) ? "🟩" : "";
  return misses >= 12 ? `🟥×${misses}${found}` : `${"🟥".repeat(misses)}${found}`;
}
