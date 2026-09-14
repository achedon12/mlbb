import type { T } from "@/i18n/t";
import type { SeriesRate } from "./evolution";
import type { AdjustmentType } from "./types";

/**
 * Win rate trends: change over a week, effect of a patch,
 * series aligned to be overlaid.
 *
 * Pure computations, without reading data: server pages apply them to
 * `evolution.json`, and a client component can import them without bundling the
 * file (type imports are erased at compile time).
 */

/** Daily win rate series, aligned on its start date; a missing day is null. */
export type WinStreak = Pick<SeriesRate, "start" | "winRate" | "measuredSince">;

const DAY_MS = 86_400_000;
const time = (date: string) => Date.parse(`${date}T00:00:00Z`);
const rounded = (v: number) => Math.round(v * 100) / 100;
const average = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
const measure = (v: number | null | undefined): v is number => typeof v === "number";

/** YYYY-MM-DD date shifted by a number of days. */
export function shiftDate(date: string, days: number): string {
  return new Date(time(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Days between two YYYY-MM-DD dates (negative if `a` precedes `de`). */
export function daysBetween(de: string, a: string): number {
  return Math.round((time(a) - time(de)) / DAY_MS);
}

export interface PointDate {
  date: string;
  value: number | null;
}

/** A daily series, day by day, with its date. */
export function pointsOf(start: string, values: (number | null)[]): PointDate[] {
  return values.map((value, k) => ({ date: shiftDate(start, k), value }));
}

// ── Change over a week ──────────────────────────────────────────

/** Target gap between the two compared measurements, in days. */
const WEEK = 7;
/** When D-7 is missing, the closest measured day is accepted, within two days. */
const TOLERANCE = 2;
/** Measurements required between the two bounds, inclusive: two isolated points do not make a trend. */
const MEASURES_MIN = 4;
/** A last measurement older than this says nothing about "this week" anymore. */
const FRESHNESS = 3;

/**
 * Below this gap, in points, the change is indistinguishable from rounding:
 * the game publishes its rates to one decimal, a one-tenth gap is just noise.
 */
export const THRESHOLD_NOTABLE = 0.2;

export interface Variation {
  /** Last measured rate. */
  current: number;
  /** Rate measured one week earlier, or on the closest measured day. */
  before: number;
  /** `current - before`, in points, rounded to the hundredth. */
  gap: number;
  /** Days between the two measurements (5 to 9). */
  days: number;
  /** Date of the last measurement. */
  date: string;
}

/**
 * Win rate change over a week: last measurement against the one from
 * D-7. Missing days are ignored; without a recent measurement, without a reference
 * at D-7 (within two days) or with too few measurements in between, no
 * trend rather than a made-up trend.
 */
export function variationWeek(series: WinStreak | null | undefined): Variation | null {
  const values = series?.winRate ?? [];
  const end = values.length - 1;

  let last = -1;
  for (let i = end; i >= 0 && i >= end - FRESHNESS; i--) {
    if (measure(values[i])) {
      last = i;
      break;
    }
  }
  if (!series || last < 0) return null;

  // The measured day closest to D-7; at equal distance, the older one.
  let reference = -1;
  for (let d = 0; d <= TOLERANCE && reference < 0; d++) {
    for (const i of d === 0 ? [last - WEEK] : [last - WEEK - d, last - WEEK + d]) {
      if (i >= 0 && measure(values[i])) {
        reference = i;
        break;
      }
    }
  }
  if (reference < 0) return null;
  if (values.slice(reference, last + 1).filter(measure).length < MEASURES_MIN) return null;

  const current = values[last]!;
  const before = values[reference]!;
  return {
    current,
    before,
    gap: rounded(current - before),
    days: last - reference,
    date: shiftDate(series.start, last),
  };
}

/** True when the gap exceeds rounding noise. */
export function isNotable(v: Variation | null | undefined): v is Variation {
  return !!v && Math.abs(v.gap) >= THRESHOLD_NOTABLE - 1e-9;
}

export interface Motion {
  slug: string;
  variation: Variation;
}

/**
 * Biggest rises and drops of the week, among notable gaps. On
 * equal gap, the highest current rate (rises) or the lowest (drops)
 * comes first, then alphabetical order: the result does not depend on
 * input order.
 */
export function movesWeek(
  entries: { slug: string; series?: WinStreak | null }[],
  count = 5,
): { rises: Motion[]; drops: Motion[] } {
  const notables = entries.flatMap(({ slug, series }) => {
    const variation = variationWeek(series);
    return isNotable(variation) ? [{ slug, variation }] : [];
  });
  const rises = notables
    .filter((m) => m.variation.gap > 0)
    .sort(
      (a, b) =>
        b.variation.gap - a.variation.gap ||
        b.variation.current - a.variation.current ||
        a.slug.localeCompare(b.slug),
    );
  const drops = notables
    .filter((m) => m.variation.gap < 0)
    .sort(
      (a, b) =>
        a.variation.gap - b.variation.gap ||
        a.variation.current - b.variation.current ||
        a.slug.localeCompare(b.slug),
    );
  return { rises: rises.slice(0, count), drops: drops.slice(0, count) };
}

// ── Effect of a patch ───────────────────────────────────────────────

/** Days compared on each side of the patch. */
export const DAYS_IMPACT = 7;
/** Measured days required on each side. */
export const MEASURES_MIN_IMPACT = 4;
/**
 * Gap between averages beyond which the patch really moved the rate:
 * seven-day averages smooth out rounding, not changes in
 * player traffic from one week to the next.
 */
export const THRESHOLD_IMPACT = 0.3;

export interface ImpactPatch {
  /** Average win rate over the seven days before the patch. */
  before: number;
  /** Average win rate over the seven days after the patch. */
  after: number;
  /** `after - before`, in points. */
  gap: number;
  daysBefore: number;
  daysAfter: number;
}

/**
 * Average win rate over the seven days before and after a patch. The day
 * of the patch itself is excluded: it mixes games from before and after, and the
 * date used (notes going live) may precede the release by a day or
 * two. At least four measured days are required on each side.
 */
export function impactPatch(history: WinStreak | null | undefined, date: string | null | undefined) {
  if (!history || !date) return null;
  const dayPatch = daysBetween(history.start, date);
  if (!Number.isFinite(dayPatch)) return null;
  // Compacted weeks are interpolated day by day: they are not
  // measurements, they would smooth out the impact of an old patch.
  const firstMeasure = history.measuredSince ? Math.max(0, daysBetween(history.start, history.measuredSince)) : 0;

  const readings = (de: number, a: number) => {
    const output: number[] = [];
    for (let k = de; k <= a; k++) {
      const v = dayPatch + k >= firstMeasure ? history.winRate[dayPatch + k] : null;
      if (measure(v)) output.push(v);
    }
    return output;
  };
  const before = readings(-DAYS_IMPACT, -1);
  const after = readings(1, DAYS_IMPACT);
  if (before.length < MEASURES_MIN_IMPACT || after.length < MEASURES_MIN_IMPACT) return null;

  const impact: ImpactPatch = {
    before: rounded(average(before)),
    after: rounded(average(after)),
    gap: rounded(average(after) - average(before)),
    daysBefore: before.length,
    daysAfter: after.length,
  };
  return impact;
}

/**
 * Did the patch do what it announced? A buff should raise
 * the rate, a nerf lower it. An "adjust" has no
 * expected direction: no verdict.
 */
export type Verdict = "expected" | "neutral" | "opposite";

export function verdictImpact(type: AdjustmentType | null, gap: number): Verdict | null {
  if (type !== "buff" && type !== "nerf") return null;
  if (Math.abs(gap) < THRESHOLD_IMPACT - 1e-9) return "neutral";
  return (gap > 0) === (type === "buff") ? "expected" : "opposite";
}

export interface ImpactAdjustment extends ImpactPatch {
  version: string;
  date: string;
  type: AdjustmentType | null;
  verdict: Verdict | null;
}

function impactAdjustment(
  history: WinStreak | null | undefined,
  a: { version: string; date?: string | null; type: AdjustmentType | null },
): ImpactAdjustment | null {
  const impact = a.date ? impactPatch(history, a.date) : null;
  if (!impact || !a.date) return null;
  return { ...impact, version: a.version, date: a.date, type: a.type, verdict: verdictImpact(a.type, impact.gap) };
}

/** Measurable effect of each dated patch that touched a hero, in the order received. */
export function heroImpacts(
  history: WinStreak | null | undefined,
  adjustments: { version: string; date?: string | null; type: AdjustmentType | null }[],
): ImpactAdjustment[] {
  return adjustments.flatMap((a) => {
    const impact = impactAdjustment(history, a);
    return impact ? [impact] : [];
  });
}

/**
 * Effect of a patch on each hero it adjusts, by slug: enough to
 * annotate patch notes ("did the nerf land?"). The history is
 * read by the provided function — `historyOf` on the server.
 */
export function impactsOfPatch(
  patch: { version: string; date?: string | null; adjustments: { slug: string; type: AdjustmentType | null }[] },
  historyOf: (slug: string) => WinStreak | null | undefined,
): Record<string, ImpactAdjustment> {
  const output: Record<string, ImpactAdjustment> = {};
  if (!patch.date) return output;
  for (const a of patch.adjustments) {
    const impact = impactAdjustment(historyOf(a.slug), { version: patch.version, date: patch.date, type: a.type });
    if (impact) output[a.slug] = impact;
  }
  return output;
}

// ── Overlaid series ─────────────────────────────────────────────

/**
 * Aligns daily series on the same dates: the union of their days,
 * a day missing from a series being null. Two heroes synced on different
 * dates can thus be read on the same axis.
 */
export function alignSeries(series: { start: string; values: (number | null)[] }[]): {
  dates: string[];
  values: (number | null)[][];
} {
  const present = series.filter((s) => s.values.length > 0);
  if (present.length === 0) return { dates: [], values: series.map(() => []) };

  const start = present.map((s) => s.start).sort()[0]!;
  const end = present.map((s) => shiftDate(s.start, s.values.length - 1)).sort().at(-1)!;
  const dates = Array.from({ length: daysBetween(start, end) + 1 }, (_, k) => shiftDate(start, k));
  const values = series.map((s) => {
    const offset = daysBetween(start, s.start);
    return dates.map((_, k) => (k - offset >= 0 ? (s.values[k - offset] ?? null) : null));
  });
  return { dates, values };
}

// ── Display ──────────────────────────────────────────────────────

/** Signed gap, in the locale's format: "+0,7", "-0.3", "0,0". */
export function formatGap(gap: number, locale: string, decimals = 1): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: "exceptZero",
  }).format(gap);
}

/**
 * Unit form depending on the displayed value and the locale: "0,7 point" in
 * French, "0.7 points" in English.
 */
export function plural(value: number, locale: string, decimals = 1): "one" | "other" {
  const shown = Math.abs(Number(value.toFixed(decimals)));
  return new Intl.PluralRules(locale, { minimumFractionDigits: decimals }).select(shown) === "one" ? "one" : "other";
}

/**
 * Gap spelled out, for screen readers: "up 0.7
 * points in 7 days" rather than an arrow and an abbreviation.
 */
export function describeGap(t: T, locale: string, gap: number, days: number): string {
  const v = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(gap));
  return t(gap > 0 ? "trends.rise" : "trends.fall", {
    v,
    unite: t(`trends.point.${plural(gap, locale)}`),
    n: days,
  });
}
