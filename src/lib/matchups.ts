import type { CounterFigure, CountersByRank } from "./data";
import type { MeasuredRank } from "./measured-ranks";
import { orderPair, segmentPair } from "./pairs";

/**
 * Logic of the matchup matrix (`/tools/matchups`): two lineups face each
 * other, each cell the measured win-rate gap of one duel. Pure module — no
 * data file imported — so the browser and the tests read it without the
 * game data.
 *
 * The game does not publish every duel. For each hero and each rank it names
 * the six opponents against whom its win rate rises the most and the six
 * against whom it drops the most. A duel is therefore measured when either
 * hero names the other; when both do, the two views are the same figure with
 * opposite signs. Everything else stays unmeasured: never a zero, never an
 * estimate.
 */

/** Heroes per side: a team. */
export const SIZE_SIDE = 5;

/**
 * Version of the `MatchupsRank` shape, part of the file URL: the file is
 * cached by the browser and kept offline by the service worker.
 */
const MATCHUPS_FORMAT = 1;

/** Address of the matchups file of a rank. */
export function matchupsUrl(rank: MeasuredRank): string {
  return `/matchups/${rank}.json?v=${MATCHUPS_FORMAT}`;
}

/** Measured duels of one rank, for the whole roster. */
export interface MatchupsRank {
  rank: MeasuredRank;
  /**
   * Win-rate gap of each measured duel, keyed by its canonical segment
   * ("aamon-vs-gloo"), from the point of view of the first hero in
   * alphabetical order, in points.
   */
  gaps: Record<string, number>;
}

const rounded = (v: number) => Math.round(v * 10) / 10;

/**
 * Every duel measured at a rank. Each view is turned to the point of view of
 * the first hero of the pair, then the views are averaged — they agree, but
 * a rounding apart. `exists` rules out a hero missing from the catalogue.
 */
export function measuredGaps(
  counters: Record<string, CountersByRank>,
  rank: MeasuredRank,
  exists: (slug: string) => boolean,
): Record<string, number> {
  const views = new Map<string, number[]>();
  for (const [hero, byRank] of Object.entries(counters)) {
    if (!exists(hero)) continue;
    const list: CounterFigure[] = [...(byRank[rank]?.strong ?? []), ...(byRank[rank]?.weak ?? [])];
    for (const e of list) {
      if (e.slug === hero || !exists(e.slug)) continue;
      const segment = segmentPair(hero, e.slug);
      const value = orderPair(hero, e.slug)[0] === hero ? e.advantage : -e.advantage;
      views.set(segment, [...(views.get(segment) ?? []), value]);
    }
  }
  return Object.fromEntries(
    [...views]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([segment, values]) => [segment, rounded(values.reduce((s, v) => s + v, 0) / values.length)]),
  );
}

/** `hero`'s gap against `opponent`, in points; null when the duel is not measured. */
export function gapOf(gaps: Record<string, number>, hero: string, opponent: string): number | null {
  if (hero === opponent) return null;
  const value = gaps[segmentPair(hero, opponent)];
  if (value === undefined) return null;
  return orderPair(hero, opponent)[0] === hero ? value : -value;
}

/** A measured cell of the matrix, from the row hero's point of view. */
export interface Duel {
  hero: string;
  opponent: string;
  gap: number;
}

/** Measured duels of two lineups, from the most one-sided to the closest. */
export function measuredDuels(gaps: Record<string, number>, rows: string[], columns: string[]): Duel[] {
  return rows
    .flatMap((hero) =>
      columns.flatMap((opponent) => {
        const gap = gapOf(gaps, hero, opponent);
        return gap === null ? [] : [{ hero, opponent, gap }];
      }),
    )
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || a.hero.localeCompare(b.hero) || a.opponent.localeCompare(b.opponent));
}

/** Share of the possible duels measured at a rank, for the method section. */
export function coverage(gaps: Record<string, number>, heroes: number): { measured: number; possible: number } {
  return { measured: Object.keys(gaps).length, possible: (heroes * (heroes - 1)) / 2 };
}

// ── Shareable URL ──────────────────────────────────────────────────

export interface MatrixSettings {
  rows: string[];
  columns: string[];
  rank: MeasuredRank | null;
}

/**
 * Reads `?a=slug,slug&b=slug&rang=mythic`, discarding what the page does not
 * know. A hero sits on one side only: the first side that names it keeps it.
 */
export function readMatrix(search: string, known: Set<string>, ranks: readonly MeasuredRank[]): MatrixSettings {
  const params = new URLSearchParams(search);
  const side = (key: string, taken: Set<string>) =>
    [
      ...new Set(
        (params.get(key) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => known.has(s) && !taken.has(s)),
      ),
    ].slice(0, SIZE_SIDE);
  const rows = side("a", new Set());
  const columns = side("b", new Set(rows));
  return { rows, columns, rank: ranks.find((r) => r === params.get("rang")) ?? null };
}

/**
 * URL parameters for two lineups and a rank, others kept. Slugs carry no
 * reserved character: the comma stays readable. All ranks, the default, is
 * omitted.
 */
export function writeMatrix(search: string, { rows, columns, rank }: MatrixSettings): string {
  const params = new URLSearchParams(search);
  for (const key of ["a", "b", "rang"]) params.delete(key);
  if (rank && rank !== "all") params.set("rang", rank);
  return [rows.length ? `a=${rows.join(",")}` : "", columns.length ? `b=${columns.join(",")}` : "", params.toString()]
    .filter(Boolean)
    .join("&");
}
