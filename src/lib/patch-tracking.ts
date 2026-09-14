import { patchDetails } from "@/lib/data";
import type { HeroAdjustment, AdjustmentType } from "@/lib/types";

/**
 * Adjustment tracking, hero by hero: each hero page's RSS feed and the
 * favourites alert use it.
 */

/** Detailed patches, newest to oldest — in version order. */
export const recentPatches = Object.values(patchDetails).sort((a, b) =>
  b.version.localeCompare(a.version, undefined, { numeric: true }),
);

export interface AdjustmentDate {
  version: string;
  date: string | null;
  adjustment: HeroAdjustment;
}

/** A hero's adjustments, patch by patch, newest to oldest. */
export function adjustmentsOf(slug: string): AdjustmentDate[] {
  return recentPatches.flatMap((p) =>
    p.adjustments.filter((a) => a.slug === slug).map((adjustment) => ({ version: p.version, date: p.date ?? null, adjustment })),
  );
}

/**
 * Latest patch trimmed to the essentials for favourites: its version, its date
 * and the adjustment type of each affected hero. A few hundred bytes sent to
 * the browser, where the full patch weighs tens of thousands.
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
