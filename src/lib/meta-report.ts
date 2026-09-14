import { variationWeek, type WinStreak } from "./trends";
import type { HeroAdjustment, Tier, AdjustmentType } from "./types";

/**
 * Calculs du rapport meta de la semaine et du resume des patchs.
 *
 * Fonctions pures : la regle de la tier list (score, palier) est fournie par
 * l'appelant, comme l'historique l'est a `impactsDuPatch`. Les tests en
 * donnent une version simplifiee, sans lire les donnees du jeu.
 */

const ORDER: Tier[] = ["S+", "S", "A", "B", "C"];

/** Taux quotidiens d'un heros : victoire et ban, un jour manquant valant null. */
export interface SeriesTier {
  start: string;
  winRate: (number | null)[];
  banRate: (number | null)[];
}

export interface ChangeTier {
  slug: string;
  before: Tier;
  after: Tier;
  /** Paliers franchis, positif pour une montee. */
  gap: number;
  /** Score actuel, pour departager. */
  score: number;
  /** Jours separant les deux mesures. */
  days: number;
}

/**
 * Heros qui ont change de palier en une semaine. Le score du jour et celui de
 * J-7 sont recalcules sur les series quotidiennes, par la regle de la tier
 * list, avec la tolerance de `variationSemaine` sur les jours manquants.
 *
 * Les series sont arrondies au dixieme, le classement non : un heros pose sur
 * une borne pourrait changer de palier d'une source a l'autre sans que rien
 * n'ait bouge. On ne retient donc un changement que si le palier recalcule du
 * jour est bien celui de la tier list affichee.
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

/** Sens d'un ajustement pour les listes : un type inconnu compte comme simple ajustement. */
export type AdjustmentDirection = AdjustmentType;
export const ADJUSTMENT_DIRECTIONS: AdjustmentDirection[] = ["buff", "nerf", "adjust"];

/**
 * Heros touches par un patch, par sens : ameliores, affaiblis, ajustes. Un
 * heros cite deux fois (competence puis attributs) n'apparait qu'une fois, a
 * sa premiere mention.
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

/** Les `nombre` premiers d'une liste selon une mesure, du plus haut au plus bas, a egalite par slug. */
export function firstNBy<E extends { hero: { slug: string } }>(
  entries: E[],
  measure: (e: E) => number,
  count = 5,
): E[] {
  return [...entries]
    .sort((a, b) => measure(b) - measure(a) || a.hero.slug.localeCompare(b.hero.slug))
    .slice(0, count);
}
