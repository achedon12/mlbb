import { LOCALE_HTML, type Langue } from "./config";
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
export type ChampHeros = "resource" | "damage" | "attack" | "region" | "specialty";

/** Coquilles du wiki, rattachees a la valeur correcte. */
const ALIAS: Record<string, string> = { phyiscal: "physical" };

const MOIS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Retire un reste de lien wiki : « [[Cible|Libelle]] » ou « Cible|Libelle » gardent le libelle. */
export function valeurWiki(valeur: string): string {
  return valeur
    .replace(/^\[\[(?:[^\]|]*\|)?([^\]]*)\]\]$/, "$1")
    .replace(/^[^|]*\|/, "")
    .trim();
}

export function cleValeur(valeur: string): string {
  const cle = valeurWiki(valeur)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ALIAS[cle] ?? cle;
}

export function libelleHeros(t: T, champ: ChampHeros, valeur: string | null): string | null {
  if (!valeur) return null;
  const cle = `heroData.${champ}.${cleValeur(valeur)}`;
  const libelle = t(cle);
  return libelle === cle ? valeurWiki(valeur) : libelle;
}

/**
 * Date de sortie dans la langue de la page. Le wiki ecrit « 26 October 2021 »,
 * parfois le mois seul (« January 2017 ») ou l'annee seule, qui reste telle
 * quelle ; « TBA » designe un heros annonce.
 */
export function dateSortie(valeur: string | null, langue: Langue, t: T): string | null {
  if (!valeur) return null;
  const brut = valeurWiki(valeur);
  if (/^tba$/i.test(brut)) return t("heroData.release.upcoming");
  const m = brut.match(/^(?:(\d{1,2}) )?([A-Za-z]+) (\d{4})$/);
  const mois = m ? MOIS.indexOf(m[2].toLowerCase()) : -1;
  if (!m || mois < 0) return brut;
  const date = new Date(Date.UTC(Number(m[3]), mois, m[1] ? Number(m[1]) : 1));
  return new Intl.DateTimeFormat(LOCALE_HTML[langue], {
    day: m[1] ? "numeric" : undefined,
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
