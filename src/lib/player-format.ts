/**
 * Mise en forme des chiffres de joueur, commune au serveur et au navigateur.
 *
 * Module leger a dessein : la liste des parties, rendue cote client, l'importe
 * sans embarquer les donnees du site.
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

/** Taux en points (0 a 100), rendu en pourcentage : « 62,5 % ». */
export function formatPercent(points: number, siteLocale: Locale): string {
  return format(siteLocale, { style: "percent", maximumFractionDigits: 1 }).format(points / 100);
}

export function formatCount(n: number, siteLocale: Locale, decimals = 0): string {
  return format(siteLocale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

/** Ecart signe, en points : « +4,2 », « -3 ». */
export function formatGap(points: number, siteLocale: Locale): string {
  return format(siteLocale, { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(points);
}

/** Forme a employer pour un nombre, selon les regles de pluriel de la langue. */
export function plural(n: number, siteLocale: Locale): "one" | "other" {
  return new Intl.PluralRules(LOCALE_HTML[siteLocale]).select(n) === "one" ? "one" : "other";
}

/** Rapport (eliminations + assistances) / morts, une mort comptee au minimum. */
export function ratioKda(eliminations: number, deaths: number, assists: number): number {
  return (eliminations + assists) / Math.max(1, deaths);
}

/** Position annoncee par le service (`lid`), traduite en position du site. */
export const GAME_LANE: Record<number, Lane> = { 1: "Exp", 2: "Mid", 3: "Roam", 4: "Jungle", 5: "Gold" };

/**
 * Date d'une partie.
 *
 * Le serveur ne connait pas le fuseau du lecteur : il rend le jour seul, en
 * UTC, et le navigateur ajoute l'heure locale une fois la page hydratee
 * (`locale`). L'annee n'apparait que pour une saison d'une autre annee.
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
