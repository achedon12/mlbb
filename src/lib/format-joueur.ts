/**
 * Mise en forme des chiffres de joueur, commune au serveur et au navigateur.
 *
 * Module leger a dessein : la liste des parties, rendue cote client, l'importe
 * sans embarquer les donnees du site.
 */
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import type { Lane } from "./types";

const FORMATS = new Map<string, Intl.NumberFormat>();

function format(langue: Langue, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cle = `${langue}:${JSON.stringify(options)}`;
  let f = FORMATS.get(cle);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE_HTML[langue], options);
    FORMATS.set(cle, f);
  }
  return f;
}

/** Taux en points (0 a 100), rendu en pourcentage : « 62,5 % ». */
export function formaterPourcent(points: number, langue: Langue): string {
  return format(langue, { style: "percent", maximumFractionDigits: 1 }).format(points / 100);
}

export function formaterNombre(n: number, langue: Langue, decimales = 0): string {
  return format(langue, { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n);
}

/** Ecart signe, en points : « +4,2 », « -3 ». */
export function formaterEcart(points: number, langue: Langue): string {
  return format(langue, { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(points);
}

/** Forme a employer pour un nombre, selon les regles de pluriel de la langue. */
export function pluriel(n: number, langue: Langue): "un" | "autres" {
  return new Intl.PluralRules(LOCALE_HTML[langue]).select(n) === "one" ? "un" : "autres";
}

/** Rapport (eliminations + assistances) / morts, une mort comptee au minimum. */
export function ratioKda(eliminations: number, morts: number, assistances: number): number {
  return (eliminations + assistances) / Math.max(1, morts);
}

/** Position annoncee par le service (`lid`), traduite en position du site. */
export const LANE_JEU: Record<number, Lane> = { 1: "Experience", 2: "Milieu", 3: "Roam", 4: "Jungle", 5: "Or" };

/**
 * Date d'une partie.
 *
 * Le serveur ne connait pas le fuseau du lecteur : il rend le jour seul, en
 * UTC, et le navigateur ajoute l'heure locale une fois la page hydratee
 * (`locale`). L'annee n'apparait que pour une saison d'une autre annee.
 */
export function formaterDatePartie(secondes: number, langue: Langue, locale: boolean): string {
  const date = new Date(secondes * 1000);
  const autreAnnee = date.getUTCFullYear() !== new Date().getUTCFullYear();
  const options: Intl.DateTimeFormatOptions = locale
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", timeZone: "UTC" };
  if (autreAnnee) options.year = "numeric";
  return new Intl.DateTimeFormat(LOCALE_HTML[langue], options).format(date);
}
