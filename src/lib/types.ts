/**
 * Site data model.
 *
 * Two distinct origins, deliberately kept apart:
 *
 * - **factual data** (heroes, skins, items, patches) is extracted
 *   automatically from the wiki by `npm run sync` and lives in
 *   `src/data/game/`. It is not edited by hand: the next
 *   sync would overwrite it.
 * - **editorial analysis** (comment, builds, counters) is written by
 *   hand in `src/data/heroes/`. It is layered on top, by `slug`.
 *
 * This separation lets the catalogue stay up to date on its own, without
 * preventing content that no extraction will ever produce from being written.
 */

/** The game's six roles. */
export type Role = "Tank" | "Fighter" | "Assassin" | "Mage" | "Marksman" | "Support";

/** Lanes, translated from the wiki's English names. */
export type Lane = "Gold" | "Exp" | "Mid" | "Jungle" | "Roam";

// ─────────────────────────────────────────────────────────────
// Data extracted from the wiki
// ─────────────────────────────────────────────────────────────

export interface HeroRatings {
  offense: number | null;
  durability: number | null;
  abilityEffects: number | null;
  difficulty: number | null;
}

export interface GeneratedHero {
  slug: string;
  name: string;
  /** Wiki identifier, also used to name the visuals. */
  id: string;
  title: string | null;
  roles: Role[];
  lanes: Lane[];
  /** Secondary tags: the wiki uses about fifteen of them. */
  specialties: string[];
  release: string | null;
  year: string | null;
  resource: string | null;
  damageType: string | null;
  attackType: string | null;
  region: string | null;
  ratings: HeroRatings;
  stats: Record<string, string> | null;
}

export interface Skin {
  id: string;
  name: string;
  release: string | null;
  availability: string | null;
  rarity: string | null;
  label: string | null;
  price: Record<string, string>;
}

export interface GeneratedItem {
  slug: string;
  name: string;
  summary: string | null;
  category: string;
  price: number | null;
  bonus: string | null;
  unique: string | null;
  passive: string | null;
  active: string | null;
  recipe: string[];
  bestFor: string | null;
}

export interface Patch {
  version: string;
  title: string;
  link: string;
}

/** Local paths of a hero's visuals. No external URL. */
export interface HeroVisuals {
  portrait: string | null;
  icon: string | null;
  skins: Record<string, string>;
}

export interface SyncInfo {
  date: string;
  source: string;
  heroes: number;
  skins: number;
  items: number;
  patches: number;
}

// ─────────────────────────────────────────────────────────────
// Hand-written analysis
// ─────────────────────────────────────────────────────────────

export type SkillType = "Passive" | "Skill 1" | "Skill 2" | "Ultimate";

/**
 * Skill as the wiki describes it.
 *
 * The name is the game's; the description is the official text, converted to
 * plain text. It serves as a fallback when no one has written an analysis in
 * French for this hero yet.
 */
export interface WikiSkill {
  name: string;
  description: string | null;
}

export interface Skill {
  type: SkillType;
  name: string;
  description: string;
  /** Cooldown per level, in seconds. Absent for a passive. */
  cooldown?: number[];
  /** Cost per level. Absent if the hero does not use mana. */
  cost?: number[];
}

export interface Build {
  name: string;
  /** In which situation to pick this build. */
  context: string;
  items: string[];
  emblem: string;
  talent: string;
  spell: string;
}

/**
 * Analysis of a hero. All factual fields (roles, lanes, release…) are
 * absent here: they come from the sync.
 */
export interface HeroAnalysis {
  slug: string;
  /** Short introduction, reused as meta description. */
  summary: string;
  /** Two paragraphs: what the hero does, then their limits. */
  analysis: string;
  skills: Skill[];
  strengths: string[];
  weaknesses: string[];
  strongAgainst: string[];
  weakAgainst: string[];
  builds: Build[];
}

/** A hero as the site displays it: wiki data, analysis if it exists. */
export interface Hero extends GeneratedHero {
  images: HeroVisuals;
  skins: Skin[];
  analysis: HeroAnalysis | null;
}

export type Tier = "S+" | "S" | "A" | "B" | "C";

export interface TierListEntry {
  hero: string;
  tier: Tier;
  lane: Lane;
  comment: string;
}

export interface TierList {
  patch: string;
  updated: string;
  entries: TierListEntry[];
}

/** A balance change: either a before/after, or plain text. */
export type Change =
  | { label: string | null; before: string; after: string }
  | { text: string };

export interface AdjustmentSection {
  name: string;
  category: string | null;
  type: AdjustmentType | null;
  changes: Change[];
}

export type AdjustmentType = "buff" | "nerf" | "adjust";

export interface HeroAdjustment {
  name: string;
  slug: string;
  type: AdjustmentType | null;
  intro: string;
  sections: AdjustmentSection[];
}

/** A skill of a new hero: role (passive, skill 1…), name, effects. */
export interface NewHeroSkill {
  role: string;
  name: string | null;
  description: string[];
}

/** Structured presentation of a hero introduced by the patch. */
export interface NewHero {
  name: string;
  slug: string;
  epithet: string | null;
  anchor: string | null;
  lore: string[];
  feature: string | null;
  skills: NewHeroSkill[];
}

/** A top-level section of the patch body. */
export interface PatchSection {
  anchor: string | null;
  title: string | null;
  html: string;
  /** Sections rendered by a rich component rather than raw HTML. */
  role: "newHeroes" | "adjustments" | null;
}

export interface DetailedPatch {
  version: string;
  title: string;
  /** Notes going live on the wiki, a few days from the release. */
  date?: string | null;
  link: string;
  toc: { level: number; title: string; anchor: string }[];
  sections: PatchSection[];
  newHeroes: NewHero[];
  adjustments: HeroAdjustment[];
  balance: Record<AdjustmentType, number>;
}

export interface Article {
  slug: string;
  title: string;
  date: string;
  summary: string;
  category: "News" | "Patch" | "Esports" | "Guide";
  author: string;
  keywords: string[];
  content: string;
}

/** A content block of a section: a paragraph or a list item. */
export interface SectionBlock {
  type: "p" | "li";
  text: string;
}

/** A detailed section of a mode (objective, rules, features…). */
export interface ModeSection {
  title: string;
  elements: SectionBlock[];
}

/** A game mode, taken from the wiki: name, introduction, detailed sections and visual. */
export interface GameMode {
  name: string;
  slug: string;
  description: string | null;
  sections: ModeSection[];
  image: string | null;
}

/**
 * Narrative profile of a hero, extracted from the wiki's `{{Infobox hero story}}`
 * template. Each field is optional: the wiki fills them unevenly.
 */
export interface StoryProfile {
  fullName: string | null;
  title: string | null;
  species: string | null;
  gender: string | null;
  age: string | null;
  origin: string | null;
  birthday: string | null;
  affiliations: string[];
  relations: string[];
  powers: string[];
}

/**
 * Story of a hero. Three inputs: the one-line tagline from the API, the
 * long wiki lore (in paragraphs), the narrative profile and the trivia.
 */
export interface HeroStory {
  tagline: string | null;
  lore: string[];
  profile: StoryProfile | null;
  trivia: string[];
}
