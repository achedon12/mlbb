import combosEn from "@/data/game/combos.json";
import combosFr from "@/data/game/combos/fr.json";
import combosIt from "@/data/game/combos/it.json";
import combosEs from "@/data/game/combos/es.json";
import combosId from "@/data/game/combos/id.json";
import skillsEn from "@/data/game/skills/en.json";
import skillsFr from "@/data/game/skills/fr.json";
import skillsIt from "@/data/game/skills/it.json";
import skillsEs from "@/data/game/skills/es.json";
import skillsId from "@/data/game/skills/id.json";
import modesEn from "@/data/game/modes/en.json";
import modesFr from "@/data/game/modes/fr.json";
import modesIt from "@/data/game/modes/it.json";
import modesEs from "@/data/game/modes/es.json";
import modesId from "@/data/game/modes/id.json";
import storiesEn from "@/data/game/stories/en.json";
import storiesFr from "@/data/game/stories/fr.json";
import storiesIt from "@/data/game/stories/it.json";
import storiesEs from "@/data/game/stories/es.json";
import storiesId from "@/data/game/stories/id.json";
import generatedHeroes from "@/data/game/heroes.json";
import itemsEn from "@/data/game/items/en.json";
import itemsFr from "@/data/game/items/fr.json";
import itemsIt from "@/data/game/items/it.json";
import itemsEs from "@/data/game/items/es.json";
import itemsId from "@/data/game/items/id.json";
import tierNotesEn from "@/data/game/tier-notes/en.json";
import tierNotesFr from "@/data/game/tier-notes/fr.json";
import tierNotesIt from "@/data/game/tier-notes/it.json";
import tierNotesEs from "@/data/game/tier-notes/es.json";
import tierNotesId from "@/data/game/tier-notes/id.json";
import generatedPatches from "@/data/game/patches.json";
import patchesFr from "@/data/game/patches/fr.json";
import patchesIt from "@/data/game/patches/it.json";
import patchesEs from "@/data/game/patches/es.json";
import patchesId from "@/data/game/patches/id.json";
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
 * Single access point to the data.
 *
 * The files in `src/data/game/` are produced by `npm run sync`; the analyses
 * in `src/data/heroes/` are hand-written. They are merged here, once, so that
 * pages never need to know where anything comes from.
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
 * A hero's skills, in the requested language. Each language has its own
 * static file, generated upstream: nothing is translated at runtime.
 */
// `satisfies`: a language added to LOCALES without its file fails the type check.
const SKILLS = { en: skillsEn, fr: skillsFr, it: skillsIt, es: skillsEs, id: skillsId } satisfies Record<Locale, unknown>;
export function skills(locale: Locale): Record<string, (WikiSkill | null)[]> {
  return SKILLS[locale] as unknown as Record<string, (WikiSkill | null)[]>;
}

/**
 * Combos recommended by the game, per hero: the skill order and the tip that
 * goes with it. An unrecognised skill keeps its CDN icon; `basicAttack` marks
 * the basic attack, which has no name of its own.
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
 * Descriptions arrive in English: each language reads this file until its
 * translation exists, which will only need to replace its entry here.
 */
const COMBOS = { en: combosEn, fr: combosFr, it: combosIt, es: combosEs, id: combosId } satisfies Record<Locale, unknown>;
export function combos(locale: Locale): Record<string, ComboHero[]> {
  return COMBOS[locale] as unknown as Record<string, ComboHero[]>;
}

/** Icon of each skill, keyed by its English name. */
export const visualsSkills = generatedVisuals.skills as unknown as Record<
  string,
  Record<string, string>
>;

/**
 * Measured counters, taken from the game's win rates.
 *
 * For each hero and each rank: those against whom its rate rises the most
 * (`strong`) and those against whom it drops (`weak`), with the gap in points.
 * Covers all 133 heroes, where the written analysis is limited to a handful.
 */
export interface CounterFigure {
  slug: string;
  /** Win rate gap, in points (positive = advantage). */
  advantage: number;
}
export interface HeroCounters {
  strong: CounterFigure[];
  weak: CounterFigure[];
  winRate: number | null;
}
/** A missing rank was not measured for this hero. */
export type CountersByRank = Partial<Record<MeasuredRank, HeroCounters>>;
/**
 * Before the split by rank, a hero carried `strong` and `weak` at the root.
 * A file from that time — sync not yet rerun — is filed under `all` rather
 * than breaking the hero page.
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
 * Builds actually played, collected by the academy: three key items, the
 * emblem, its talents and the spell, with their rates. Per hero, then per
 * position (Gold, Jungle…), then per rank.
 */
