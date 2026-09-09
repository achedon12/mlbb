import classement from "@/data/genere/classement.json";
import { notesTierList } from "@/data/tier-list";
import { heros } from "./donnees";
import type { Heros, Palier } from "./types";

/**
 * Tier list calculee.
 *
 * Elle ne repose plus sur une opinion mais sur les taux remontes par le jeu :
 * victoire, ban et selection. Le classement se refait donc tout seul a chaque
 * synchronisation, et suit les patchs sans intervention.
 *
 * Le score combine deux signaux qui disent des choses differentes :
 *
 * - le **taux de victoire** mesure ce que le heros produit une fois joue ;
 * - le **taux de ban** mesure ce que les joueurs redoutent, ce qui capte les
 *   heros trop forts pour etre laisses libres — precisement ceux dont le taux
 *   de victoire est trompeusement bas parce qu'ils sont rarement disponibles.
 *
 * Le taux de selection n'entre pas dans le score : il mesure la popularite,
 * pas la puissance. Il sert uniquement a signaler les mesures peu fiables.
 */
export interface EntreeClassee {
  heros: Heros;
  palier: Palier;
  victoire: number;
  ban: number;
  selection: number;
  score: number;
  /** Vrai quand le heros est trop peu joue pour que ses taux soient stables. */
  faibleEchantillon: boolean;
  /** Commentaire ecrit a la main, quand il existe. */
  note: string | null;
}

interface Taux {
  victoire: number;
  ban: number;
  selection: number;
}

const TAUX = classement as unknown as Record<string, Taux>;

/** En dessous de ce taux de selection, les mesures deviennent bruitees. */
const SEUIL_FIABILITE = 0.3;

/**
 * Un ban coute un choix a l'equipe adverse : un heros banni une fois sur deux
 * pese autant qu'un heros qui gagne quelques points de plus. Le quart est le
 * rapport qui reproduit le mieux les priorites observees en file classee.
 */
const POIDS_BAN = 0.25;

function score(t: Taux): number {
  return t.victoire + t.ban * POIDS_BAN;
}

/** Bornes de palier, en points de score. */
const PALIERS: [Palier, number][] = [
  ["S+", 56],
  ["S", 53],
  ["A", 50.5],
  ["B", 48],
  ["C", -Infinity],
];

function palier(valeur: number): Palier {
  return PALIERS.find(([, seuil]) => valeur >= seuil)?.[0] ?? "C";
}

export const classementComplet: EntreeClassee[] = heros
  .filter((h) => TAUX[h.slug])
  .map((h) => {
    const t = TAUX[h.slug];
    const valeur = score(t);

    return {
      heros: h,
      palier: palier(valeur),
      victoire: t.victoire,
      ban: t.ban,
      selection: t.selection,
      score: Math.round(valeur * 100) / 100,
      faibleEchantillon: t.selection < SEUIL_FIABILITE,
      note: notesTierList[h.slug] ?? null,
    };
  })
  .sort((a, b) => b.score - a.score);

export const ORDRE_PALIERS: Palier[] = ["S+", "S", "A", "B", "C"];

export const LEGENDE_PALIERS: Record<Palier, string> = {
  "S+": "Domine le patch. A prendre ou a bannir.",
  S: "Tres fort dans la majorite des compositions.",
  A: "Solide, sans imposer le rythme de la partie.",
  B: "Correct, mais depend du contexte ou du joueur.",
  C: "Jouable, avec un cout reel par rapport aux alternatives.",
};

export function parPalier(p: Palier): EntreeClassee[] {
  return classementComplet.filter((e) => e.palier === p);
}
