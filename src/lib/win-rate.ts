/**
 * Win rate calculator.
 *
 * The game shows a rounded rate and a number of games; from them we derive the
 * number of wins (an integer: a game is won or lost), then what it
 * takes to reach the target. For `n` games and `v` wins, a
 * target `t` requires `x` wins in a row such that (v + x) / (n + x) >= t,
 * i.e. x = ceil((t·n − v) / (1 − t)).
 *
 * All percentages are converted to integer hundredths of a point (48.53% gives
 * 4853): the computation stays exact. With floats, 99.9% over 10 games at 50%
 * gave 4991 wins instead of 4990 — the mistake made by the community
 * API that served as reference.
 */

/** Precision used: two decimals, like the game's display. */
const SCALE = 10_000;

/** Number of games beyond which the input is considered bogus. */
export const MATCHES_MAX = 1_000_000;

const hundredths = (percent: number) => Math.round(percent * 100);

/**
 * Reads a typed number: the decimal comma of European languages counts as the
 * point. An empty or unreadable input gives `null`.
 */
export function readCount(input: string): number | null {
  const text = input.trim().replace(",", ".").replace(/\s|%/g, "");
  if (text === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export interface Situation {
  /** Games played. */
  matches: number;
  /** Current win rate, in percent. */
  rate: number;
  /** Target rate, in percent. */
  objective: number;
}

export type Result =
  | { state: "invalid" }
  /** 100% target with at least one loss: no streak gets there. */
  | { state: "impossible"; currentWins: number }
  | { state: "wins"; wins: number; currentWins: number }
  /**
   * Target already reached: `margin` losses in a row keep it,
   * `null` when no streak can bring it down (0% target).
   */
  | { state: "reached"; margin: number | null; currentWins: number };

/** Usable input: whole games, rates between 0 and 100. */
export function situationValid(s: Situation): boolean {
  return (
    Number.isInteger(s.matches) &&
    s.matches >= 1 &&
    s.matches <= MATCHES_MAX &&
    [s.rate, s.objective].every((p) => Number.isFinite(p) && p >= 0 && p <= 100)
  );
}

/** Wins already secured: the displayed rate is rounded, wins are not. */
export function currentWins(matches: number, rate: number): number {
  return Math.min(matches, Math.max(0, Math.round((matches * hundredths(rate)) / SCALE)));
}

export function compute(s: Situation): Result {
  if (!situationValid(s)) return { state: "invalid" };
  const n = s.matches;
  const v = currentWins(n, s.rate);
  const t = hundredths(s.objective);
  // Lead, in hundredths of a game, of secured wins over those the
  // target requires; negative until it is reached.
  const lead = SCALE * v - t * n;

  if (lead >= 0) {
    return { state: "reached", margin: t === 0 ? null : Math.floor(lead / t), currentWins: v };
  }
  if (t >= SCALE) return { state: "impossible", currentWins: v };
  return { state: "wins", wins: Math.ceil(-lead / (SCALE - t)), currentWins: v };
}

/**
 * Games to play at a given pace to reach the target: over time,
 * the rate tends toward that pace. `null` if the pace does not exceed the target —
 * it never gets there —, 0 if the target is already reached.
 */
export function matchesAuPace(s: Situation, pace: number): number | null {
  if (!situationValid(s) || !Number.isFinite(pace) || pace < 0 || pace > 100) return null;
  const t = hundredths(s.objective);
  const missing = t * s.matches - SCALE * currentWins(s.matches, s.rate);
  if (missing <= 0) return 0;
  const r = hundredths(pace);
  return r > t ? Math.ceil(missing / (r - t)) : null;
}
