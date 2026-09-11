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
  /**
   * Premier jour reellement mesure au jour pres, quand la serie commence par
   * des semaines etalees (valeurs interpolees). Un calcul qui veut des
   * mesures, pas une courbe, doit ignorer les jours d'avant.
   */
  mesureDepuis?: string;
}

/**
 * Historique tel que stocke : les derniers jours au jour pres, les semaines
 * plus anciennes en moyennes (voir compacterHistorique, scripts/mesures.mjs).
 * `semaines.debut` est un lundi, un point tous les sept jours.
 */
export interface HistoriqueStocke extends SerieTaux {
  semaines?: SerieTaux;
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
  historique: Record<string, HistoriqueStocke>;
}

const E = evolutionGenere as unknown as Evolution;

const JOUR = 86400000;
const numeroJour = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / JOUR);
const dateDuJour = (n: number) => new Date(n * JOUR).toISOString().slice(0, 10);
const MESURES = ["victoire", "ban", "selection"] as const;

/**
 * Ramene un historique compacte a une serie quotidienne. Chaque moyenne
 * hebdomadaire est posee au milieu de sa semaine (le jeudi), et les jours qui
 * separent deux points connus sont interpoles, jusqu'au premier jour mesure au
 * jour pres : la courbe reste continue, sans trou ni palier. La serie commence
 * au premier jeudi — rien n'est extrapole — et la partie recente est rendue
 * telle quelle. Un historique sans semaines est deja quotidien.
 */
export function etalerHistorique(stocke: HistoriqueStocke): SerieTaux {
  const { semaines, ...quotidien } = stocke;
  if (!semaines?.victoire.length) return quotidien;
  const lundi = numeroJour(semaines.debut);
  const premier = lundi + 3;
  const jours = numeroJour(quotidien.debut) - premier;
  if (jours <= 0) return quotidien;

  const serie: SerieTaux = {
    debut: dateDuJour(premier),
    victoire: [],
    ban: [],
    selection: [],
    mesureDepuis: quotidien.debut,
  };
  for (const m of MESURES) {
    // Points connus, en numero de jour : les jeudis des semaines mesurees, puis
    // le premier jour mesure de la partie quotidienne, qui raccorde les deux.
    const connus = semaines[m].flatMap((v, k) => (v === null ? [] : [[lundi + 7 * k + 3, v] as const]));
    const k = quotidien[m].findIndex((v) => v !== null);
    if (k >= 0) connus.push([premier + jours + k, quotidien[m][k]!]);

    let i = 0;
    const avant = Array.from({ length: jours }, (_, d): number | null => {
      const jour = premier + d;
      while (i < connus.length - 1 && connus[i + 1][0] <= jour) i += 1;
      const [j0, v0] = connus[i] ?? [];
      const [j1, v1] = connus[i + 1] ?? [];
      if (j0 === undefined || jour < j0) return null;
      if (jour === j0 || j1 === undefined) return jour === j0 ? v0! : null;
      return Math.round((v0! + ((v1! - v0!) * (jour - j0)) / (j1 - j0)) * 100) / 100;
    });
    serie[m] = [...avant, ...quotidien[m]];
  }
  return serie;
}

export const tendancesDe = (slug: string) => E.tendances[slug] ?? {};
export const dureeDe = (slug: string) => E.duree[slug] ?? {};
export const historiqueDe = (slug: string): SerieTaux | null =>
  E.historique[slug] ? etalerHistorique(E.historique[slug]) : null;
