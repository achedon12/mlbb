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
import { readableRank } from "./ranks";
import type { MeasuredRank } from "./measured-ranks";

export const SOURCES_RANKS = {
  ranked: "https://mobilelegends.fandom.com/wiki/Ranked",
  rewards: "https://mobilelegends.fandom.com/wiki/Season_Rank_Rewards",
  table: "https://arena.rone.dev/api/academy/ranks",
} as const;

export interface TierScale {
  /** Cle d'embleme et de libelle (`rankNames.*`). */
  key: string;
  /** Divisions, de la plus basse a la plus haute ; vide dans la famille Mythique. */
  divisions: string[];
  /** Etoiles maximum par division ; null dans la famille Mythique, qui compte des points. */
  starsMax: number | null;
  /** Points mythiques du palier, bornes incluses ; `max` null pour le dernier. */
  points: { min: number; max: number | null } | null;
  /** Plage de rank_level de la table officielle ; `fin` null pour le dernier palier. */
  rankLevel: { start: number; end: number | null };
  /** Tranche de rang pour laquelle le jeu publie des mesures, s'il y en a une. */
  measure: MeasuredRank | null;
  /** Famille du palier, pour les regles communes (draft, points d'etoiles). */
  family: FamilyRank;
}

export type FamilyRank = "warrior" | "elite" | "master" | "grandmaster" | "epic" | "legend" | "mythic";

export const SCALE: TierScale[] = [
  {
    key: "warrior",
    divisions: ["III", "II", "I"],
    starsMax: 3,
    points: null,
    rankLevel: { start: 1, end: 10 },
    measure: null,
    family: "warrior",
  },
  {
    key: "elite",
    divisions: ["III", "II", "I"],
    starsMax: 4,
    points: null,
    rankLevel: { start: 11, end: 25 },
    measure: null,
    family: "elite",
  },
  {
    key: "master",
    divisions: ["IV", "III", "II", "I"],
    starsMax: 4,
    points: null,
    rankLevel: { start: 26, end: 45 },
    measure: null,
    family: "master",
  },
  {
    key: "grandmaster",
    divisions: ["V", "IV", "III", "II", "I"],
    starsMax: 5,
    points: null,
    rankLevel: { start: 46, end: 75 },
    measure: null,
    family: "grandmaster",
  },
  {
    key: "epic",
    divisions: ["V", "IV", "III", "II", "I"],
    starsMax: 5,
    points: null,
    rankLevel: { start: 76, end: 105 },
    measure: "epic",
    family: "epic",
  },
  {
    key: "legend",
    divisions: ["V", "IV", "III", "II", "I"],
    starsMax: 5,
    points: null,
    rankLevel: { start: 106, end: 135 },
    measure: "legend",
    family: "legend",
  },
  {
    key: "mythic",
    divisions: [],
    starsMax: null,
    points: { min: 0, max: 24 },
    rankLevel: { start: 136, end: 160 },
    measure: "mythic",
    family: "mythic",
  },
  {
    key: "mythic-honor",
    divisions: [],
    starsMax: null,
    points: { min: 25, max: 49 },
    rankLevel: { start: 161, end: 185 },
    measure: "honor",
    family: "mythic",
  },
  {
    key: "mythic-glory",
    divisions: [],
    starsMax: null,
    points: { min: 50, max: 99 },
    rankLevel: { start: 186, end: 235 },
    measure: "glory",
    family: "mythic",
  },
  {
    key: "mythic-immortal",
    divisions: [],
    starsMax: null,
    points: { min: 100, max: null },
    rankLevel: { start: 236, end: null },
    measure: null,
    family: "mythic",
  },
];

/** Couleur et embleme d'un palier : ceux de `rangs.ts`, sauf Legende, qui n'y figure pas. */
export function tierAppearance(p: TierScale): { color: string; image: string | null } {
  const r = readableRank(p.rankLevel.start);
  return { color: r.color, image: r.image };
}

/**
 * Regles par famille, page « Ranked » : le draft s'ouvre en Epique V, avec 3,
 * 4 puis 5 bans par equipe en Epique, Legende et Mythique ; les points de
 * montee donnent une etoile de plus a 100 %, ceux de protection evitent d'en
 * perdre une. La famille Mythique n'a pas de points de montee.
 */
export const RULES_FAMILY: Record<
  FamilyRank,
  { bans: number | null; climbPoints: number | null; pointsProtection: number }
> = {
  warrior: { bans: null, climbPoints: 100, pointsProtection: 100 },
  elite: { bans: null, climbPoints: 200, pointsProtection: 200 },
  master: { bans: null, climbPoints: 300, pointsProtection: 300 },
  "grandmaster": { bans: null, climbPoints: 500, pointsProtection: 500 },
  epic: { bans: 3, climbPoints: 700, pointsProtection: 700 },
  legend: { bans: 4, climbPoints: 1000, pointsProtection: 1000 },
  mythic: { bans: 5, climbPoints: null, pointsProtection: 1500 },
};

/**
 * Recompenses de fin de saison par rang final, page « Season Rank Rewards » :
 * points de bataille, tickets et fragments premium. Montants d'une saison
 * passee ; le jeu les ajuste parfois.
 */
export const REWARDS_SEASON: {
  family: FamilyRank;
  battlePoints: number;
  tickets: number;
  fragments: number | null;
  emblem?: boolean;
}[] = [
  { family: "warrior", battlePoints: 500, tickets: 50, fragments: 1 },
  { family: "elite", battlePoints: 1000, tickets: 100, fragments: 3 },
  { family: "master", battlePoints: 2000, tickets: 150, fragments: null },
  { family: "grandmaster", battlePoints: 3500, tickets: 300, fragments: null },
  { family: "epic", battlePoints: 6500, tickets: 500, fragments: null },
  { family: "legend", battlePoints: 10000, tickets: 750, fragments: null },
  { family: "mythic", battlePoints: 10000, tickets: 750, fragments: null, emblem: true },
];

/** Palier de la famille (le premier), pour afficher son nom et son embleme. */
export function tierOfFamily(family: FamilyRank): TierScale {
  return SCALE.find((p) => p.family === family)!;
}
