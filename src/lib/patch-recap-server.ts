import { patchDetails } from "./data";
import { historyOf } from "./evolution";
import { patchRecap, hasRecap, type PatchRecap } from "./patch-recap";
import { DAYS_IMPACT, impactsOfPatch, shiftDate, type ImpactAdjustment } from "./trends";
import type { DetailedPatch } from "./types";

/**
 * The recap of a patch read from the synced data: the notes
 * (`patchDetails`) and the daily rate history (`historyOf`).
 */

export interface RecapOfPatch {
  patch: DetailedPatch;
  recap: PatchRecap;
  impacts: Record<string, ImpactAdjustment>;
  /** No measure yet, but the week after the patch is not over: the recap will come. */
  soon: boolean;
}

const patchOf = (version: string): DetailedPatch | undefined =>
  Object.hasOwn(patchDetails, version) ? patchDetails[version] : undefined;

export function recapOf(version: string, today = new Date().toISOString().slice(0, 10)): RecapOfPatch | null {
  const patch = patchOf(version);
  if (!patch) return null;
  const impacts = impactsOfPatch(patch, historyOf);
  const recap = patchRecap(patch.adjustments, impacts);
  const soon = !hasRecap(recap) && Boolean(patch.date) && shiftDate(patch.date!, DAYS_IMPACT + 1) >= today;
  return { patch, recap, impacts, soon };
}

/** Versions whose recap has at least one measured hero: the ones the sitemap lists. */
export function recapVersions(): string[] {
  return Object.keys(patchDetails).filter((v) => {
    const r = recapOf(v);
    return r !== null && hasRecap(r.recap);
  });
}
