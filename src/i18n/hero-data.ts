import { LOCALE_HTML, type Locale } from "./config";
import type { T } from "./t";

/**
 * Labels of hero data taken from the wiki: resource, damage type,
 * range, region, specialties, and release date.
 *
 * The wiki publishes them in English. The catalog translates them under
 * `heroData.<field>.<key>`, the key being the value reduced to a slug
 * ("Moniyan Empire" → `moniyan-empire`). A value the catalog does not
 * know yet — a sync can bring a new one — is shown
 * as is rather than as a key.
 */
export type HeroField = "resource" | "damage" | "attack" | "region" | "specialty";

/** Wiki typos, mapped to the correct value. */
const ALIAS: Record<string, string> = { phyiscal: "physical" };

const MONTH = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Strips a wiki link leftover: "[[Target|Label]]" or "Target|Label" keep the label. */
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
 * Release date in the page's language. The wiki writes "26 October 2021",
 * sometimes the month alone ("January 2017") or the year alone, which stays
 * as is; "TBA" denotes an announced hero.
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
