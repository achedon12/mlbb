import statistics from "@/data/game/statistics.json";
import { notesTierList } from "@/data/tier-list";
import { allHeroes } from "./data";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";
import type { Hero, Tier } from "./types";

/**
 * Computed tier list.
 *
 * It no longer relies on opinion but on the rates reported by the game:
 * win, ban and pick. The ranking therefore rebuilds itself on every
 * sync, and follows patches without intervention.
 *
 * The score combines two signals that say different things:
 *
 * - the **win rate** measures what the hero delivers once played;
 * - the **ban rate** measures what players fear, which captures the
 *   heroes too strong to be left available — precisely those whose win
 *   rate is misleadingly low because they are rarely available.
 *
 * The pick rate does not enter the score: it measures popularity,
 * not power. It is only used to judge how far a win rate can be trusted:
 * flagging the fragile measurements, and ordering heroes inside a tier
 * (see `winRateAdjusted`).
 */
export interface RankedEntry {
  hero: Hero;
  tier: Tier;
  winRate: number;
  banRate: number;
  pickRate: number;
  score: number;
  /**
   * Same score with the win rate pulled toward 50 % by the sample size:
   * orders heroes inside a tier, never displayed.
   */
  scoreAdjusted: number;
  /** True when the hero is played too little for its rates to be stable. */
  lowSample: boolean;
  /** Hand-written comment, when there is one. */
  comment: string | null;
}

interface Rate {
  winRate: number;
  banRate: number;
  pickRate: number;
}

interface Ranking {
  /** Date the rates were collected, distinct from the sync. */
  measuredAt: string;
  rates: Record<string, Rate>;
  /** Same rates, rank by rank. Absent from a file predating this split. */
  byRank?: Partial<Record<MeasuredRank, Record<string, Rate>>>;
}

const RANKING = statistics.rankings as unknown as Ranking;
const RATE = RANKING.rates;

/** Collection date, to display rather than the last sync date. */
export const measure = RANKING.measuredAt;

/** Below this pick rate, measurements become noisy. */
export const THRESHOLD_RELIABILITY = 0.3;

/**
 * A win rate drawn from few games overstates its gap to 50 %. The pick
 * rate weighs it as a sample size: the gap keeps the share
 * `pick / (pick + THRESHOLD_RELIABILITY)`, so a hero at the reliability
 * threshold keeps half of it, a hero picked in 2 % of drafts nearly all.
 * The ban rate is measured over every game and is not corrected.
 */
export function winRateAdjusted(winRate: number, pickRate: number): number {
  const p = Math.max(pickRate, 0);
  return 50 + (winRate - 50) * (p / (p + THRESHOLD_RELIABILITY));
}

/**
 * Win rate points the sample correction may remove before the measure is
 * called fragile: above it, the hero's standing rests on too few games
 * even when it clears the pick threshold (a 58 % win rate at 0.5 % pick).
 */
export const GAP_FRAGILE = 2;

/** Too few games for the rates to support a conclusion. */
export function isFragile(t: Pick<Rate, "winRate" | "pickRate">): boolean {
  return (
    t.pickRate < THRESHOLD_RELIABILITY ||
    Math.abs(t.winRate - winRateAdjusted(t.winRate, t.pickRate)) >= GAP_FRAGILE
  );
}

/**
 * A ban costs the enemy team a pick: a hero banned one game in two
 * weighs as much as a hero winning a few more points. A quarter is the
 * ratio that best reproduces the priorities observed in ranked queue.
 */
export const WEIGHT_BAN = 0.25;

function score(t: Pick<Rate, "winRate" | "banRate">): number {
  return t.winRate + t.banRate * WEIGHT_BAN;
}

export const ORDER_TIERS: Tier[] = ["S+", "S", "A", "B", "C"];

/** Tier bounds, in score points. */
export const TIERS: [Tier, number][] = [
  ["S+", 56],
  ["S", 53],
  ["A", 50.5],
  ["B", 48],
  ["C", -Infinity],
];

function tier(value: number): Tier {
  return TIERS.find(([, threshold]) => value >= threshold)?.[0] ?? "C";
}

