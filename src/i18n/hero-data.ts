import { LOCALE_HTML, type Locale } from "./config";
import type { T } from "./t";

/**
 * Libelles des donnees de heros tirees du wiki : ressource, type de degats,
 * portee, region, specialites, et date de sortie.
 *
 * Le wiki les publie en anglais. Le catalogue les traduit sous
 * `heroData.<champ>.<cle>`, la cle etant la valeur ramenee a un slug
 * (« Moniyan Empire » → `moniyan-empire`). Une valeur que le catalogue ne
 * connait pas encore — une synchro peut en amener une nouvelle — s'affiche
 * telle quelle plutot que sous forme de cle.
 */
export type HeroField = "resource" | "damage" | "attack" | "region" | "specialty";

/** Coquilles du wiki, rattachees a la valeur correcte. */
const ALIAS: Record<string, string> = { phyiscal: "physical" };

const MONTH = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Retire un reste de lien wiki : « [[Cible|Libelle]] » ou « Cible|Libelle » gardent le libelle. */
export function valueWiki(value: string): string {
  return value
    .replace(/^\[\[(?:[^\]|]*\|)?([^\]]*)\]\]$/, "$1")
    .replace(/^[^|]*\|/, "")
    .trim();
}

export function keyValue(value: string): string {
  const key = valueWiki(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ALIAS[key] ?? key;
}

export function heroLabel(t: T, field: HeroField, value: string | null): string | null {
  if (!value) return null;
  const key = `heroData.${field}.${keyValue(value)}`;
  const label = t(key);
  return label === key ? valueWiki(value) : label;
}

/**
 * Date de sortie dans la langue de la page. Le wiki ecrit « 26 October 2021 »,
 * parfois le mois seul (« January 2017 ») ou l'annee seule, qui reste telle
 * quelle ; « TBA » designe un heros annonce.
 */
export function releaseDate(value: string | null, locale: Locale, t: T): string | null {
  if (!value) return null;
  const raw = valueWiki(value);
  if (/^tba$/i.test(raw)) return t("heroData.release.upcoming");
  const m = raw.match(/^(?:(\d{1,2}) )?([A-Za-z]+) (\d{4})$/);
  const month = m ? MONTH.indexOf(m[2].toLowerCase()) : -1;
  if (!m || month < 0) return raw;
  const date = new Date(Date.UTC(Number(m[3]), month, m[1] ? Number(m[1]) : 1));
  return new Intl.DateTimeFormat(LOCALE_HTML[locale], {
    day: m[1] ? "numeric" : undefined,
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
