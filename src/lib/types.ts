/**
 * Modele de donnees du site.
 *
 * Tout est type ici plutot que dans chaque fichier de donnees : le jeu evolue
 * a chaque patch, et une forme unique permet a un contributeur d'ajouter un
 * heros sans avoir a deviner les champs attendus.
 */

/** Les six roles officiels du jeu. */
export type Role =
  | "Tank"
  | "Fighter"
  | "Assassin"
  | "Mage"
  | "Marksman"
  | "Support";

/** Les cinq positions de la carte, telles que nommees en file classee. */
export type Lane = "Or" | "Experience" | "Milieu" | "Jungle" | "Roam";

/** Etiquettes secondaires affichees par le jeu sous le role principal. */
export type Specialite =
  | "Degats"
  | "Charge"
  | "Poussee"
  | "Deplacement"
  | "Controle"
  | "Soin"
  | "Regeneration"
  | "Protection"
  | "Invocation"
  | "Alliance"
  | "Explosion";

export type TypeCompetence = "Passif" | "Competence 1" | "Competence 2" | "Ultime";

export interface Competence {
  type: TypeCompetence;
  nom: string;
  description: string;
  /** Temps de recharge par niveau, en secondes. Vide pour un passif. */
  recharge?: number[];
  /** Cout en mana par niveau. Vide si le heros n'utilise pas de mana. */
  cout?: number[];
}

export interface Build {
  nom: string;
  /** Pourquoi ce build, et dans quelle situation le choisir. */
  contexte: string;
  objets: string[];
  embleme: string;
  talent: string;
  sort: string;
}

export interface Heros {
  slug: string;
  nom: string;
  /** Titre affiche sous le nom dans le jeu, ex. « Sombre Sorciere ». */
  titre: string;
  roles: Role[];
  lanes: Lane[];
  specialites: Specialite[];
  /** Annee de sortie du heros. */
  sortie: number;
  /** 1 a 10, telle qu'annoncee par le jeu. */
  difficulte: number;
  /** Presentation courte, affichee en tete de fiche et en meta description. */
  resume: string;
  /** Analyse plus longue : ce que le heros fait vraiment, et ses limites. */
  analyse: string;
  competences: Competence[];
  forces: string[];
  faiblesses: string[];
  /** Slugs des heros contre lesquels il est a l'aise. */
  fortContre: string[];
  /** Slugs des heros qui le mettent en difficulte. */
  faibleContre: string[];
  builds: Build[];
}

export type Palier = "S+" | "S" | "A" | "B" | "C";

export interface EntreeTierList {
  heros: string;
  palier: Palier;
  lane: Lane;
  /** Ce qui justifie le placement au patch courant. */
  note: string;
}

export interface TierList {
  patch: string;
  miseAJour: string;
  entrees: EntreeTierList[];
}

export type CategorieObjet =
  | "Attaque"
  | "Magie"
  | "Defense"
  | "Mouvement"
  | "Jungle"
  | "Roam";

export interface Objet {
  slug: string;
  nom: string;
  categorie: CategorieObjet;
  prix: number;
  statistiques: Record<string, string>;
  passif?: { nom: string; description: string };
  /** A qui il sert, concretement. */
  usage: string;
}

export interface Article {
  slug: string;
  titre: string;
  /** Date ISO, utilisee pour le tri, le flux RSS et les donnees structurees. */
  date: string;
  /** Chapeau : sert de meta description et de resume dans le flux. */
  chapeau: string;
  categorie: "Actualite" | "Patch" | "Esport" | "Guide";
  auteur: string;
  motsCles: string[];
  /** Corps de l'article, en Markdown. */
  contenu: string;
}
