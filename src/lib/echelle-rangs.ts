/**
 * Echelle des rangs classes, de Guerrier a Immortel mythique.
 *
 * Deux sources, qui concordent :
 *
 * - divisions et plages de `rank_level` : la table officielle du jeu, telle que
 *   la renvoie l'API de statistiques (`/api/academy/ranks`, 29 entrees, relevee
 *   le 11 septembre 2026). C'est la table dont `rangs.ts` tire ses seuils ; les
 *   tests verifient que les deux restent alignes ;
 * - etoiles par division, points mythiques, draft, bans et points d'etoiles :
 *   la page « Ranked » du wiki Fandom (consultee le 11 septembre 2026).
 *
 * Une division couvre `etoilesMax + 1` rank_level (de 0 a max etoiles), sauf
 * Guerrier II et I, qui en couvrent trois : on y entre avec une etoile.
 *
 * Les recompenses de fin de saison viennent de la page « Season Rank Rewards »
 * du meme wiki : des montants d'une saison passee, a presenter comme tels.
 */
import { rangLisible } from "./rangs";
import type { RangMesure } from "./rangs-mesure";

export const SOURCES_RANGS = {
  classe: "https://mobilelegends.fandom.com/wiki/Ranked",
  recompenses: "https://mobilelegends.fandom.com/wiki/Season_Rank_Rewards",
  table: "https://arena.rone.dev/api/academy/ranks",
} as const;

export interface PalierEchelle {
  /** Cle d'embleme et de libelle (`rankNames.*`). */
  cle: string;
  /** Divisions, de la plus basse a la plus haute ; vide dans la famille Mythique. */
  divisions: string[];
  /** Etoiles maximum par division ; null dans la famille Mythique, qui compte des points. */
  etoilesMax: number | null;
  /** Points mythiques du palier, bornes incluses ; `max` null pour le dernier. */
  points: { min: number; max: number | null } | null;
  /** Plage de rank_level de la table officielle ; `fin` null pour le dernier palier. */
  rankLevel: { debut: number; fin: number | null };
  /** Tranche de rang pour laquelle le jeu publie des mesures, s'il y en a une. */
  mesure: RangMesure | null;
  /** Famille du palier, pour les regles communes (draft, points d'etoiles). */
  famille: FamilleRang;
}

export type FamilleRang = "guerrier" | "elite" | "maitre" | "grand-maitre" | "epique" | "legende" | "mythique";

export const ECHELLE: PalierEchelle[] = [
  {
    cle: "guerrier",
    divisions: ["III", "II", "I"],
    etoilesMax: 3,
    points: null,
    rankLevel: { debut: 1, fin: 10 },
    mesure: null,
    famille: "guerrier",
  },
  {
    cle: "elite",
    divisions: ["III", "II", "I"],
    etoilesMax: 4,
    points: null,
    rankLevel: { debut: 11, fin: 25 },
    mesure: null,
    famille: "elite",
  },
  {
    cle: "maitre",
    divisions: ["IV", "III", "II", "I"],
    etoilesMax: 4,
    points: null,
    rankLevel: { debut: 26, fin: 45 },
    mesure: null,
    famille: "maitre",
  },
  {
    cle: "grand-maitre",
    divisions: ["V", "IV", "III", "II", "I"],
    etoilesMax: 5,
    points: null,
    rankLevel: { debut: 46, fin: 75 },
    mesure: null,
    famille: "grand-maitre",
  },
  {
    cle: "epique",
    divisions: ["V", "IV", "III", "II", "I"],
    etoilesMax: 5,
    points: null,
    rankLevel: { debut: 76, fin: 105 },
    mesure: "epic",
    famille: "epique",
  },
  {
    cle: "legende",
    divisions: ["V", "IV", "III", "II", "I"],
    etoilesMax: 5,
    points: null,
    rankLevel: { debut: 106, fin: 135 },
    mesure: "legend",
    famille: "legende",
  },
  {
    cle: "mythique",
    divisions: [],
    etoilesMax: null,
    points: { min: 0, max: 24 },
    rankLevel: { debut: 136, fin: 160 },
    mesure: "mythic",
    famille: "mythique",
  },
  {
    cle: "mythique-honneur",
    divisions: [],
    etoilesMax: null,
    points: { min: 25, max: 49 },
    rankLevel: { debut: 161, fin: 185 },
    mesure: "honor",
    famille: "mythique",
  },
  {
    cle: "mythique-gloire",
    divisions: [],
    etoilesMax: null,
    points: { min: 50, max: 99 },
    rankLevel: { debut: 186, fin: 235 },
    mesure: "glory",
    famille: "mythique",
  },
  {
    cle: "mythique-immortel",
    divisions: [],
    etoilesMax: null,
    points: { min: 100, max: null },
    rankLevel: { debut: 236, fin: null },
    mesure: null,
    famille: "mythique",
  },
];

/** Couleur et embleme d'un palier : ceux de `rangs.ts`, sauf Legende, qui n'y figure pas. */
export function apparencePalier(p: PalierEchelle): { couleur: string; image: string | null } {
  const r = rangLisible(p.rankLevel.debut);
  return { couleur: r.couleur, image: r.image };
}

/**
 * Regles par famille, page « Ranked » : le draft s'ouvre en Epique V, avec 3,
 * 4 puis 5 bans par equipe en Epique, Legende et Mythique ; les points de
 * montee donnent une etoile de plus a 100 %, ceux de protection evitent d'en
 * perdre une. La famille Mythique n'a pas de points de montee.
 */
export const REGLES_FAMILLE: Record<
  FamilleRang,
  { bans: number | null; pointsMontee: number | null; pointsProtection: number }
> = {
  guerrier: { bans: null, pointsMontee: 100, pointsProtection: 100 },
  elite: { bans: null, pointsMontee: 200, pointsProtection: 200 },
  maitre: { bans: null, pointsMontee: 300, pointsProtection: 300 },
  "grand-maitre": { bans: null, pointsMontee: 500, pointsProtection: 500 },
  epique: { bans: 3, pointsMontee: 700, pointsProtection: 700 },
  legende: { bans: 4, pointsMontee: 1000, pointsProtection: 1000 },
  mythique: { bans: 5, pointsMontee: null, pointsProtection: 1500 },
};

/**
 * Recompenses de fin de saison par rang final, page « Season Rank Rewards » :
 * points de bataille, tickets et fragments premium. Montants d'une saison
 * passee ; le jeu les ajuste parfois.
 */
export const RECOMPENSES_SAISON: {
  famille: FamilleRang;
  pointsBataille: number;
  tickets: number;
  fragments: number | null;
  embleme?: boolean;
}[] = [
  { famille: "guerrier", pointsBataille: 500, tickets: 50, fragments: 1 },
  { famille: "elite", pointsBataille: 1000, tickets: 100, fragments: 3 },
  { famille: "maitre", pointsBataille: 2000, tickets: 150, fragments: null },
  { famille: "grand-maitre", pointsBataille: 3500, tickets: 300, fragments: null },
  { famille: "epique", pointsBataille: 6500, tickets: 500, fragments: null },
  { famille: "legende", pointsBataille: 10000, tickets: 750, fragments: null },
  { famille: "mythique", pointsBataille: 10000, tickets: 750, fragments: null, embleme: true },
];

/** Palier de la famille (le premier), pour afficher son nom et son embleme. */
export function palierDeFamille(famille: FamilleRang): PalierEchelle {
  return ECHELLE.find((p) => p.famille === famille)!;
}
