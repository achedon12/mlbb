import statistiques from "@/data/jeu/statistiques.json";
import { notesTierList } from "@/data/tier-list";
import { heros } from "./donnees";
import { RANGS_MESURE, type RangMesure } from "./rangs-mesure";
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

interface Classement {
  /** Date a laquelle les taux ont ete releves, distincte de la synchronisation. */
  mesure: string;
  taux: Record<string, Taux>;
  /** Memes taux, rang par rang. Absent d'un fichier anterieur a ce decoupage. */
  parRang?: Partial<Record<RangMesure, Record<string, Taux>>>;
}

const CLASSEMENT = statistiques.classement as unknown as Classement;
const TAUX = CLASSEMENT.taux;

/** Date du releve, a afficher plutot que celle de la derniere synchronisation. */
export const mesureLe = CLASSEMENT.mesure;

/** En dessous de ce taux de selection, les mesures deviennent bruitees. */
const SEUIL_FIABILITE = 0.3;

/**
 * Un ban coute un choix a l'equipe adverse : un heros banni une fois sur deux
 * pese autant qu'un heros qui gagne quelques points de plus. Le quart est le
 * rapport qui reproduit le mieux les priorites observees en file classee.
 */
const POIDS_BAN = 0.25;

function score(t: Pick<Taux, "victoire" | "ban">): number {
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

/** La regle de la tier list, pour des taux d'une autre date (changements de palier du rapport meta). */
export const regleTierList = { score, palier };

function classer(taux: Record<string, Taux>): EntreeClassee[] {
  return heros
    .filter((h) => taux[h.slug])
    .map((h) => {
      const t = taux[h.slug];
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
}

export const classementComplet = classer(TAUX);

/** Taux et palier d'un heros dans un rang donne. */
export interface StatsRang {
  victoire: number;
  ban: number;
  palier: Palier;
}

/**
 * La regle de la tier list, appliquee a chaque tranche de rang : un heros peut
 * etre S en Mythique et seulement A tous rangs confondus.
 */
const CLASSEMENTS_PAR_RANG = new Map(
  RANGS_MESURE.flatMap((r) => {
    const taux = r === "all" ? TAUX : CLASSEMENT.parRang?.[r];
    return taux
      ? [[r, new Map(classer(taux).map((e) => [e.heros.slug, e]))] as const]
      : [];
  }),
);

export function statsParRang(
  slug: string,
): Partial<Record<RangMesure, StatsRang>> {
  const sortie: Partial<Record<RangMesure, StatsRang>> = {};
  for (const [rang, entrees] of CLASSEMENTS_PAR_RANG) {
    const e = entrees.get(slug);
    if (e)
      sortie[rang] = { victoire: e.victoire, ban: e.ban, palier: e.palier };
  }
  return sortie;
}

/** Taux et palier par heros, pour enrichir le catalogue sans le recalculer. */
export const tauxParSlug = new Map(
  classementComplet.map((e) => [
    e.heros.slug,
    {
      victoire: e.victoire,
      ban: e.ban,
      palier: e.palier,
      faibleEchantillon: e.faibleEchantillon,
    },
  ]),
);

export const ORDRE_PALIERS: Palier[] = ["S+", "S", "A", "B", "C"];

/** Rangs qui ont leur propre classement, tous rangs confondus en tete. */
export const RANGS_CLASSES = RANGS_MESURE.filter((r) => CLASSEMENTS_PAR_RANG.has(r));

/** Classement d'une tranche de rang, du plus fort au plus faible. */
export function classementDuRang(rang: RangMesure): EntreeClassee[] {
  return [...(CLASSEMENTS_PAR_RANG.get(rang)?.values() ?? [])];
}
