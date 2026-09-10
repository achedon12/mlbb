/**
 * Modele de donnees du site.
 *
 * Deux origines distinctes, volontairement separees :
 *
 * - les **donnees factuelles** (heros, skins, objets, patchs) sont extraites
 *   automatiquement du wiki par `npm run sync` et vivent dans
 *   `src/data/genere/`. Elles ne se modifient pas a la main : la prochaine
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
  offensive: number | null;
  resistance: number | null;
  effets: number | null;
  difficulte: number | null;
}

export interface HerosGenere {
  slug: string;
  nom: string;
  /** Identifiant du wiki, qui sert aussi a nommer les visuels. */
  id: string;
  titre: string | null;
  roles: Role[];
  lanes: Lane[];
  /** Etiquettes secondaires : le wiki en utilise une quinzaine. */
  specialites: string[];
  sortie: string | null;
  annee: string | null;
  ressource: string | null;
  typeDegats: string | null;
  typeAttaque: string | null;
  region: string | null;
  notes: NotesHeros;
  stats: Record<string, string> | null;
}

export interface Skin {
  id: string;
  nom: string;
  sortie: string | null;
  disponibilite: string | null;
  rarete: string | null;
  etiquette: string | null;
  prix: Record<string, string>;
}

export interface ObjetGenere {
  slug: string;
  nom: string;
  resume: string | null;
  categorie: string;
  prix: number | null;
  bonus: string | null;
  unique: string | null;
  passif: string | null;
  actif: string | null;
  recette: string[];
  pourQui: string | null;
}

export interface Patch {
  version: string;
  titre: string;
  lien: string;
}

/** Chemins locaux des visuels d'un heros. Aucune URL externe. */
export interface VisuelsHeros {
  portrait: string | null;
  icone: string | null;
  skins: Record<string, string>;
}

export interface Synchro {
  date: string;
  source: string;
  heros: number;
  skins: number;
  objets: number;
  patchs: number;
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
  nom: string;
  description: string | null;
}

export interface Competence {
  type: TypeCompetence;
  nom: string;
  description: string;
  /** Recharge par niveau, en secondes. Absente pour un passif. */
  recharge?: number[];
  /** Cout par niveau. Absent si le heros n'utilise pas de mana. */
  cout?: number[];
}

export interface Build {
  nom: string;
  /** Dans quelle situation choisir ce build. */
  contexte: string;
  objets: string[];
  embleme: string;
  talent: string;
  sort: string;
}

/**
 * Analyse d'un heros. Tous les champs factuels (roles, lanes, sortie…) sont
 * absents ici : ils viennent de la synchronisation.
 */
export interface AnalyseHeros {
  slug: string;
  /** Presentation courte, reprise en meta description. */
  resume: string;
  /** Deux paragraphes : ce que le heros fait, puis ses limites. */
  analyse: string;
  competences: Competence[];
  forces: string[];
  faiblesses: string[];
  fortContre: string[];
  faibleContre: string[];
  builds: Build[];
}

/** Un heros tel que l'affiche le site : donnees du wiki, analyse si elle existe. */
export interface Heros extends HerosGenere {
  visuels: VisuelsHeros;
  skins: Skin[];
  analyse: AnalyseHeros | null;
}

export type Palier = "S+" | "S" | "A" | "B" | "C";

export interface EntreeTierList {
  heros: string;
  palier: Palier;
  lane: Lane;
  note: string;
}

export interface TierList {
  patch: string;
  miseAJour: string;
  entrees: EntreeTierList[];
}

/** Un changement d'equilibrage : soit un avant/apres, soit un simple texte. */
export type Changement =
  | { libelle: string | null; avant: string; apres: string }
  | { texte: string };

export interface SectionAjustement {
  nom: string;
  categorie: string | null;
  type: TypeAjustement | null;
  changements: Changement[];
}

export type TypeAjustement = "amelioration" | "affaiblissement" | "ajustement";

export interface AjustementHeros {
  nom: string;
  slug: string;
  type: TypeAjustement | null;
  intro: string;
  sections: SectionAjustement[];
}

/** Une competence d'un nouveau heros : role (passif, skill 1…), nom, effets. */
export interface CompetenceNouvelle {
  role: string;
  nom: string | null;
  description: string[];
}

/** Presentation structuree d'un heros introduit par le patch. */
export interface NouveauHeros {
  nom: string;
  slug: string;
  epithete: string | null;
  ancre: string | null;
  lore: string[];
  feature: string | null;
  competences: CompetenceNouvelle[];
}

/** Une section de premier niveau du corps du patch. */
export interface SectionPatch {
  ancre: string | null;
  titre: string | null;
  html: string;
  /** Sections reprises par un composant riche plutot que par le HTML brut. */
  role: "nouveaux" | "ajustements" | null;
}

export interface PatchDetaille {
  version: string;
  titre: string;
  lien: string;
  sommaire: { niveau: number; titre: string; ancre: string }[];
  sections: SectionPatch[];
  nouveaux: NouveauHeros[];
  ajustements: AjustementHeros[];
  bilan: Record<TypeAjustement, number>;
}

export interface Article {
  slug: string;
  titre: string;
  date: string;
  chapeau: string;
  categorie: "Actualite" | "Patch" | "Esport" | "Guide";
  auteur: string;
  motsCles: string[];
  contenu: string;
}

/** Un mode de jeu, tire du wiki : nom, presentation et visuel. */
export interface ModeDeJeu {
  nom: string;
  slug: string;
  description: string | null;
  image: string | null;
}
