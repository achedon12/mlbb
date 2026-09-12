import { buildsJoues, objets, patchsDetail } from "./donnees";
import { mesureLe } from "./tier-list";
import { visuelObjet } from "./visuels-build";
import type { TypeAjustement } from "./types";
import type { Langue } from "@/i18n/config";

/** Ajustements de heros d'un patch, par sens : ameliores, affaiblis, autres. */
export function compterAjustements(ajustements: { type: TypeAjustement | null }[]) {
  const buffs = ajustements.filter((a) => a.type === "amelioration").length;
  const nerfs = ajustements.filter((a) => a.type === "affaiblissement").length;
  return { buffs, nerfs, autres: ajustements.length - buffs - nerfs };
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
export const patchActuel = Object.values(patchsDetail).sort((a, b) =>
  b.version.localeCompare(a.version, undefined, { numeric: true }),
)[0];

/** Date du releve des taux, ISO : la date « mis a jour » des pages de donnees. */
export const dateMesure = mesureLe;

const date = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

/** « septembre 2026 », « September 2026 », « septiembre de 2026 ». */
export function moisAnnee(locale: Langue, iso = dateMesure): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(date(iso));
}

/** « 11 septembre 2026 », « September 11, 2026 ». */
export function dateLongue(locale: Langue, iso = dateMesure): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(date(iso));
}

/** Pourcentage a une decimale, au format de la langue : « 52,4 % », « 52.4% ». */
export function pourcentage(locale: Langue, valeur: number): string {
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    valeur / 100,
  );
}

/** « A, B et C », « A, B and C ». */
export function listeNoms(locale: Langue, noms: string[]): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(noms);
}

/**
 * Objets les plus presents dans les builds les plus joues, tous rangs : le
 * nombre de heros qui les prennent, du plus au moins courant.
 */
export function objetsPopulaires(locale: Langue, nombre = 3): string[] {
  const heros = new Map<string, Set<string>>();
  for (const [slug, parLane] of Object.entries(buildsJoues)) {
    for (const parRang of Object.values(parLane)) {
      for (const nom of parRang.all?.[0]?.items ?? []) {
        const cible = visuelObjet(nom).slug;
        if (cible) heros.set(cible, (heros.get(cible) ?? new Set()).add(slug));
      }
    }
  }
  const noms = new Map(objets(locale).map((o) => [o.slug, o.name]));
  return [...heros]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, nombre)
    .flatMap(([slug]) => (noms.has(slug) ? [noms.get(slug)!] : []));
}

/**
 * Sort de combat et talent les plus choisis dans le build le plus joue de
 * chaque heros, tous rangs. Noms anglais, tels que les donne l'API.
 */
export function choixPopulaires(): { sort: string | null; talent: string | null } {
  const sorts = new Map<string, number>();
  const talents = new Map<string, number>();
  for (const parLane of Object.values(buildsJoues)) {
    for (const parRang of Object.values(parLane)) {
      const b = parRang.all?.[0];
      if (!b) continue;
      if (b.spell) sorts.set(b.spell, (sorts.get(b.spell) ?? 0) + 1);
      for (const t of b.talents) talents.set(t, (talents.get(t) ?? 0) + 1);
    }
  }
  const premier = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  return { sort: premier(sorts), talent: premier(talents) };
}
