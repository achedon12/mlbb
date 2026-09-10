import veilleGenere from "@/data/jeu/veille.json";

/**
 * Veille automatique.
 *
 * Le site agrege des flux publics et n'affiche que ce qu'un agregateur peut
 * legitimement montrer : un titre, une date, un court extrait et un lien vers
 * la source. Le contenu integral n'est jamais recopie — on renvoie chez
 * l'editeur d'origine.
 *
 * Aucune interrogation reseau a l'execution : l'instantane est pris en amont
 * par `scripts/veille.mjs` (en CI, a intervalle regulier) et lu ici depuis
 * `src/data/jeu/veille.json`. Le site ne depend d'aucun service externe.
 */

export interface Source {
  slug: string;
  nom: string;
  /** Page d'accueil de la source, affichee comme credit. */
  site: string;
}

export const sources: Source[] = [
  { slug: "reddit", nom: "r/MobileLegendsGame", site: "https://www.reddit.com/r/MobileLegendsGame/" },
  { slug: "esports-gg", nom: "Esports.gg", site: "https://esports.gg/" },
];

export interface Actualite {
  titre: string;
  lien: string;
  date: string;
  extrait: string;
  source: string;
  sourceSlug: string;
}

interface Instantane {
  mesure: string;
  actualites: Actualite[];
}

const instantane = veilleGenere as unknown as Instantane;

/** Date de l'instantane (derniere collecte des flux). */
export const mesureVeille = instantane.mesure;

/** Les actualites de l'instantane, deja triees du plus recent au plus ancien. */
export function veille(limite = 40): Actualite[] {
  return instantane.actualites.slice(0, limite);
}
