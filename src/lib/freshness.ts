import { buildsPlayed, itemsFor, patchDetails } from "./data";
import { measure } from "./tier-list";
import { visualItem } from "./build-visuals";
import type { AdjustmentType } from "./types";
import type { Locale } from "@/i18n/config";

/** Ajustements de heros d'un patch, par sens : ameliores, affaiblis, autres. */
export function countAdjustments(adjustments: { type: AdjustmentType | null }[]) {
  const buffs = adjustments.filter((a) => a.type === "buff").length;
  const nerfs = adjustments.filter((a) => a.type === "nerf").length;
  return { buffs, nerfs, autres: adjustments.length - buffs - nerfs };
}

/**
 * Reperes de fraicheur des pages de donnees : patch en cours et date du releve.
 *
 * Les resultats qui menent sur « tier list », « build » ou « counter » portent
 * tous un mois, une annee ou un numero de patch dans leur titre. Ces valeurs
 * sortent ici des donnees synchronisees : titres, descriptions et mentions
 * « mis a jour » suivent les synchronisations sans retouche.
 */

/** Dernier patch detaille, par numero de version. */
export const patchCurrent = Object.values(patchDetails).sort((a, b) =>
  b.version.localeCompare(a.version, undefined, { numeric: true }),
)[0];

/** Date du releve des taux, ISO : la date « mis a jour » des pages de donnees. */
export const dateMeasure = measure;

const date = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

/** « septembre 2026 », « September 2026 », « septiembre de 2026 ». */
export function monthYear(locale: Locale, iso = dateMeasure): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(date(iso));
}

/** « 11 septembre 2026 », « September 11, 2026 ». */
export function longDate(locale: Locale, iso = dateMeasure): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(date(iso));
}

/** Pourcentage a une decimale, au format de la langue : « 52,4 % », « 52.4% ». */
export function percentage(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    value / 100,
  );
}

/** « A, B et C », « A, B and C ». */
export function listNames(locale: Locale, names: string[]): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(names);
}

/**
 * Objets les plus presents dans les builds les plus joues, tous rangs : le
 * nombre de heros qui les prennent, du plus au moins courant.
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
 * Sort de combat et talent les plus choisis dans le build le plus joue de
 * chaque heros, tous rangs. Noms anglais, tels que les donne l'API.
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
