import { buildsPlayed, itemsFor, patchDetails } from "./data";
import { measure } from "./tier-list";
import { visualItem } from "./build-visuals";
import type { AdjustmentType } from "./types";
import type { Locale } from "@/i18n/config";

/** A patch's hero adjustments, by direction: buffed, nerfed, other. */
export function countAdjustments(adjustments: { type: AdjustmentType | null }[]) {
  const buffs = adjustments.filter((a) => a.type === "buff").length;
  const nerfs = adjustments.filter((a) => a.type === "nerf").length;
  return { buffs, nerfs, autres: adjustments.length - buffs - nerfs };
}

/**
 * Freshness markers of the data pages: current patch and measurement date.
 *
 * Results leading to "tier list", "build" or "counter" all carry a month, a
 * year or a patch number in their title. Those values come here from the
 * synced data: titles, descriptions and "updated" mentions follow the syncs
 * with no manual edit.
 */

/** Latest detailed patch, by version number. */
export const patchCurrent = Object.values(patchDetails).sort((a, b) =>
  b.version.localeCompare(a.version, undefined, { numeric: true }),
)[0];

/** Rate measurement date, ISO: the "updated" date of the data pages. */
export const dateMeasure = measure;

const date = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

/** "septembre 2026", "September 2026", "septiembre de 2026". */
export function monthYear(locale: Locale, iso = dateMeasure): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(date(iso));
}

/** "11 septembre 2026", "September 11, 2026". */
export function longDate(locale: Locale, iso = dateMeasure): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(date(iso));
}

/** Percentage with one decimal, in the language's format: "52,4 %", "52.4%". */
export function percentage(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    value / 100,
  );
}

/** "A, B et C", "A, B and C". */
export function listNames(locale: Locale, names: string[]): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(names);
}

/**
 * Items most present in the most played builds, all ranks: the number of
 * heroes taking them, from most to least common.
 */
export function itemsPopular(locale: Locale, count = 3): string[] {
  const heroes = new Map<string, Set<string>>();
  for (const [slug, byLane] of Object.entries(buildsPlayed)) {
    for (const byRank of Object.values(byLane)) {
      for (const name of byRank.all?.[0]?.items ?? []) {
        const target = visualItem(name).slug;
        if (target) heroes.set(target, (heroes.get(target) ?? new Set()).add(slug));
      }
    }
  }
  const names = new Map(itemsFor(locale).map((o) => [o.slug, o.name]));
  return [...heroes]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, count)
    .flatMap(([slug]) => (names.has(slug) ? [names.get(slug)!] : []));
}

/**
 * Battle spell and talent most chosen in each hero's most played build, all
 * ranks. English names, as the API gives them.
 */
export function choicePopular(): { sort: string | null; talent: string | null } {
  const sorts = new Map<string, number>();
  const talents = new Map<string, number>();
  for (const byLane of Object.values(buildsPlayed)) {
    for (const byRank of Object.values(byLane)) {
      const b = byRank.all?.[0];
      if (!b) continue;
      if (b.spell) sorts.set(b.spell, (sorts.get(b.spell) ?? 0) + 1);
      for (const t of b.talents) talents.set(t, (talents.get(t) ?? 0) + 1);
    }
  }
  const first = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  return { sort: first(sorts), talent: first(talents) };
}
