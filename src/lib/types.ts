/**
 * Modele de donnees du site.
 *
 * Deux origines distinctes, volontairement separees :
 *
 * - les **donnees factuelles** (heros, skins, objets, patchs) sont extraites
 *   automatiquement du wiki par `npm run sync` et vivent dans
 *   `src/data/jeu/`. Elles ne se modifient pas a la main : la prochaine
 *   synchronisation les ecraserait.
 * - l'**analyse editoriale** (commentaire, builds, contres) est ecrite a la
 *   main dans `src/data/heros/`. Elle vient se poser par-dessus, par `slug`.
 *
 * Cette separation permet au catalogue de rester a jour tout seul, sans
 * empecher d'ecrire du contenu qu'aucune extraction ne produira jamais.
 */

/** Les six roles du jeu. */
export type Role = "Tank" | "Fighter" | "Assassin" | "Mage" | "Marksman" | "Support";

/** Positions, traduites depuis les noms anglais du wiki. */
export type Lane = "Or" | "Experience" | "Milieu" | "Jungle" | "Roam";

// ─────────────────────────────────────────────────────────────
// Donnees extraites du wiki
// ─────────────────────────────────────────────────────────────

export interface NotesHeros {
  offense: number | null;
  durability: number | null;
  abilityEffects: number | null;
  difficulty: number | null;
}

export interface HerosGenere {
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
  ratings: NotesHeros;
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

export interface ObjetGenere {
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
export interface VisuelsHeros {
  portrait: string | null;
  icon: string | null;
  skins: Record<string, string>;
}

export interface Synchro {
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

export type TypeCompetence = "Passif" | "Competence 1" | "Competence 2" | "Ultime";

/**
 * Competence telle que le wiki la decrit.
 *
 * Le nom est celui du jeu ; la description est le texte officiel, ramene en
 * clair. Elle sert de repli quand personne n'a encore ecrit d'analyse en
 * francais pour ce heros.
 */
export interface CompetenceWiki {
  name: string;
  description: string | null;
}

export interface Competence {
  type: TypeCompetence;
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
export interface AnalyseHeros {
  slug: string;
  /** Presentation courte, reprise en meta description. */
  summary: string;
  /** Deux paragraphes : ce que le heros fait, puis ses limites. */
  analysis: string;
  skills: Competence[];
  strengths: string[];
  weaknesses: string[];
  strongAgainst: string[];
  weakAgainst: string[];
  builds: Build[];
}

/** Un heros tel que l'affiche le site : donnees du wiki, analyse si elle existe. */
export interface Heros extends HerosGenere {
  images: VisuelsHeros;
  skins: Skin[];
  analysis: AnalyseHeros | null;
}

export type Palier = "S+" | "S" | "A" | "B" | "C";

export interface EntreeTierList {
  hero: string;
  tier: Palier;
  lane: Lane;
  comment: string;
}

export interface TierList {
  patch: string;
  updated: string;
  entries: EntreeTierList[];
}

/** Un changement d'equilibrage : soit un avant/apres, soit un simple texte. */
export type Changement =
  | { label: string | null; before: string; after: string }
  | { text: string };

export interface SectionAjustement {
  name: string;
  category: string | null;
  type: TypeAjustement | null;
  changes: Changement[];
}

export type TypeAjustement = "amelioration" | "affaiblissement" | "ajustement";

export interface AjustementHeros {
  name: string;
  slug: string;
  type: TypeAjustement | null;
  intro: string;
  sections: SectionAjustement[];
}

/** Une competence d'un nouveau heros : role (passif, skill 1…), nom, effets. */
export interface CompetenceNouvelle {
  role: string;
  name: string | null;
  description: string[];
}

/** Presentation structuree d'un heros introduit par le patch. */
export interface NouveauHeros {
  name: string;
  slug: string;
  epithet: string | null;
  anchor: string | null;
  lore: string[];
  feature: string | null;
  skills: CompetenceNouvelle[];
}

/** Une section de premier niveau du corps du patch. */
export interface SectionPatch {
  anchor: string | null;
  title: string | null;
  html: string;
  /** Sections reprises par un composant riche plutot que par le HTML brut. */
  role: "nouveaux" | "ajustements" | null;
}

export interface PatchDetaille {
  version: string;
  title: string;
  /** Mise en ligne des notes sur le wiki, a quelques jours de la sortie. */
  date?: string | null;
  link: string;
  toc: { level: number; title: string; anchor: string }[];
  sections: SectionPatch[];
  newHeroes: NouveauHeros[];
  adjustments: AjustementHeros[];
  balance: Record<TypeAjustement, number>;
}

export interface Article {
  slug: string;
  title: string;
  date: string;
  summary: string;
  category: "Actualite" | "Patch" | "Esport" | "Guide";
  author: string;
  keywords: string[];
  content: string;
}

/** Un bloc de contenu d'une section : un paragraphe ou un point de liste. */
export interface BlocSection {
  type: "p" | "li";
  text: string;
}

/** Une section detaillee d'un mode (objectif, regles, fonctionnalites…). */
export interface SectionMode {
  title: string;
  elements: BlocSection[];
}

/** Un mode de jeu, tire du wiki : nom, presentation, sections detaillees et visuel. */
export interface ModeDeJeu {
  name: string;
  slug: string;
  description: string | null;
  sections: SectionMode[];
  image: string | null;
}

/**
 * Fiche narrative d'un heros, extraite du gabarit `{{Infobox hero story}}`
 * du wiki. Chaque champ est optionnel : le wiki les remplit inegalement.
 */
export interface FicheHistoire {
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
export interface HistoireHeros {
  tagline: string | null;
  lore: string[];
  profile: FicheHistoire | null;
  trivia: string[];
}
