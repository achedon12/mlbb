import combosEn from "@/data/jeu/combos.json";
import combosFr from "@/data/jeu/combos/fr.json";
import combosIt from "@/data/jeu/combos/it.json";
import combosEs from "@/data/jeu/combos/es.json";
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
import patchsFr from "@/data/jeu/patchs/fr.json";
import patchsIt from "@/data/jeu/patchs/it.json";
import patchsEs from "@/data/jeu/patchs/es.json";
import skinsGenere from "@/data/jeu/skins.json";
import synchroGenere from "@/data/jeu/synchro.json";
import statistiquesGenere from "@/data/jeu/statistiques.json";
import visuelsGenere from "@/data/jeu/visuels.json";
import { analyses } from "@/data/heros";
import type { Langue } from "@/i18n/config";
import type { RangMesure } from "./rangs-mesure";
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

const VISUELS_VIDES: VisuelsHeros = { portrait: null, icon: null, skins: {} };

const visuels = visuelsGenere.heroes as unknown as Record<string, VisuelsHeros>;
const skinsParHeros = skinsGenere as unknown as Record<string, Skin[]>;
const parSlugAnalyse = new Map(analyses.map((a) => [a.slug, a]));

export const heros: Heros[] = (herosGenere as unknown as HerosGenere[]).map((h) => ({
  ...h,
  images: visuels[h.slug] ?? VISUELS_VIDES,
  skins: skinsParHeros[h.slug] ?? [],
  analysis: parSlugAnalyse.get(h.slug) ?? null,
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

/**
 * Combos conseilles par le jeu, par heros : l'ordre des competences et le
 * conseil qui l'accompagne. Une competence non reconnue garde l'icone du CDN ;
 * `attaque` marque l'attaque de base, qui n'a pas de nom propre.
 */
export interface CompetenceCombo {
  name: string | null;
  icon: string | null;
  basicAttack?: boolean;
}
export interface ComboHeros {
  type: "laning" | "teamfight" | null;
  description: string;
  skills: CompetenceCombo[];
}
/**
 * Les descriptions arrivent en anglais : chaque langue lit ce fichier en
 * attendant sa traduction, qui n'aura qu'a remplacer son entree ici.
 */
const COMBOS = { en: combosEn, fr: combosFr, it: combosIt, es: combosEs };
export function combos(locale: Langue): Record<string, ComboHeros[]> {
  return COMBOS[locale] as unknown as Record<string, ComboHeros[]>;
}

/** Icone de chaque competence, indexee par son nom anglais. */
export const visuelsCompetences = visuelsGenere.skills as unknown as Record<
  string,
  Record<string, string>
>;

/**
 * Contres chiffres, tires des taux de victoire du jeu.
 *
 * Pour chaque heros et chaque rang : ceux contre qui son taux monte le plus
 * (`fort`) et ceux contre qui il descend (`faible`), avec l'ecart en points.
 * Couvre les 133 heros, la ou l'analyse ecrite se limite a une poignee.
 */
export interface ContreChiffre {
  slug: string;
  /** Ecart de taux de victoire, en points (positif = avantage). */
  advantage: number;
}
export interface ContresHeros {
  strong: ContreChiffre[];
  weak: ContreChiffre[];
  winRate: number | null;
}
/** Un rang absent n'a pas ete mesure pour ce heros. */
export type ContresParRang = Partial<Record<RangMesure, ContresHeros>>;
/**
 * Avant le decoupage par rang, un heros portait `fort` et `faible` a la racine.
 * Un fichier de cette epoque — synchro pas encore relancee — est range sous
 * `all` plutot que de faire tomber la fiche.
 */
function parRang(brut: ContresParRang | ContresHeros): ContresParRang {
  return "strong" in brut ? { all: brut } : brut;
}
export const contres: Record<string, ContresParRang> = Object.fromEntries(
  Object.entries(
    statistiquesGenere.counters as unknown as Record<string, ContresParRang | ContresHeros>,
  ).map(([slug, c]) => [slug, parRang(c)]),
);

/**
 * Builds reellement joues, releves par l'academie : trois objets cles,
 * l'embleme, ses talents et le sort, avec leurs taux. Par heros, puis par
 * position (Or, Jungle…), puis par rang.
 */
export interface BuildJoue {
  items: string[];
  /** Role de l'embleme, tel que nomme par l'API (« Marksman »). */
  emblem: string | null;
  talents: string[];
  spell: string | null;
  winRate: number | null;
  pickRate: number | null;
}
export type BuildsHeros = Record<string, Partial<Record<RangMesure, BuildJoue[]>>>;
export const buildsJoues =
  (statistiquesGenere as unknown as { builds?: Record<string, BuildsHeros> }).builds ?? {};

/**
 * Equipement complet propose par un joueur sur l'academie : le guide le mieux
 * note parmi les auteurs du rang ou au-dessus. Un avis, sans taux mesure.
 */
/** Coequipiers qui font le plus gagner un heros, par rang (en points de victoire). */
export interface Coequipier {
  slug: string;
  advantage: number;
}
export type CoequipiersParRang = Partial<Record<RangMesure, Coequipier[]>>;
export const coequipiers =
  (statistiquesGenere as unknown as { teammates?: Record<string, CoequipiersParRang> }).teammates ?? {};

export interface GuideJoueur {
  items: string[];
  emblem: string | null;
  talents: string[];
  spell: string | null;
  /** Meilleur rank_level atteint par l'auteur. */
  authorRank: number;
  votes: number;
  views: number;
}
export type GuidesHeros = Record<string, Partial<Record<RangMesure, GuideJoueur>>>;
export const guidesJoueurs =
  (statistiquesGenere as unknown as { guides?: Record<string, GuidesHeros> }).guides ?? {};

/** Contenu detaille des patchs recents, avec ajustements de heros structures. */
export const patchsDetail = patchsGenere.details as unknown as Record<string, PatchDetaille>;

/**
 * Patchs detailles dans la langue demandee. L'anglais est la source du wiki ;
 * les autres langues sont traduites en amont (`npm run traduire:donnees`). Un
 * patch pas encore traduit — synchro plus recente que la traduction — garde
 * son texte anglais plutot que de disparaitre : c'est alors le meme objet que
 * dans `patchsDetail`.
 */
const PATCHS_TRADUITS = { fr: patchsFr, it: patchsIt, es: patchsEs } as unknown as Record<
  Exclude<Langue, "en">,
  Record<string, PatchDetaille>
>;
const patchsParLangue = new Map<Langue, Record<string, PatchDetaille>>();
export function patchsDetailles(locale: Langue): Record<string, PatchDetaille> {
  if (locale === "en") return patchsDetail;
  let liste = patchsParLangue.get(locale);
  if (!liste) {
    const traduits = PATCHS_TRADUITS[locale];
    liste = Object.fromEntries(Object.entries(patchsDetail).map(([v, p]) => [v, traduits[v] ?? p]));
    patchsParLangue.set(locale, liste);
  }
  return liste;
}

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

export const patchs = patchsGenere.list as unknown as Patch[];
export const synchro = synchroGenere as unknown as Synchro;

/** Heros disposant d'une analyse redigee, mis en avant dans les listes. */
export const herosAnalyses = heros.filter((h) => h.analysis !== null);

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

export const categoriesObjets = [...new Set((objetsEn as unknown as ObjetGenere[]).map((o) => o.category))].sort(
  (a, b) => {
    const ia = ORDRE_CATEGORIES.indexOf(a);
    const ib = ORDRE_CATEGORIES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  },
);

