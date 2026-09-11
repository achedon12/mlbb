import { variationSemaine, type SerieVictoire } from "./tendances";
import type { AjustementHeros, Palier, TypeAjustement } from "./types";

/**
 * Calculs du rapport meta de la semaine et du resume des patchs.
 *
 * Fonctions pures : la regle de la tier list (score, palier) est fournie par
 * l'appelant, comme l'historique l'est a `impactsDuPatch`. Les tests en
 * donnent une version simplifiee, sans lire les donnees du jeu.
 */

const ORDRE: Palier[] = ["S+", "S", "A", "B", "C"];

/** Taux quotidiens d'un heros : victoire et ban, un jour manquant valant null. */
export interface SerieTier {
  debut: string;
  victoire: (number | null)[];
  ban: (number | null)[];
}

export interface ChangementPalier {
  slug: string;
  avant: Palier;
  apres: Palier;
  /** Paliers franchis, positif pour une montee. */
  ecart: number;
  /** Score actuel, pour departager. */
  score: number;
  /** Jours separant les deux mesures. */
  jours: number;
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
export function changementsDePalier(
  entrees: { slug: string; serie?: SerieTier | null; palierActuel?: Palier | null }[],
  regle: { score: (t: { victoire: number; ban: number }) => number; palier: (score: number) => Palier },
): { montees: ChangementPalier[]; descentes: ChangementPalier[] } {
  const changements = entrees.flatMap(({ slug, serie, palierActuel }) => {
    if (!serie || !palierActuel) return [];
    const scores = serie.victoire.map((v, i) => {
      const b = serie.ban[i];
      return typeof v === "number" && typeof b === "number" ? regle.score({ victoire: v, ban: b }) : null;
    });
    const variation = variationSemaine({ debut: serie.debut, victoire: scores } satisfies SerieVictoire);
    if (!variation) return [];
    const avant = regle.palier(variation.avant);
    const apres = regle.palier(variation.actuel);
    if (apres !== palierActuel || avant === apres) return [];
    const changement: ChangementPalier = {
      slug,
      avant,
      apres,
      ecart: ORDRE.indexOf(avant) - ORDRE.indexOf(apres),
      score: variation.actuel,
      jours: variation.jours,
    };
    return [changement];
  });
  const tri = (a: ChangementPalier, b: ChangementPalier) =>
    Math.abs(b.ecart) - Math.abs(a.ecart) || b.score - a.score || a.slug.localeCompare(b.slug);
  return {
    montees: changements.filter((c) => c.ecart > 0).sort(tri),
    descentes: changements.filter((c) => c.ecart < 0).sort(tri),
  };
}

/** Sens d'un ajustement pour les listes : un type inconnu compte comme simple ajustement. */
export type SensAjustement = TypeAjustement;
export const SENS_AJUSTEMENT: SensAjustement[] = ["amelioration", "affaiblissement", "ajustement"];

/**
 * Heros touches par un patch, par sens : ameliores, affaiblis, ajustes. Un
 * heros cite deux fois (competence puis attributs) n'apparait qu'une fois, a
 * sa premiere mention.
 */
export function grouperAjustements<A extends Pick<AjustementHeros, "slug" | "type">>(
  ajustements: A[],
): Record<SensAjustement, A[]> {
  const groupes: Record<SensAjustement, A[]> = { amelioration: [], affaiblissement: [], ajustement: [] };
  const vus = new Set<string>();
  for (const a of ajustements) {
    if (vus.has(a.slug)) continue;
    vus.add(a.slug);
    groupes[a.type ?? "ajustement"].push(a);
  }
  return groupes;
}

/** Les `nombre` premiers d'une liste selon une mesure, du plus haut au plus bas, a egalite par slug. */
export function premiersSelon<E extends { heros: { slug: string } }>(
  entrees: E[],
  mesure: (e: E) => number,
  nombre = 5,
): E[] {
  return [...entrees]
    .sort((a, b) => mesure(b) - mesure(a) || a.heros.slug.localeCompare(b.heros.slug))
    .slice(0, nombre);
}
