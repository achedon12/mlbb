import competencesEn from "@/data/jeu/competences/en.json";
import competencesFr from "@/data/jeu/competences/fr.json";
import competencesIt from "@/data/jeu/competences/it.json";
import competencesEs from "@/data/jeu/competences/es.json";
import modesEn from "@/data/jeu/modes/en.json";
import modesFr from "@/data/jeu/modes/fr.json";
import modesIt from "@/data/jeu/modes/it.json";
import modesEs from "@/data/jeu/modes/es.json";
import histoiresEn from "@/data/jeu/histoires/en.json";
import histoiresFr from "@/data/jeu/histoires/fr.json";
import histoiresIt from "@/data/jeu/histoires/it.json";
import histoiresEs from "@/data/jeu/histoires/es.json";
import herosGenere from "@/data/jeu/heros.json";
import objetsEn from "@/data/jeu/objets/en.json";
import objetsFr from "@/data/jeu/objets/fr.json";
import objetsIt from "@/data/jeu/objets/it.json";
import objetsEs from "@/data/jeu/objets/es.json";
import tierNotesEn from "@/data/jeu/tier-notes/en.json";
import tierNotesFr from "@/data/jeu/tier-notes/fr.json";
import tierNotesIt from "@/data/jeu/tier-notes/it.json";
import tierNotesEs from "@/data/jeu/tier-notes/es.json";
import patchsGenere from "@/data/jeu/patchs.json";
import skinsGenere from "@/data/jeu/skins.json";
import synchroGenere from "@/data/jeu/synchro.json";
import statistiquesGenere from "@/data/jeu/statistiques.json";
import visuelsGenere from "@/data/jeu/visuels.json";
import { analyses } from "@/data/heros";
import type { Langue } from "@/i18n/config";
import type {
  CompetenceWiki,
  Heros,
  HistoireHeros,
  ModeDeJeu,
  PatchDetaille,
  HerosGenere,
  ObjetGenere,
  Patch,
  Skin,
  Synchro,
  VisuelsHeros,
} from "./types";

/**
 * Point d'acces unique aux donnees.
 *
 * Les fichiers de `src/data/jeu/` sont produits par `npm run sync` ; les
 * analyses de `src/data/heros/` sont ecrites a la main. La fusion se fait ici,
 * une seule fois, pour que les pages n'aient jamais a savoir d'ou vient quoi.
 */

const VISUELS_VIDES: VisuelsHeros = { portrait: null, icone: null, skins: {} };

const visuels = visuelsGenere.heros as unknown as Record<string, VisuelsHeros>;
const skinsParHeros = skinsGenere as unknown as Record<string, Skin[]>;
const parSlugAnalyse = new Map(analyses.map((a) => [a.slug, a]));

export const heros: Heros[] = (herosGenere as unknown as HerosGenere[]).map((h) => ({
  ...h,
  visuels: visuels[h.slug] ?? VISUELS_VIDES,
  skins: skinsParHeros[h.slug] ?? [],
  analyse: parSlugAnalyse.get(h.slug) ?? null,
}));

export const herosParSlug = new Map(heros.map((h) => [h.slug, h]));

/**
 * Competences d'un heros, dans la langue demandee. Chaque langue a son propre
 * fichier statique, genere en amont : rien n'est traduit a l'execution.
 */
const COMPETENCES = { en: competencesEn, fr: competencesFr, it: competencesIt, es: competencesEs };
export function competences(locale: Langue): Record<string, (CompetenceWiki | null)[]> {
  return COMPETENCES[locale] as unknown as Record<string, (CompetenceWiki | null)[]>;
}

/** Icone de chaque competence, indexee par son nom anglais. */
export const visuelsCompetences = visuelsGenere.competences as unknown as Record<
  string,
  Record<string, string>
>;

/**
 * Contres chiffres, tires des taux de victoire du jeu.
 *
 * Pour chaque heros : ceux contre qui son taux monte le plus (`fort`) et ceux
 * contre qui il descend (`faible`), avec l'ecart en points. Couvre les 133
 * heros, la ou l'analyse ecrite se limite a une poignee.
 */
export interface ContreChiffre {
  slug: string;
  /** Ecart de taux de victoire, en points (positif = avantage). */
  avantage: number;
}
export interface ContresHeros {
  fort: ContreChiffre[];
  faible: ContreChiffre[];
  mesure: number | null;
}
export const contres = statistiquesGenere.contres as unknown as Record<string, ContresHeros>;

/** Contenu detaille des patchs recents, avec ajustements de heros structures. */
export const patchsDetail = patchsGenere.detail as unknown as Record<string, PatchDetaille>;

/** Modes de jeu, dans la langue demandee. */
const MODES = { en: modesEn, fr: modesFr, it: modesIt, es: modesEs };
export function modes(locale: Langue): ModeDeJeu[] {
  return MODES[locale] as unknown as ModeDeJeu[];
}
export function modeParSlug(locale: Langue, slug: string): ModeDeJeu | undefined {
  return modes(locale).find((m) => m.slug === slug);
}
/** Slugs des modes, independants de la langue — pour le plan du site et les params. */
export const modesSlugs = (modesFr as unknown as ModeDeJeu[]).map((m) => m.slug);

/** Histoire d'un heros par langue : accroche, lore, fiche narrative, anecdotes. */
const HISTOIRES = { en: histoiresEn, fr: histoiresFr, it: histoiresIt, es: histoiresEs };
export function histoires(locale: Langue): Record<string, HistoireHeros> {
  return HISTOIRES[locale] as unknown as Record<string, HistoireHeros>;
}

/** Illustrations pleine taille, par heros puis par nom de skin. */
export const illustrations = visuelsGenere.illustrations as unknown as Record<
  string,
  Record<string, string>
>;

const OBJETS = { en: objetsEn, fr: objetsFr, it: objetsIt, es: objetsEs };
export function objets(locale: Langue): ObjetGenere[] {
  return OBJETS[locale] as unknown as ObjetGenere[];
}
/** Nombre d'objets (independant de la langue). */
export const nombreObjets = (objetsEn as unknown as ObjetGenere[]).length;

/** Notes editoriales de la tier list, par langue. */
const TIER_NOTES = { en: tierNotesEn, fr: tierNotesFr, it: tierNotesIt, es: tierNotesEs };
export function tierNotes(locale: Langue): Record<string, string> {
  return TIER_NOTES[locale] as Record<string, string>;
}

export const patchs = patchsGenere.liste as unknown as Patch[];
export const synchro = synchroGenere as unknown as Synchro;

/** Heros disposant d'une analyse redigee, mis en avant dans les listes. */
export const herosAnalyses = heros.filter((h) => h.analyse !== null);

/** Nombre total de skins, affiche sur l'accueil. */
export const nombreSkins = heros.reduce((n, h) => n + h.skins.length, 0);

/** Categories d'objets presentes, dans un ordre stable et lisible. */
const ORDRE_CATEGORIES = [
  "Attack",
  "Magic",
  "Defense",
  "Movement",
  "Jungling",
  "Roaming",
  "Attack & Magic",
  "Attack, Magic & Defense",
];

export const categoriesObjets = [...new Set((objetsEn as unknown as ObjetGenere[]).map((o) => o.categorie))].sort(
  (a, b) => {
    const ia = ORDRE_CATEGORIES.indexOf(a);
    const ib = ORDRE_CATEGORIES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  },
);

