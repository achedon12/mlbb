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
 * not power. It is only used to flag unreliable measurements.
 */
export interface RankedEntry {
  hero: Hero;
  tier: Tier;
  winRate: number;
  banRate: number;
  pickRate: number;
  score: number;
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
const THRESHOLD_RELIABILITY = 0.3;

/**
 * A ban costs the enemy team a pick: a hero banned one game in two
 * weighs as much as a hero winning a few more points. A quarter is the
 * ratio that best reproduces the priorities observed in ranked queue.
 */
const WEIGHT_BAN = 0.25;

function score(t: Pick<Rate, "winRate" | "banRate">): number {
  return t.winRate + t.banRate * WEIGHT_BAN;
}

/** Tier bounds, in score points. */
const TIERS: [Tier, number][] = [
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

function rankEntries(rate: Record<string, Rate>): RankedEntry[] {
  return allHeroes
    .filter((h) => rate[h.slug])
    .map((h) => {
      const t = rate[h.slug];
      const value = score(t);

      return {
        hero: h,
        tier: tier(value),
        winRate: t.winRate,
        banRate: t.banRate,
        pickRate: t.pickRate,
        score: Math.round(value * 100) / 100,
        lowSample: t.pickRate < THRESHOLD_RELIABILITY,
        comment: notesTierList[h.slug] ?? null,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export const rankingFull = rankEntries(RATE);

/** Rates and tier of a hero in a given rank. */
export interface StatsRank {
  winRate: number;
  banRate: number;
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
      output[rank] = { winRate: e.winRate, banRate: e.banRate, tier: e.tier };
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

export const ORDER_TIERS: Tier[] = ["S+", "S", "A", "B", "C"];

/** Ranks that have their own ranking, all ranks first. */
export const RANKS_CLASSES = MEASURED_RANKS.filter((r) => RANKINGS_BY_RANK.has(r));

/** Ranking of a rank bracket, from strongest to weakest. */
export function rankingOfRank(rank: MeasuredRank): RankedEntry[] {
  return [...(RANKINGS_BY_RANK.get(rank)?.values() ?? [])];
}
