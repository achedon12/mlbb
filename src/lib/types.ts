/**
 * Modele de donnees du site.
 *
 * Deux origines distinctes, volontairement separees :
 *
 * - les **donnees factuelles** (heros, skins, objets, patchs) sont extraites
 *   automatiquement du wiki par `npm run sync` et vivent dans
 *   `src/data/game/`. Elles ne se modifient pas a la main : la prochaine
 *   synchronisation les ecraserait.
 * - l'**analyse editoriale** (commentaire, builds, contres) est ecrite a la
 *   main dans `src/data/heroes/`. Elle vient se poser par-dessus, par `slug`.
 *
 * Cette separation permet au catalogue de rester a jour tout seul, sans
 * empecher d'ecrire du contenu qu'aucune extraction ne produira jamais.
 */

/** Les six roles du jeu. */
export type Role = "Tank" | "Fighter" | "Assassin" | "Mage" | "Marksman" | "Support";

/** Positions, traduites depuis les noms anglais du wiki. */
export type Lane = "Gold" | "Exp" | "Mid" | "Jungle" | "Roam";

// ─────────────────────────────────────────────────────────────
// Donnees extraites du wiki
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
  /** Identifiant du wiki, qui sert aussi a nommer les visuels. */
  id: string;
  title: string | null;
  roles: Role[];
  lanes: Lane[];
  /** Etiquettes secondaires : le wiki en utilise une quinzaine. */
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

/** Chemins locaux des visuels d'un heros. Aucune URL externe. */
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
// Analyse ecrite a la main
// ─────────────────────────────────────────────────────────────

export type SkillType = "Passive" | "Skill 1" | "Skill 2" | "Ultimate";

/**
 * Competence telle que le wiki la decrit.
 *
 * Le nom est celui du jeu ; la description est le texte officiel, ramene en
 * clair. Elle sert de repli quand personne n'a encore ecrit d'analyse en
 * francais pour ce heros.
 */
export interface WikiSkill {
  name: string;
  description: string | null;
}

export interface Skill {
  type: SkillType;
  name: string;
  description: string;
  /** Recharge par niveau, en secondes. Absente pour un passif. */
  cooldown?: number[];
  /** Cout par niveau. Absent si le heros n'utilise pas de mana. */
  cost?: number[];
}

export interface Build {
  name: string;
  /** Dans quelle situation choisir ce build. */
  context: string;
  items: string[];
  emblem: string;
  talent: string;
  spell: string;
}

/**
 * Analyse d'un heros. Tous les champs factuels (roles, lanes, sortie…) sont
 * absents ici : ils viennent de la synchronisation.
 */
export interface HeroAnalysis {
  slug: string;
  /** Presentation courte, reprise en meta description. */
  summary: string;
  /** Deux paragraphes : ce que le heros fait, puis ses limites. */
  analysis: string;
  skills: Skill[];
  strengths: string[];
  weaknesses: string[];
  strongAgainst: string[];
  weakAgainst: string[];
  builds: Build[];
}

/** Un heros tel que l'affiche le site : donnees du wiki, analyse si elle existe. */
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

/** Un changement d'equilibrage : soit un avant/apres, soit un simple texte. */
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

/** Une competence d'un nouveau heros : role (passif, skill 1…), nom, effets. */
export interface NewHeroSkill {
  role: string;
  name: string | null;
  description: string[];
}

/** Presentation structuree d'un heros introduit par le patch. */
export interface NewHero {
  name: string;
  slug: string;
  epithet: string | null;
  anchor: string | null;
  lore: string[];
  feature: string | null;
  skills: NewHeroSkill[];
}

/** Une section de premier niveau du corps du patch. */
export interface PatchSection {
  anchor: string | null;
  title: string | null;
  html: string;
  /** Sections reprises par un composant riche plutot que par le HTML brut. */
  role: "newHeroes" | "adjustments" | null;
}

export interface DetailedPatch {
  version: string;
  title: string;
  /** Mise en ligne des notes sur le wiki, a quelques jours de la sortie. */
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

/** Un bloc de contenu d'une section : un paragraphe ou un point de liste. */
export interface SectionBlock {
  type: "p" | "li";
  text: string;
}

/** Une section detaillee d'un mode (objectif, regles, fonctionnalites…). */
export interface ModeSection {
  title: string;
  elements: SectionBlock[];
}

/** Un mode de jeu, tire du wiki : nom, presentation, sections detaillees et visuel. */
export interface GameMode {
  name: string;
  slug: string;
  description: string | null;
  sections: ModeSection[];
  image: string | null;
}

/**
 * Fiche narrative d'un heros, extraite du gabarit `{{Infobox hero story}}`
 * du wiki. Chaque champ est optionnel : le wiki les remplit inegalement.
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
 * Histoire d'un heros. Trois apports : l'accroche d'une ligne de l'API, le
 * recit long du wiki (en paragraphes), la fiche narrative et les anecdotes.
 */
export interface HeroStory {
  tagline: string | null;
  lore: string[];
  profile: StoryProfile | null;
  trivia: string[];
}
