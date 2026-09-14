/**
 * Formatting of player figures, shared by the server and the browser.
 *
 * Deliberately lightweight module: the match list, rendered client-side,
 * imports it without bundling the site data.
 */
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import type { Lane } from "./types";

const FORMATS = new Map<string, Intl.NumberFormat>();

function format(siteLocale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${siteLocale}:${JSON.stringify(options)}`;
  let f = FORMATS.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE_HTML[siteLocale], options);
    FORMATS.set(key, f);
  }
  return f;
}

/** Rate in points (0 to 100), rendered as a percentage: "62.5%". */
export function formatPercent(points: number, siteLocale: Locale): string {
  return format(siteLocale, { style: "percent", maximumFractionDigits: 1 }).format(points / 100);
}

export function formatCount(n: number, siteLocale: Locale, decimals = 0): string {
  return format(siteLocale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

/** Signed gap, in points: "+4.2", "-3". */
export function formatGap(points: number, siteLocale: Locale): string {
  return format(siteLocale, { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(points);
}

/** Form to use for a number, according to the language's plural rules. */
export function plural(n: number, siteLocale: Locale): "one" | "other" {
  return new Intl.PluralRules(LOCALE_HTML[siteLocale]).select(n) === "one" ? "one" : "other";
}

/** Ratio (eliminations + assists) / deaths, counting at least one death. */
export function ratioKda(eliminations: number, deaths: number, assists: number): number {
  return (eliminations + assists) / Math.max(1, deaths);
}

/** Lane reported by the service (`lid`), mapped to the site lane. */
export const GAME_LANE: Record<number, Lane> = { 1: "Exp", 2: "Mid", 3: "Roam", 4: "Jungle", 5: "Gold" };

/**
 * Date of a match.
 *
 * The server does not know the reader's time zone: it renders the day alone,
 * in UTC, and the browser adds the local time once the page is hydrated
 * (`locale`). The year only appears for a season from another year.
 */
export function formatDateMatch(seconds: number, siteLocale: Locale, locale: boolean): string {
  const date = new Date(seconds * 1000);
  const otherYear = date.getUTCFullYear() !== new Date().getUTCFullYear();
  const options: Intl.DateTimeFormatOptions = locale
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", timeZone: "UTC" };
  if (otherYear) options.year = "numeric";
  return new Intl.DateTimeFormat(LOCALE_HTML[siteLocale], options).format(date);
}
