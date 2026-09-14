import combosEn from "@/data/game/combos.json";
import combosFr from "@/data/game/combos/fr.json";
import combosIt from "@/data/game/combos/it.json";
import combosEs from "@/data/game/combos/es.json";
import skillsEn from "@/data/game/skills/en.json";
import skillsFr from "@/data/game/skills/fr.json";
import skillsIt from "@/data/game/skills/it.json";
import skillsEs from "@/data/game/skills/es.json";
import modesEn from "@/data/game/modes/en.json";
import modesFr from "@/data/game/modes/fr.json";
import modesIt from "@/data/game/modes/it.json";
import modesEs from "@/data/game/modes/es.json";
import storiesEn from "@/data/game/stories/en.json";
import storiesFr from "@/data/game/stories/fr.json";
import storiesIt from "@/data/game/stories/it.json";
import storiesEs from "@/data/game/stories/es.json";
import generatedHeroes from "@/data/game/heroes.json";
import itemsEn from "@/data/game/items/en.json";
import itemsFr from "@/data/game/items/fr.json";
import itemsIt from "@/data/game/items/it.json";
import itemsEs from "@/data/game/items/es.json";
import tierNotesEn from "@/data/game/tier-notes/en.json";
import tierNotesFr from "@/data/game/tier-notes/fr.json";
import tierNotesIt from "@/data/game/tier-notes/it.json";
import tierNotesEs from "@/data/game/tier-notes/es.json";
import generatedPatches from "@/data/game/patches.json";
import patchsFr from "@/data/game/patches/fr.json";
import patchsIt from "@/data/game/patches/it.json";
import patchsEs from "@/data/game/patches/es.json";
import generatedSkins from "@/data/game/skins.json";
import generatedSync from "@/data/game/sync.json";
import generatedStatistics from "@/data/game/statistics.json";
import generatedVisuals from "@/data/game/visuals.json";
import { analyses } from "@/data/heroes";
import type { Locale } from "@/i18n/config";
import type { MeasuredRank } from "./measured-ranks";
import type {
  WikiSkill,
  Hero,
  HeroStory,
  GameMode,
  DetailedPatch,
  GeneratedHero,
  GeneratedItem,
  Patch,
  Skin,
  SyncInfo,
  HeroVisuals,
} from "./types";

/**
 * Point d'acces unique aux donnees.
 *
 * Les fichiers de `src/data/game/` sont produits par `npm run sync` ; les
 * analyses de `src/data/heroes/` sont ecrites a la main. La fusion se fait ici,
 * une seule fois, pour que les pages n'aient jamais a savoir d'ou vient quoi.
 */

const VISUALS_EMPTY: HeroVisuals = { portrait: null, icon: null, skins: {} };

const visuals = generatedVisuals.heroes as unknown as Record<string, HeroVisuals>;
const skinsByHero = generatedSkins as unknown as Record<string, Skin[]>;
const bySlugAnalysis = new Map(analyses.map((a) => [a.slug, a]));

export const allHeroes: Hero[] = (generatedHeroes as unknown as GeneratedHero[]).map((h) => ({
  ...h,
  images: visuals[h.slug] ?? VISUALS_EMPTY,
  skins: skinsByHero[h.slug] ?? [],
  analysis: bySlugAnalysis.get(h.slug) ?? null,
}));

export const heroesBySlug = new Map(allHeroes.map((h) => [h.slug, h]));

/**
 * Competences d'un heros, dans la langue demandee. Chaque langue a son propre
 * fichier statique, genere en amont : rien n'est traduit a l'execution.
 */
const SKILLS = { en: skillsEn, fr: skillsFr, it: skillsIt, es: skillsEs };
export function skills(locale: Locale): Record<string, (WikiSkill | null)[]> {
  return SKILLS[locale] as unknown as Record<string, (WikiSkill | null)[]>;
}

