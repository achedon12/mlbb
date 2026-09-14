import statistics from "@/data/game/statistics.json";
import { notesTierList } from "@/data/tier-list";
import { allHeroes } from "./data";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";
import type { Hero, Tier } from "./types";

/**
 * Tier list calculee.
 *
 * Elle ne repose plus sur une opinion mais sur les taux remontes par le jeu :
 * victoire, ban et selection. Le classement se refait donc tout seul a chaque
 * synchronisation, et suit les patchs sans intervention.
 *
 * Le score combine deux signaux qui disent des choses differentes :
 *
 * - le **taux de victoire** mesure ce que le heros produit une fois joue ;
 * - le **taux de ban** mesure ce que les joueurs redoutent, ce qui capte les
 *   heros trop forts pour etre laisses libres — precisement ceux dont le taux
 *   de victoire est trompeusement bas parce qu'ils sont rarement disponibles.
 *
 * Le taux de selection n'entre pas dans le score : il mesure la popularite,
 * pas la puissance. Il sert uniquement a signaler les mesures peu fiables.
 */
export interface RankedEntry {
  hero: Hero;
  tier: Tier;
  winRate: number;
  banRate: number;
  pickRate: number;
  score: number;
  /** Vrai quand le heros est trop peu joue pour que ses taux soient stables. */
  lowSample: boolean;
  /** Commentaire ecrit a la main, quand il existe. */
  comment: string | null;
}

interface Rate {
  winRate: number;
  banRate: number;
  pickRate: number;
}

interface Ranking {
  /** Date a laquelle les taux ont ete releves, distincte de la synchronisation. */
  measuredAt: string;
  rates: Record<string, Rate>;
  /** Memes taux, rang par rang. Absent d'un fichier anterieur a ce decoupage. */
  byRank?: Partial<Record<MeasuredRank, Record<string, Rate>>>;
}

const RANKING = statistics.rankings as unknown as Ranking;
const RATE = RANKING.rates;

/** Date du releve, a afficher plutot que celle de la derniere synchronisation. */
export const measure = RANKING.measuredAt;

/** En dessous de ce taux de selection, les mesures deviennent bruitees. */
const THRESHOLD_RELIABILITY = 0.3;

/**
 * Un ban coute un choix a l'equipe adverse : un heros banni une fois sur deux
 * pese autant qu'un heros qui gagne quelques points de plus. Le quart est le
 * rapport qui reproduit le mieux les priorites observees en file classee.
 */
const WEIGHT_BAN = 0.25;

function score(t: Pick<Rate, "winRate" | "banRate">): number {
  return t.winRate + t.banRate * WEIGHT_BAN;
}

/** Bornes de palier, en points de score. */
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

/** La regle de la tier list, pour des taux d'une autre date (changements de palier du rapport meta). */
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

/** Taux et palier d'un heros dans un rang donne. */
export interface StatsRank {
  winRate: number;
  banRate: number;
  tier: Tier;
}

/**
 * La regle de la tier list, appliquee a chaque tranche de rang : un heros peut
 * etre S en Mythique et seulement A tous rangs confondus.
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

/** Taux et palier par heros, pour enrichir le catalogue sans le recalculer. */
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

/** Rangs qui ont leur propre classement, tous rangs confondus en tete. */
export const RANKS_CLASSES = MEASURED_RANKS.filter((r) => RANKINGS_BY_RANK.has(r));

/** Classement d'une tranche de rang, du plus fort au plus faible. */
export function rankingOfRank(rank: MeasuredRank): RankedEntry[] {
  return [...(RANKINGS_BY_RANK.get(rank)?.values() ?? [])];
}
