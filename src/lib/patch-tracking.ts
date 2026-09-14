import { patchDetails } from "@/lib/data";
import type { HeroAdjustment, AdjustmentType } from "@/lib/types";

/**
 * Suivi des ajustements, heros par heros : le flux RSS de chaque fiche et
 * l'alerte des favoris s'en servent.
 */

/** Patchs detailles, du plus recent au plus ancien — dans l'ordre des versions. */
export const recentPatches = Object.values(patchDetails).sort((a, b) =>
  b.version.localeCompare(a.version, undefined, { numeric: true }),
);

export interface AdjustmentDate {
  version: string;
  date: string | null;
  adjustment: HeroAdjustment;
}

/** Ajustements d'un heros, patch par patch, du plus recent au plus ancien. */
export function adjustmentsOf(slug: string): AdjustmentDate[] {
  return recentPatches.flatMap((p) =>
    p.adjustments.filter((a) => a.slug === slug).map((adjustment) => ({ version: p.version, date: p.date ?? null, adjustment })),
  );
}

/**
 * Dernier patch reduit a l'essentiel pour les favoris : sa version, sa date et
 * le type d'ajustement de chaque heros touche. Quelques centaines d'octets
 * transmis au navigateur, la ou le patch complet en pese des dizaines de
 * milliers.
 */
export interface SummaryPatch {
  version: string;
  date: string | null;
  types: Record<string, AdjustmentType | null>;
}

export function summaryLastPatch(): SummaryPatch | null {
  const p = recentPatches[0];
  if (!p) return null;
  return { version: p.version, date: p.date ?? null, types: Object.fromEntries(p.adjustments.map((a) => [a.slug, a.type])) };
}
