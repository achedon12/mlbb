import { variationWeek, type WinStreak } from "./trends";
import type { HeroAdjustment, Tier, AdjustmentType } from "./types";

/**
 * Computations for the weekly meta report and the patch summary.
 *
 * Pure functions: the tier list rule (score, tier) is supplied by the caller,
 * just as the history is to `impactsOfPatch`. Tests pass a simplified version,
 * without reading game data.
 */

const ORDER: Tier[] = ["S+", "S", "A", "B", "C"];

/** A hero's daily rates: win and ban, a missing day being null. */
export interface SeriesTier {
  start: string;
  winRate: (number | null)[];
  banRate: (number | null)[];
}

export interface ChangeTier {
  slug: string;
  before: Tier;
  after: Tier;
  /** Tiers crossed, positive for a climb. */
  gap: number;
  /** Current score, for tie-breaking. */
  score: number;
  /** Days between the two measurements. */
  days: number;
}

/**
 * Heroes that changed tier within a week. Today's score and the D-7 score
 * are recomputed from the daily series, using the tier list rule, with the
 * tolerance of `variationWeek` for missing days.
 *
 * Series are rounded to one decimal, the ranking is not: a hero sitting on a
 * boundary could change tier from one source to the other without anything
 * having moved. A change is therefore kept only if today's recomputed tier
 * matches the one in the displayed tier list.
 */
export function changesOfTier(
  entries: { slug: string; series?: SeriesTier | null; tierCurrent?: Tier | null }[],
  rule: { score: (t: { winRate: number; banRate: number }) => number; tier: (score: number) => Tier },
): { climbs: ChangeTier[]; drops: ChangeTier[] } {
  const changes = entries.flatMap(({ slug, series, tierCurrent }) => {
    if (!series || !tierCurrent) return [];
    const scores = series.winRate.map((v, i) => {
      const b = series.banRate[i];
      return typeof v === "number" && typeof b === "number" ? rule.score({ winRate: v, banRate: b }) : null;
    });
    const variation = variationWeek({ start: series.start, winRate: scores } satisfies WinStreak);
    if (!variation) return [];
    const before = rule.tier(variation.before);
    const after = rule.tier(variation.current);
    if (after !== tierCurrent || before === after) return [];
    const change: ChangeTier = {
      slug,
      before,
      after,
      gap: ORDER.indexOf(before) - ORDER.indexOf(after),
      score: variation.current,
      days: variation.days,
    };
    return [change];
  });
  const sort = (a: ChangeTier, b: ChangeTier) =>
    Math.abs(b.gap) - Math.abs(a.gap) || b.score - a.score || a.slug.localeCompare(b.slug);
  return {
    climbs: changes.filter((c) => c.gap > 0).sort(sort),
    drops: changes.filter((c) => c.gap < 0).sort(sort),
  };
}

/** Direction of an adjustment for lists: an unknown type counts as a plain adjustment. */
export type AdjustmentDirection = AdjustmentType;
export const ADJUSTMENT_DIRECTIONS: AdjustmentDirection[] = ["buff", "nerf", "adjust"];

/**
 * Heroes affected by a patch, by direction: buffed, nerfed, adjusted. A hero
 * mentioned twice (skill then attributes) appears only once, at its first
 * mention.
 */
export function groupAdjustments<A extends Pick<HeroAdjustment, "slug" | "type">>(
  adjustments: A[],
): Record<AdjustmentDirection, A[]> {
  const groups: Record<AdjustmentDirection, A[]> = { buff: [], nerf: [], adjust: [] };
  const seen = new Set<string>();
  for (const a of adjustments) {
    if (seen.has(a.slug)) continue;
    seen.add(a.slug);
    groups[a.type ?? "adjust"].push(a);
  }
  return groups;
}

/** The first `count` entries of a list by a measure, highest to lowest, ties broken by slug. */
export function firstNBy<E extends { hero: { slug: string } }>(
  entries: E[],
  measure: (e: E) => number,
  count = 5,
): E[] {
  return [...entries]
    .sort((a, b) => measure(b) - measure(a) || a.hero.slug.localeCompare(b.hero.slug))
    .slice(0, count);
}
