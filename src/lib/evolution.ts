import evolutionGenere from "@/data/jeu/evolution.json";
import type { RangMesure } from "./rangs-mesure";

/**
 * Evolution des taux d'un heros : series quotidiennes sur trente jours par
 * rang, taux de victoire par duree de partie, et historique long cumule d'une
 * synchronisation a l'autre. Lu par la seule fiche heros : le fichier reste
 * hors des pages qui n'en ont pas besoin.
 */

/** Taux quotidiens alignes sur une date de debut ; un jour manquant vaut null. */
export interface SerieTaux {
  debut: string;
  victoire: (number | null)[];
  ban: (number | null)[];
  selection: (number | null)[];
}

/** Taux de victoire sur une tranche de duree de partie, en minutes. */
export interface TrancheDuree {
  de: number;
  /** Absent pour la derniere tranche, ouverte (« 20 min et plus »). */
  a: number | null;
  victoire: number;
}

interface Evolution {
  tendances: Record<string, Partial<Record<RangMesure, SerieTaux>>>;
  duree: Record<string, Partial<Record<RangMesure, TrancheDuree[]>>>;
  historique: Record<string, SerieTaux>;
}

const E = evolutionGenere as unknown as Evolution;

export const tendancesDe = (slug: string) => E.tendances[slug] ?? {};
export const dureeDe = (slug: string) => E.duree[slug] ?? {};
export const historiqueDe = (slug: string): SerieTaux | null => E.historique[slug] ?? null;
