import competencesGenere from "@/data/jeu/competences.json";
import modesGenere from "@/data/jeu/modes.json";
import histoiresGenere from "@/data/jeu/histoires.json";
import herosGenere from "@/data/jeu/heros.json";
import objetsGenere from "@/data/jeu/objets.json";
import patchsGenere from "@/data/jeu/patchs.json";
import skinsGenere from "@/data/jeu/skins.json";
import synchroGenere from "@/data/jeu/synchro.json";
import statistiquesGenere from "@/data/jeu/statistiques.json";
import visuelsGenere from "@/data/jeu/visuels.json";
import { analyses } from "@/data/heros";
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

const VISUELS_VIDES: VisuelsHeros = { portrait: null, icone: null, skins: {} };

const visuels = visuelsGenere.heros as unknown as Record<string, VisuelsHeros>;
const skinsParHeros = skinsGenere as unknown as Record<string, Skin[]>;
const parSlugAnalyse = new Map(analyses.map((a) => [a.slug, a]));

export const heros: Heros[] = (herosGenere as unknown as HerosGenere[]).map((h) => ({
  ...h,
  visuels: visuels[h.slug] ?? VISUELS_VIDES,
  skins: skinsParHeros[h.slug] ?? [],
  analyse: parSlugAnalyse.get(h.slug) ?? null,
}));

export const herosParSlug = new Map(heros.map((h) => [h.slug, h]));

/** Noms anglais des competences, dans l'ordre du jeu. */
export const competences = competencesGenere as unknown as Record<
  string,
  (CompetenceWiki | null)[]
>;

/** Icone de chaque competence, indexee par son nom anglais. */
export const visuelsCompetences = visuelsGenere.competences as unknown as Record<
  string,
  Record<string, string>
>;

/**
 * Contres chiffres, tires des taux de victoire du jeu.
 *
 * Pour chaque heros : ceux contre qui son taux monte le plus (`fort`) et ceux
 * contre qui il descend (`faible`), avec l'ecart en points. Couvre les 133
 * heros, la ou l'analyse ecrite se limite a une poignee.
 */
export interface ContreChiffre {
  slug: string;
  /** Ecart de taux de victoire, en points (positif = avantage). */
  avantage: number;
}
export interface ContresHeros {
  fort: ContreChiffre[];
  faible: ContreChiffre[];
  mesure: number | null;
}
export const contres = statistiquesGenere.contres as unknown as Record<string, ContresHeros>;

/** Contenu detaille des patchs recents, avec ajustements de heros structures. */
export const patchsDetail = patchsGenere.detail as unknown as Record<string, PatchDetaille>;

/** Modes de jeu, presentes depuis le wiki. */
export const modes = modesGenere as unknown as ModeDeJeu[];
export const modesParSlug = new Map(modes.map((m) => [m.slug, m]));

/** Histoire des heros : accroche, lore, fiche narrative et anecdotes. */
export const histoires = histoiresGenere as unknown as Record<string, HistoireHeros>;

/** Illustrations pleine taille, par heros puis par nom de skin. */
export const illustrations = visuelsGenere.illustrations as unknown as Record<
  string,
  Record<string, string>
>;

export const objets = objetsGenere as unknown as ObjetGenere[];
export const objetsParSlug = new Map(objets.map((o) => [o.slug, o]));

export const patchs = patchsGenere.liste as unknown as Patch[];
export const synchro = synchroGenere as unknown as Synchro;

/** Heros disposant d'une analyse redigee, mis en avant dans les listes. */
export const herosAnalyses = heros.filter((h) => h.analyse !== null);

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

export const categoriesObjets = [...new Set(objets.map((o) => o.categorie))].sort(
  (a, b) => {
    const ia = ORDRE_CATEGORIES.indexOf(a);
    const ib = ORDRE_CATEGORIES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  },
);

/** Traduction des categories du wiki, qui sont en anglais. */
export const NOM_CATEGORIE: Record<string, string> = {
  Attack: "Attaque",
  Magic: "Magie",
  Defense: "Defense",
  Movement: "Mouvement",
  Jungling: "Jungle",
  Roaming: "Roam",
  "Attack & Magic": "Attaque et magie",
  "Attack, Magic & Defense": "Attaque, magie et defense",
};

export const nomCategorie = (c: string) => NOM_CATEGORIE[c] ?? c;
