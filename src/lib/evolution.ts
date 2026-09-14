import generatedEvolution from "@/data/game/evolution.json";
import type { MeasuredRank } from "./measured-ranks";

/**
 * Trend of a hero's rates: daily series over thirty days per rank, win rate
 * by match duration, and a long history accumulated from one sync to the
 * next. Read only by the hero page: the file stays out of pages that do not
 * need it.
 */

/** Daily rates aligned on a start date; a missing day is null. */
export interface SeriesRate {
  start: string;
  winRate: (number | null)[];
  banRate: (number | null)[];
  pickRate: (number | null)[];
  /**
   * First day actually measured day by day, when the series starts with
   * spread-out weeks (interpolated values). A computation that needs
   * measurements, not a curve, must ignore the days before.
   */
  measuredSince?: string;
}

/**
 * History as stored: the latest days day by day, older weeks as averages
 * (see compactHistory, scripts/measures.mjs).
 * `weeks.start` is a Monday, one point every seven days.
 */
export interface HistoryStored extends SeriesRate {
  weeks?: SeriesRate;
}

/** Win rate over a match duration bucket, in minutes. */
export interface BucketDuration {
  from: number;
  /** Absent for the last, open-ended bucket ("20 min and more"). */
  to: number | null;
  winRate: number;
}

interface Evolution {
  trends: Record<string, Partial<Record<MeasuredRank, SeriesRate>>>;
  duration: Record<string, Partial<Record<MeasuredRank, BucketDuration[]>>>;
  history: Record<string, HistoryStored>;
}

const E = generatedEvolution as unknown as Evolution;

const DAY = 86400000;
const numberDay = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY);
const dateOfDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const MEASURES = ["winRate", "banRate", "pickRate"] as const;

/**
 * Turns a compacted history back into a daily series. Each weekly average is
 * placed in the middle of its week (the Thursday), and the days between two
 * known points are interpolated, up to the first day measured day by day: the
 * curve stays continuous, with no gap or step. The series starts on the first
 * Thursday — nothing is extrapolated — and the recent part is returned as is.
 * A history without weeks is already daily.
 */
export function spreadHistory(stored: HistoryStored): SeriesRate {
  const { weeks, ...daily } = stored;
  if (!weeks?.winRate.length) return daily;
  const monday = numberDay(weeks.start);
  const first = monday + 3;
  const days = numberDay(daily.start) - first;
  if (days <= 0) return daily;

  const series: SeriesRate = {
    start: dateOfDay(first),
    winRate: [],
    banRate: [],
    pickRate: [],
    measuredSince: daily.start,
  };
  for (const m of MEASURES) {
    // Known points, as day numbers: the Thursdays of the measured weeks, then
    // the first measured day of the daily part, which joins the two.
    const known = weeks[m].flatMap((v, k) => (v === null ? [] : [[monday + 7 * k + 3, v] as const]));
    const k = daily[m].findIndex((v) => v !== null);
    if (k >= 0) known.push([first + days + k, daily[m][k]!]);

    let i = 0;
    const before = Array.from({ length: days }, (_, d): number | null => {
      const day = first + d;
      while (i < known.length - 1 && known[i + 1][0] <= day) i += 1;
      const [j0, v0] = known[i] ?? [];
      const [j1, v1] = known[i + 1] ?? [];
      if (j0 === undefined || day < j0) return null;
      if (day === j0 || j1 === undefined) return day === j0 ? v0! : null;
      return Math.round((v0! + ((v1! - v0!) * (day - j0)) / (j1 - j0)) * 100) / 100;
    });
    series[m] = [...before, ...daily[m]];
  }
  return series;
}

export const trendsOf = (slug: string) => E.trends[slug] ?? {};
export const durationOf = (slug: string) => E.duration[slug] ?? {};
export const historyOf = (slug: string): SeriesRate | null =>
  E.history[slug] ? spreadHistory(E.history[slug]) : null;