/**
 * Combos conseilles par le jeu, par heros : l'ordre des competences et le
 * conseil qui l'accompagne. Une competence non reconnue garde l'icone du CDN ;
 * `attaque` marque l'attaque de base, qui n'a pas de nom propre.
 */
export interface ComboSkill {
  name: string | null;
  icon: string | null;
  basicAttack?: boolean;
}
export interface ComboHero {
  type: "laning" | "teamfight" | null;
  description: string;
  skills: ComboSkill[];
}
/**
 * Les descriptions arrivent en anglais : chaque langue lit ce fichier en
 * attendant sa traduction, qui n'aura qu'a remplacer son entree ici.
 */
const COMBOS = { en: combosEn, fr: combosFr, it: combosIt, es: combosEs };
export function combos(locale: Locale): Record<string, ComboHero[]> {
  return COMBOS[locale] as unknown as Record<string, ComboHero[]>;
}

/** Icone de chaque competence, indexee par son nom anglais. */
export const visualsSkills = generatedVisuals.skills as unknown as Record<
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
export interface CounterFigure {
  slug: string;
  /** Ecart de taux de victoire, en points (positif = avantage). */
  advantage: number;
}
export interface HeroCounters {
  strong: CounterFigure[];
  weak: CounterFigure[];
  winRate: number | null;
}
/** Un rang absent n'a pas ete mesure pour ce heros. */
export type CountersByRank = Partial<Record<MeasuredRank, HeroCounters>>;
/**
 * Avant le decoupage par rang, un heros portait `fort` et `faible` a la racine.
 * Un fichier de cette epoque — synchro pas encore relancee — est range sous
 * `all` plutot que de faire tomber la fiche.
 */
function byRank(raw: CountersByRank | HeroCounters): CountersByRank {
  return "strong" in raw ? { all: raw } : raw;
}
export const counters: Record<string, CountersByRank> = Object.fromEntries(
  Object.entries(
    generatedStatistics.counters as unknown as Record<string, CountersByRank | HeroCounters>,
  ).map(([slug, c]) => [slug, byRank(c)]),
);

/**
 * Builds reellement joues, releves par l'academie : trois objets cles,
 * l'embleme, ses talents et le sort, avec leurs taux. Par heros, puis par
 * position (Or, Jungle…), puis par rang.
 */
export interface BuildPlayed {
  items: string[];
  /** Role de l'embleme, tel que nomme par l'API (« Marksman »). */
  emblem: string | null;
  talents: string[];
  spell: string | null;
  winRate: number | null;
  pickRate: number | null;
}
export type BuildsHero = Record<string, Partial<Record<MeasuredRank, BuildPlayed[]>>>;
export const buildsPlayed =
  (generatedStatistics as unknown as { builds?: Record<string, BuildsHero> }).builds ?? {};

/**
 * Equipement complet propose par un joueur sur l'academie : le guide le mieux
 * note parmi les auteurs du rang ou au-dessus. Un avis, sans taux mesure.
 */
/** Coequipiers qui font le plus gagner un heros, par rang (en points de victoire). */
export interface Teammate {
  slug: string;
  advantage: number;
}
export type TeammatesByRank = Partial<Record<MeasuredRank, Teammate[]>>;
export const teammates =
  (generatedStatistics as unknown as { teammates?: Record<string, TeammatesByRank> }).teammates ?? {};

export interface GuidePlayer {
  items: string[];
  emblem: string | null;
  talents: string[];
  spell: string | null;
  /** Meilleur rank_level atteint par l'auteur. */
  authorRank: number;
  votes: number;
  views: number;
}
export type GuidesHero = Record<string, Partial<Record<MeasuredRank, GuidePlayer>>>;
export const guidesPlayers =
  (generatedStatistics as unknown as { guides?: Record<string, GuidesHero> }).guides ?? {};

/** Contenu detaille des patchs recents, avec ajustements de heros structures. */
export const patchDetails = generatedPatches.details as unknown as Record<string, DetailedPatch>;