/** The tier list rule, for rates from another date (tier changes in the meta report). */
export const ruleTierList = { score, tier };

/**
 * Order of a ranking: by tier, the tier itself following the raw score
 * (the bounds of the methodology page); inside a tier, the reliably
 * measured heroes first, each group by its sample-adjusted score. A hero
 * with a striking win rate over a handful of games keeps its tier and its
 * numbers, but no longer heads the list.
 */
function compareEntries(a: RankedEntry, b: RankedEntry): number {
  return (
    ORDER_TIERS.indexOf(a.tier) - ORDER_TIERS.indexOf(b.tier) ||
    Number(a.lowSample) - Number(b.lowSample) ||
    b.scoreAdjusted - a.scoreAdjusted ||
    b.score - a.score
  );
}

function rankEntries(rate: Record<string, Rate>): RankedEntry[] {
  return allHeroes
    .filter((h) => rate[h.slug])
    .map((h) => {
      const t = rate[h.slug];
      const value = score(t);
      const adjusted = score({ winRate: winRateAdjusted(t.winRate, t.pickRate), banRate: t.banRate });

      return {
        hero: h,
        tier: tier(value),
        winRate: t.winRate,
        banRate: t.banRate,
        pickRate: t.pickRate,
        score: Math.round(value * 100) / 100,
        scoreAdjusted: Math.round(adjusted * 100) / 100,
        lowSample: isFragile(t),
        comment: notesTierList[h.slug] ?? null,
      };
    })
    .sort(compareEntries);
}

/**
 * The hero a page puts forward as "n°1": the first reliably measured one.
 * The ranking already lists them first in each tier; this also covers a
 * tier made only of fragile measures.
 */
export function leaderOf<E extends Pick<RankedEntry, "lowSample">>(entries: readonly E[]): E | undefined {
  return entries.find((e) => !e.lowSample) ?? entries[0];
}

/** The first `n` reliably measured heroes, completed by the others if too few. */
export function leadersOf<E extends Pick<RankedEntry, "lowSample">>(entries: readonly E[], n: number): E[] {
  const reliable = entries.filter((e) => !e.lowSample);
  return [...reliable, ...entries.filter((e) => e.lowSample)].slice(0, n);
}

export const rankingFull = rankEntries(RATE);

/** Rates and tier of a hero in a given rank. */
export interface StatsRank {
  winRate: number;
  banRate: number;
  pickRate: number;
  tier: Tier;
}

/**
 * The tier list rule, applied to each rank bracket: a hero can
 * be S in Mythic and only A across all ranks.
 */
const RANKINGS_BY_RANK = new Map(
  MEASURED_RANKS.flatMap((r) => {
    const rate = r === "all" ? RATE : RANKING.byRank?.[r];
    return rate
      ? [[r, new Map(rankEntries(rate).map((e) => [e.hero.slug, e]))] as const]
      : [];
  }),
);

export function statsByRank(
  slug: string,
): Partial<Record<MeasuredRank, StatsRank>> {
  const output: Partial<Record<MeasuredRank, StatsRank>> = {};
  for (const [rank, entries] of RANKINGS_BY_RANK) {
    const e = entries.get(slug);
    if (e)
      output[rank] = { winRate: e.winRate, banRate: e.banRate, pickRate: e.pickRate, tier: e.tier };
  }
  return output;
}

/** Rates and tier per hero, to enrich the catalogue without recomputing it. */
export const rateBySlug = new Map(
  rankingFull.map((e) => [
    e.hero.slug,
    {
      win: e.winRate,
      ban: e.banRate,
      tier: e.tier,
      weakSample: e.lowSample,
    },
  ]),
);

/** Ranks that have their own ranking, all ranks first. */
export const RANKS_CLASSES = MEASURED_RANKS.filter((r) => RANKINGS_BY_RANK.has(r));

/** Ranking of a rank bracket, from strongest to weakest. */
export function rankingOfRank(rank: MeasuredRank): RankedEntry[] {
  return [...(RANKINGS_BY_RANK.get(rank)?.values() ?? [])];
}
