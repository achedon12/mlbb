import { patchsDetail } from "@/lib/donnees";
import type { AjustementHeros, TypeAjustement } from "@/lib/types";

/**
 * Suivi des ajustements, heros par heros : le flux RSS de chaque fiche et
 * l'alerte des favoris s'en servent.
 */

/** Patchs detailles, du plus recent au plus ancien — dans l'ordre des versions. */
export const patchsRecents = Object.values(patchsDetail).sort((a, b) =>
  b.version.localeCompare(a.version, undefined, { numeric: true }),
);

export interface AjustementDate {
  version: string;
  date: string | null;
  ajustement: AjustementHeros;
}

/** Ajustements d'un heros, patch par patch, du plus recent au plus ancien. */
export function ajustementsDe(slug: string): AjustementDate[] {
  return patchsRecents.flatMap((p) =>
    p.adjustments.filter((a) => a.slug === slug).map((ajustement) => ({ version: p.version, date: p.date ?? null, ajustement })),
  );
}

/**
 * Dernier patch reduit a l'essentiel pour les favoris : sa version, sa date et
 * le type d'ajustement de chaque heros touche. Quelques centaines d'octets
 * transmis au navigateur, la ou le patch complet en pese des dizaines de
 * milliers.
 */
export interface ResumePatch {
  version: string;
  date: string | null;
  types: Record<string, TypeAjustement | null>;
}

export function resumeDernierPatch(): ResumePatch | null {
  const p = patchsRecents[0];
  if (!p) return null;
  return { version: p.version, date: p.date ?? null, types: Object.fromEntries(p.adjustments.map((a) => [a.slug, a.type])) };
}