/**
 * Patchs detailles dans la langue demandee. L'anglais est la source du wiki ;
 * les autres langues sont traduites en amont (`npm run translate:data`). Un
 * patch pas encore traduit — synchro plus recente que la traduction — garde
 * son texte anglais plutot que de disparaitre : c'est alors le meme objet que
 * dans `patchsDetail`.
 */
const TRANSLATED_PATCHES = { fr: patchsFr, it: patchsIt, es: patchsEs } as unknown as Record<
  Exclude<Locale, "en">,
  Record<string, DetailedPatch>
>;
const patchsByLocale = new Map<Locale, Record<string, DetailedPatch>>();
export function detailedPatches(locale: Locale): Record<string, DetailedPatch> {
  if (locale === "en") return patchDetails;
  let list = patchsByLocale.get(locale);
  if (!list) {
    const translated = TRANSLATED_PATCHES[locale];
    list = Object.fromEntries(Object.entries(patchDetails).map(([v, p]) => [v, translated[v] ?? p]));
    patchsByLocale.set(locale, list);
  }
  return list;
}

/** Modes de jeu, dans la langue demandee. */
const MODES = { en: modesEn, fr: modesFr, it: modesIt, es: modesEs };
export function modes(locale: Locale): GameMode[] {
  return MODES[locale] as unknown as GameMode[];
}
export function modeBySlug(locale: Locale, slug: string): GameMode | undefined {
  return modes(locale).find((m) => m.slug === slug);
}
/** Slugs des modes, independants de la langue — pour le plan du site et les params. */
export const modesSlugs = (modesFr as unknown as GameMode[]).map((m) => m.slug);

/** Histoire d'un heros par langue : accroche, lore, fiche narrative, anecdotes. */
const STORIES = { en: storiesEn, fr: storiesFr, it: storiesIt, es: storiesEs };
export function stories(locale: Locale): Record<string, HeroStory> {
  return STORIES[locale] as unknown as Record<string, HeroStory>;
}

/** Illustrations pleine taille, par heros puis par nom de skin. */
export const illustrations = generatedVisuals.illustrations as unknown as Record<
  string,
  Record<string, string>
>;

const ITEMS = { en: itemsEn, fr: itemsFr, it: itemsIt, es: itemsEs };
export function itemsFor(locale: Locale): GeneratedItem[] {
  return ITEMS[locale] as unknown as GeneratedItem[];
}
/** Nombre d'objets (independant de la langue). */
export const countItems = (itemsEn as unknown as GeneratedItem[]).length;

/** Notes editoriales de la tier list, par langue. */
const TIER_NOTES = { en: tierNotesEn, fr: tierNotesFr, it: tierNotesIt, es: tierNotesEs };
export function tierNotes(locale: Locale): Record<string, string> {
  return TIER_NOTES[locale] as Record<string, string>;
}

export const patches = generatedPatches.list as unknown as Patch[];
export const sync = generatedSync as unknown as SyncInfo;

/** Heros disposant d'une analyse redigee, mis en avant dans les listes. */
export const heroAnalyses = allHeroes.filter((h) => h.analysis !== null);

/** Nombre total de skins, affiche sur l'accueil. */
export const countSkins = allHeroes.reduce((n, h) => n + h.skins.length, 0);

/** Categories d'objets presentes, dans un ordre stable et lisible. */
const ORDER_CATEGORIES = [
  "Attack",
  "Magic",
  "Defense",
  "Movement",
  "Jungling",
  "Roaming",
  "Attack & Magic",
  "Attack, Magic & Defense",
];

export const categoriesItems = [...new Set((itemsEn as unknown as GeneratedItem[]).map((o) => o.category))].sort(
  (a, b) => {
    const ia = ORDER_CATEGORIES.indexOf(a);
    const ib = ORDER_CATEGORIES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  },
);

