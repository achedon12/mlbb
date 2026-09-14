import generatedWatch from "@/data/game/watch.json";

/**
 * Veille automatique.
 *
 * Le site agrege des flux publics et n'affiche que ce qu'un agregateur peut
 * legitimement montrer : un titre, une date, un court extrait et un lien vers
 * la source. Le contenu integral n'est jamais recopie — on renvoie chez
 * l'editeur d'origine.
 *
 * Aucune interrogation reseau a l'execution : l'instantane est pris en amont
 * par `scripts/watch.mjs` (en CI, a intervalle regulier) et lu ici depuis
 * `src/data/game/watch.json`. Le site ne depend d'aucun service externe.
 */

export interface Source {
  slug: string;
  name: string;
  /** Page d'accueil de la source, affichee comme credit. */
  site: string;
}

export const sources: Source[] = [
  { slug: "reddit", name: "r/MobileLegendsGame", site: "https://www.reddit.com/r/MobileLegendsGame/" },
  { slug: "esports-gg", name: "Esports.gg", site: "https://esports.gg/" },
];

export interface News {
  title: string;
  link: string;
  date: string;
  excerpt: string;
  source: string;
  sourceSlug: string;
}

interface Snapshot {
  measuredAt: string;
  news: News[];
}

const snapshot = generatedWatch as unknown as Snapshot;

/** Date de l'instantane (derniere collecte des flux). */
export const measureWatch = snapshot.measuredAt;

/** Les actualites de l'instantane, deja triees du plus recent au plus ancien. */
export function watch(limit = 40): News[] {
  return snapshot.news.slice(0, limit);
}
