import type { BuildPlayed, BuildsHero } from "./data";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";

/**
 * Usage d'un choix de build — objet, embleme, sort — lu dans les builds
 * reellement joues.
 *
 * Chaque heros publie, par position et par rang, ses trois builds les plus
 * joues avec leur part des parties (`selection`) et leur taux de victoire.
 * Retourner ces tableaux donne ce qu'aucune fiche d'objet ne dit : qui prend
 * cet objet, sur quelle position, et avec quel resultat.
 *
 * Fonctions pures, sans donnees importees : les tests leur passent des builds
 * fabriques a la main.
 */

/** Cles d'un build pour le type de choix etudie (slugs d'objets, embleme, sort). */
export type Extract = (b: BuildPlayed) => Iterable<string>;

export interface UsageHero {
  slug: string;
  /** Position ou le choix pese le plus pour ce heros. */
  lane: string;
  /** Part des parties du heros, sur cette position, jouees avec un build qui contient le choix (en %). */
  selection: number;
  /** Taux de victoire de ces builds, moyenne ponderee par leur part (en %). */
  win: number | null;
}

/** Cumul de builds : part totale et taux de victoire pondere. */
class Total {
  part = 0;
  private won = 0;
  private pese = 0;
  private raw: number[] = [];

  add(b: BuildPlayed) {
    const part = b.pickRate ?? 0;
    this.part += part;
    if (b.winRate === null) return;
    this.raw.push(b.winRate);
    if (part > 0) {
      this.won += b.winRate * part;
      this.pese += part;
    }
  }

  /** Sans part connue, la moyenne simple plutot qu'aucun taux. */
  get win(): number | null {
    if (this.pese > 0) return this.won / this.pese;
    return this.raw.length ? this.raw.reduce((s, v) => s + v, 0) / this.raw.length : null;
  }
}

const byPart = (a: UsageHero, b: UsageHero) =>
  b.selection - a.selection || (b.win ?? 0) - (a.win ?? 0) || a.slug.localeCompare(b.slug);

/**
 * Pour chaque choix, les heros qui le prennent au rang demande, le plus engage
 * d'abord. Un heros n'apparait qu'une fois, sur la position ou le choix occupe
 * la plus grande part de ses parties.
 */
export function usageByChoice(
  builds: Record<string, BuildsHero>,
  extract: Extract,
  rank: MeasuredRank = "all",
): Map<string, UsageHero[]> {
  const byChoice = new Map<string, Map<string, UsageHero>>();
  for (const [slug, byLane] of Object.entries(builds)) {
    for (const [lane, byRank] of Object.entries(byLane)) {
      const totals = new Map<string, Total>();
      for (const b of byRank[rank] ?? []) {
        // Un objet pris deux fois dans le meme build ne compte qu'une fois.
        for (const key of new Set(extract(b))) {
          const c = totals.get(key) ?? new Total();
          c.add(b);
          totals.set(key, c);
        }
      }
      for (const [key, c] of totals) {
        const byHero = byChoice.get(key) ?? new Map<string, UsageHero>();
        byChoice.set(key, byHero);
        const current = byHero.get(slug);
        if (!current || c.part > current.selection) {
          byHero.set(slug, { slug, lane, selection: c.part, win: c.win });
        }
      }
    }
  }
  return new Map([...byChoice].map(([key, byHero]) => [key, [...byHero.values()].sort(byPart)]));
}

export interface SummaryRank {
  rank: MeasuredRank;
  /** Nombre de heros qui prennent le choix a ce rang. */
  heroes: number;
  /** Heros le plus engage a ce rang. */
  first: UsageHero | null;
  /** Taux de victoire moyen des builds concernes, pondere par leur part (en %). */
  win: number | null;
}

/** Une ligne par rang mesure, a partir des usages deja calcules pour chacun. */
export function summaryByRank(usages: Partial<Record<MeasuredRank, UsageHero[]>>): SummaryRank[] {
  return MEASURED_RANKS.map((rank) => {
    const list = usages[rank] ?? [];
    let won = 0;
    let pese = 0;
    for (const u of list) {
      if (u.win === null || u.selection <= 0) continue;
      won += u.win * u.selection;
      pese += u.selection;
    }
    return { rank, heroes: list.length, first: list[0] ?? null, win: pese > 0 ? won / pese : null };
  });
}

export interface PartChoice {
  key: string;
  /** Part des builds retenus, ponderee par leur part des parties (en %). */
  part: number;
}

/**
 * Repartition d'un choix parmi les builds qui en remplissent un autre : les
 * talents pris avec un embleme, les sorts pris avec lui. Chaque build pese sa
 * part des parties ; un build sans part connue pese comme le plus faible.
 */
export function partsByChoice(
  builds: Record<string, BuildsHero>,
  keep: (b: BuildPlayed) => boolean,
  extract: Extract,
  rank: MeasuredRank = "all",
): PartChoice[] {
  const weight = new Map<string, number>();
  let total = 0;
  for (const byLane of Object.values(builds)) {
    for (const byRank of Object.values(byLane)) {
      for (const b of byRank[rank] ?? []) {
        if (!keep(b)) continue;
        const p = b.pickRate && b.pickRate > 0 ? b.pickRate : 0.01;
        total += p;
        for (const key of new Set(extract(b))) weight.set(key, (weight.get(key) ?? 0) + p);
      }
    }
  }
  if (total === 0) return [];
  return [...weight]
    .map(([key, p]) => ({ key, part: (p / total) * 100 }))
    .sort((a, b) => b.part - a.part || a.key.localeCompare(b.key));
}