export interface BuildPlayed {
  items: string[];
  /** Emblem role, as named by the API ("Marksman"). */
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
 * Full build proposed by a player on the academy: the best-rated guide among
 * authors of the rank or above. An opinion, with no measured rate.
 */
/** Teammates who raise a hero's win rate the most, per rank (in win points). */
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
  /** Highest rank_level reached by the author. */
  authorRank: number;
  votes: number;
  views: number;
}
export type GuidesHero = Record<string, Partial<Record<MeasuredRank, GuidePlayer>>>;
export const guidesPlayers =
  (generatedStatistics as unknown as { guides?: Record<string, GuidesHero> }).guides ?? {};

/** Detailed content of recent patches, with structured hero adjustments. */
export const patchDetails = generatedPatches.details as unknown as Record<string, DetailedPatch>;

/**
 * Detailed patches in the requested language. English is the wiki source;
 * other languages are translated upstream (`npm run translate:data`). A patch
 * not yet translated — sync newer than the translation — keeps its English
 * text rather than disappearing: it is then the same object as in
 * `patchDetails`.
 */
const TRANSLATED_PATCHES = {
  fr: patchesFr,
  it: patchesIt,
  es: patchesEs,
  id: patchesId,
} satisfies Record<Exclude<Locale, "en">, unknown> as unknown as Record<
  Exclude<Locale, "en">,
  Record<string, DetailedPatch>
>;
const patchesByLocale = new Map<Locale, Record<string, DetailedPatch>>();
export function detailedPatches(locale: Locale): Record<string, DetailedPatch> {
  if (locale === "en") return patchDetails;
  let list = patchesByLocale.get(locale);
  if (!list) {
    const translated = TRANSLATED_PATCHES[locale];
    list = Object.fromEntries(Object.entries(patchDetails).map(([v, p]) => [v, translated[v] ?? p]));
    patchesByLocale.set(locale, list);
  }
  return list;
}

/** Game modes, in the requested language. */
const MODES = { en: modesEn, fr: modesFr, it: modesIt, es: modesEs, id: modesId } satisfies Record<Locale, unknown>;
export function modes(locale: Locale): GameMode[] {
  return MODES[locale] as unknown as GameMode[];
}
export function modeBySlug(locale: Locale, slug: string): GameMode | undefined {
  return modes(locale).find((m) => m.slug === slug);
}
/** Mode slugs, language-independent — for the sitemap and params. */
export const modesSlugs = (modesFr as unknown as GameMode[]).map((m) => m.slug);

/** A hero's story per language: hook, lore, narrative profile, trivia. */
const STORIES = { en: storiesEn, fr: storiesFr, it: storiesIt, es: storiesEs, id: storiesId } satisfies Record<Locale, unknown>;
export function stories(locale: Locale): Record<string, HeroStory> {
  return STORIES[locale] as unknown as Record<string, HeroStory>;
}

/** Full-size artwork, per hero then per skin name. */
export const illustrations = generatedVisuals.illustrations as unknown as Record<
  string,
  Record<string, string>
>;

const ITEMS = { en: itemsEn, fr: itemsFr, it: itemsIt, es: itemsEs, id: itemsId } satisfies Record<Locale, unknown>;
export function itemsFor(locale: Locale): GeneratedItem[] {
  return ITEMS[locale] as unknown as GeneratedItem[];
}
/** Number of items (language-independent). */
export const countItems = (itemsEn as unknown as GeneratedItem[]).length;

/** Editorial notes of the tier list, per language. */
const TIER_NOTES = {
  en: tierNotesEn,
  fr: tierNotesFr,
  it: tierNotesIt,
  es: tierNotesEs,
  id: tierNotesId,
} satisfies Record<Locale, unknown>;
export function tierNotes(locale: Locale): Record<string, string> {
  return TIER_NOTES[locale] as Record<string, string>;
}

export const patches = generatedPatches.list as unknown as Patch[];
export const sync = generatedSync as unknown as SyncInfo;

/** Heroes with a written analysis, highlighted in lists. */
export const heroAnalyses = allHeroes.filter((h) => h.analysis !== null);

/** Total number of skins, shown on the home page. */
export const countSkins = allHeroes.reduce((n, h) => n + h.skins.length, 0);

/** Item categories present, in a stable and readable order. */
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

