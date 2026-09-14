import generatedEvolution from "@/data/game/evolution.json";
import type { MeasuredRank } from "./measured-ranks";

/**
 * Evolution des taux d'un heros : series quotidiennes sur trente jours par
 * rang, taux de victoire par duree de partie, et historique long cumule d'une
 * synchronisation a l'autre. Lu par la seule fiche heros : le fichier reste
 * hors des pages qui n'en ont pas besoin.
 */

/** Taux quotidiens alignes sur une date de debut ; un jour manquant vaut null. */
export interface SeriesRate {
  start: string;
  winRate: (number | null)[];
  banRate: (number | null)[];
  pickRate: (number | null)[];
  /**
   * Premier jour reellement mesure au jour pres, quand la serie commence par
   * des semaines etalees (valeurs interpolees). Un calcul qui veut des
   * mesures, pas une courbe, doit ignorer les jours d'avant.
   */
  measuredSince?: string;
}

/**
 * Historique tel que stocke : les derniers jours au jour pres, les semaines
 * plus anciennes en moyennes (voir compacterHistorique, scripts/measures.mjs).
 * `semaines.debut` est un lundi, un point tous les sept jours.
 */
export interface HistoryStored extends SeriesRate {
  weeks?: SeriesRate;
}

/** Taux de victoire sur une tranche de duree de partie, en minutes. */
export interface BucketDuration {
  from: number;
  /** Absent pour la derniere tranche, ouverte (« 20 min et plus »). */
  to: number | null;
  winRate: number;
}

interface Evolution {
  trends: Record<string, Partial<Record<MeasuredRank, SeriesRate>>>;
  duration: Record<string, Partial<Record<MeasuredRank, BucketDuration[]>>>;
  history: Record<string, HistoryStored>;
}

const E = generatedEvolution as unknown as Evolution;

const DAY = 86400000;
const numberDay = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY);
const dateOfDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const MEASURES = ["winRate", "banRate", "pickRate"] as const;

/**
 * Ramene un historique compacte a une serie quotidienne. Chaque moyenne
 * hebdomadaire est posee au milieu de sa semaine (le jeudi), et les jours qui
 * separent deux points connus sont interpoles, jusqu'au premier jour mesure au
 * jour pres : la courbe reste continue, sans trou ni palier. La serie commence
 * au premier jeudi — rien n'est extrapole — et la partie recente est rendue
 * telle quelle. Un historique sans semaines est deja quotidien.
 */
export function spreadHistory(stored: HistoryStored): SeriesRate {
  const { weeks, ...daily } = stored;
  if (!weeks?.winRate.length) return daily;
  const monday = numberDay(weeks.start);
  const first = monday + 3;
  const days = numberDay(daily.start) - first;
  if (days <= 0) return daily;

  const series: SeriesRate = {
    start: dateOfDay(first),
    winRate: [],
    banRate: [],
    pickRate: [],
    measuredSince: daily.start,
  };
  for (const m of MEASURES) {
    // Points connus, en numero de jour : les jeudis des semaines mesurees, puis
    // le premier jour mesure de la partie quotidienne, qui raccorde les deux.
    const known = weeks[m].flatMap((v, k) => (v === null ? [] : [[monday + 7 * k + 3, v] as const]));
    const k = daily[m].findIndex((v) => v !== null);
    if (k >= 0) known.push([first + days + k, daily[m][k]!]);

    let i = 0;
    const before = Array.from({ length: days }, (_, d): number | null => {
      const day = first + d;
      while (i < known.length - 1 && known[i + 1][0] <= day) i += 1;
      const [j0, v0] = known[i] ?? [];
      const [j1, v1] = known[i + 1] ?? [];
      if (j0 === undefined || day < j0) return null;
      if (day === j0 || j1 === undefined) return day === j0 ? v0! : null;
      return Math.round((v0! + ((v1! - v0!) * (day - j0)) / (j1 - j0)) * 100) / 100;
    });
    series[m] = [...before, ...daily[m]];
  }
  return series;
}

export const trendsOf = (slug: string) => E.trends[slug] ?? {};
export const durationOf = (slug: string) => E.duration[slug] ?? {};
export const historyOf = (slug: string): SeriesRate | null =>
  E.history[slug] ? spreadHistory(E.history[slug]) : null;
