import { DAYS_IMPACT, THRESHOLD_IMPACT, type ImpactAdjustment } from "./trends";
import type { AdjustmentType } from "./types";

/**
 * The recap of a patch ("Bilan du patch"): what the win rates did once the
 * patch was live, chapter by chapter. Only measured facts: each hero's
 * seven-day averages before and after (`impactsOfPatch`), nothing guessed
 * for a hero the history does not cover.
 *
 * - winners: the largest rises past the noise (`THRESHOLD_IMPACT`);
 * - losers: the largest drops past the noise;
 * - surprises: a buff that lost ground or a nerf that gained some
 *   (`verdict: "opposite"`), then the changes that moved nothing.
 *
 * Pure: the page passes the impacts it read, the tests pass their own.
 */

/** Heroes per chapter. */
export const RECAP_SIZE = 3;
/**
 * Below this many measured heroes, the recap says its sample is small: two
 * or three heroes do not tell what a patch did to the game.
 */
export const RECAP_MIN_SAMPLE = 5;

export interface RecapEntry {
  slug: string;
  type: AdjustmentType | null;
  before: number;
  after: number;
  gap: number;
}

/** "none": nothing measured; "small": under `RECAP_MIN_SAMPLE`; "ok": enough to read. */
export type RecapSample = "none" | "small" | "ok";

export interface PatchRecap {
  winners: RecapEntry[];
  losers: RecapEntry[];
  /** Buffs that fell, nerfs that rose. */
  surprises: RecapEntry[];
  /** Buffs and nerfs within the noise. */
  flat: RecapEntry[];
  /** Distinct heroes the patch adjusts. */
  adjusted: number;
  /** Of those, heroes with a measure on both sides. */
  measured: number;
  sample: RecapSample;
  /** Fewer measured days after the patch than `DAYS_IMPACT`, for one hero at least: the patch is still young. */
  young: boolean;
  /** Mean gap of the buffs and of the nerfs measured; null when none. */
  meanBuff: number | null;
  meanNerf: number | null;
}

const EPS = 1e-9;
const rounded = (v: number) => Math.round(v * 100) / 100;
const mean = (list: number[]) => (list.length ? rounded(list.reduce((a, b) => a + b, 0) / list.length) : null);
const byGap = (a: RecapEntry, b: RecapEntry) => b.gap - a.gap || a.slug.localeCompare(b.slug);
const bySize = (a: RecapEntry, b: RecapEntry) => Math.abs(b.gap) - Math.abs(a.gap) || a.slug.localeCompare(b.slug);

export function patchRecap(
  adjustments: { slug: string; type: AdjustmentType | null }[],
  impacts: Record<string, ImpactAdjustment>,
  size = RECAP_SIZE,
): PatchRecap {
  const slugs = [...new Set(adjustments.map((a) => a.slug))];
  const entries: (RecapEntry & { verdict: ImpactAdjustment["verdict"]; daysAfter: number })[] = slugs.flatMap((slug) => {
    const i = Object.hasOwn(impacts, slug) ? impacts[slug] : undefined;
    return i ? [{ slug, type: i.type, before: i.before, after: i.after, gap: i.gap, verdict: i.verdict, daysAfter: i.daysAfter }] : [];
  });
  const plain = ({ slug, type, before, after, gap }: RecapEntry): RecapEntry => ({ slug, type, before, after, gap });

  const winners = entries.filter((e) => e.gap >= THRESHOLD_IMPACT - EPS).sort(byGap).slice(0, size).map(plain);
  const losers = entries
    .filter((e) => e.gap <= -THRESHOLD_IMPACT + EPS)
    .sort((a, b) => a.gap - b.gap || a.slug.localeCompare(b.slug))
    .slice(0, size)
    .map(plain);
  const surprises = entries.filter((e) => e.verdict === "opposite").sort(bySize).slice(0, size).map(plain);
  const flat = entries.filter((e) => e.verdict === "neutral").sort(bySize).slice(0, size).map(plain);
  const measured = entries.length;

  return {
    winners,
    losers,
    surprises,
    flat,
    adjusted: slugs.length,
    measured,
    sample: measured === 0 ? "none" : measured < RECAP_MIN_SAMPLE ? "small" : "ok",
    young: entries.some((e) => e.daysAfter < DAYS_IMPACT),
    meanBuff: mean(entries.filter((e) => e.type === "buff").map((e) => e.gap)),
    meanNerf: mean(entries.filter((e) => e.type === "nerf").map((e) => e.gap)),
  };
}

/** Whether a recap has anything to tell: the page and the sitemap only list those. */
export const hasRecap = (recap: Pick<PatchRecap, "measured">) => recap.measured > 0;
