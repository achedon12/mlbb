import type { BuildsHero, CountersByRank } from "./data";
import type { MeasuredRank } from "./measured-ranks";
import { movesWeek, type Motion, type WinStreak } from "./trends";
import type { AdjustmentType, Lane } from "./types";

/**
 * What a tier list page shows around its ranking, so that a visitor landing
 * on it from a search finds a next step: each hero's preview (who counters
 * it, what it builds), the week's movers of the lane or the role, the heroes
 * the live patch touched, and the short answer to the question the page is
 * searched for. Pure functions over the synced data, handed in by the page:
 * the tests feed them by hand.
 */

/** Counters shown in a hero's preview. */
export const PEEK_COUNTERS = 3;
/** Core items shown in a hero's preview: the three key items of a played build. */
export const PEEK_ITEMS = 3;
/** Risers and fallers shown above the ranking. */
export const MOVERS_COUNT = 3;
/** Heroes named in the short answer. */
export const ANSWER_COUNT = 3;

/**
 * The heroes this one loses to the most (its `weak` list), measured at the
 * page's rank, else across all ranks. Only heroes the catalogue knows.
 */
export function countersFor(
  byRank: CountersByRank | undefined,
  rank: MeasuredRank,
  known: (slug: string) => boolean,
  count = PEEK_COUNTERS,
): string[] {
  const measured = byRank?.[rank]?.weak.length ? byRank[rank] : byRank?.all;
  return (measured?.weak ?? [])
    .map((c) => c.slug)
    .filter(known)
    .slice(0, count);
}

/**
 * Core items of a hero: the most played build on the page's lane, else on
 * the hero's first lane that has one, else on any lane; at the page's rank,
 * else across all ranks.
 */
export function coreItemsFor(
  byLane: BuildsHero | undefined,
  lanes: readonly Lane[],
  lane: Lane | null,
  rank: MeasuredRank,
  count = PEEK_ITEMS,
): string[] {
  if (!byLane) return [];
  const chosen =
    lane && byLane[lane] ? lane : (lanes.find((l) => byLane[l]) ?? Object.keys(byLane)[0]);
  const builds = chosen ? byLane[chosen] : undefined;
  const build = builds?.[rank]?.[0] ?? builds?.all?.[0];
  return build?.items.slice(0, count) ?? [];
}

/** The week's biggest win rate rises and drops among the page's heroes. */
export function moversFor(
  slugs: readonly string[],
  series: (slug: string) => WinStreak | null | undefined,
  count = MOVERS_COUNT,
): { rises: Motion[]; drops: Motion[] } {
  return movesWeek(
    slugs.map((slug) => ({ slug, series: series(slug) })),
    count,
  );
}

export interface PatchChange {
  slug: string;
  type: AdjustmentType | null;
}

/**
 * The page's heroes a patch adjusted, in the order of the ranking, each
 * once (a patch can list a hero in two sections).
 */
export function patchChangesFor(
  adjustments: readonly { slug: string; type: AdjustmentType | null }[] | undefined,
  order: readonly string[],
): PatchChange[] {
  const bySlug = new Map<string, AdjustmentType | null>();
  for (const a of adjustments ?? []) if (!bySlug.has(a.slug)) bySlug.set(a.slug, a.type);
  return order.filter((slug) => bySlug.has(slug)).map((slug) => ({ slug, type: bySlug.get(slug) ?? null }));
}
