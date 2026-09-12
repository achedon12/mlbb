import type { BuildJoue, BuildsHeros } from "./donnees";
import { RANGS_MESURE, type RangMesure } from "./rangs-mesure";

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
export type Extraire = (b: BuildJoue) => Iterable<string>;

export interface UsageHeros {
  slug: string;
  /** Position ou le choix pese le plus pour ce heros. */
  lane: string;
  /** Part des parties du heros, sur cette position, jouees avec un build qui contient le choix (en %). */
  selection: number;
  /** Taux de victoire de ces builds, moyenne ponderee par leur part (en %). */
  victoire: number | null;
}

/** Cumul de builds : part totale et taux de victoire pondere. */
class Cumul {
  part = 0;
  private gagne = 0;
  private pese = 0;
  private brut: number[] = [];

  ajouter(b: BuildJoue) {
    const part = b.pickRate ?? 0;
    this.part += part;
    if (b.winRate === null) return;
    this.brut.push(b.winRate);
    if (part > 0) {
      this.gagne += b.winRate * part;
      this.pese += part;
    }
  }

  /** Sans part connue, la moyenne simple plutot qu'aucun taux. */
  get victoire(): number | null {
    if (this.pese > 0) return this.gagne / this.pese;
    return this.brut.length ? this.brut.reduce((s, v) => s + v, 0) / this.brut.length : null;
  }
}

const parPart = (a: UsageHeros, b: UsageHeros) =>
  b.selection - a.selection || (b.victoire ?? 0) - (a.victoire ?? 0) || a.slug.localeCompare(b.slug);

/**
 * Pour chaque choix, les heros qui le prennent au rang demande, le plus engage
 * d'abord. Un heros n'apparait qu'une fois, sur la position ou le choix occupe
 * la plus grande part de ses parties.
 */
export function usageParChoix(
  builds: Record<string, BuildsHeros>,
  extraire: Extraire,
  rang: RangMesure = "all",
): Map<string, UsageHeros[]> {
  const parChoix = new Map<string, Map<string, UsageHeros>>();
  for (const [slug, parLane] of Object.entries(builds)) {
    for (const [lane, parRang] of Object.entries(parLane)) {
      const cumuls = new Map<string, Cumul>();
      for (const b of parRang[rang] ?? []) {
        // Un objet pris deux fois dans le meme build ne compte qu'une fois.
        for (const cle of new Set(extraire(b))) {
          const c = cumuls.get(cle) ?? new Cumul();
          c.ajouter(b);
          cumuls.set(cle, c);
        }
      }
      for (const [cle, c] of cumuls) {
        const parHeros = parChoix.get(cle) ?? new Map<string, UsageHeros>();
        parChoix.set(cle, parHeros);
        const actuel = parHeros.get(slug);
        if (!actuel || c.part > actuel.selection) {
          parHeros.set(slug, { slug, lane, selection: c.part, victoire: c.victoire });
        }
      }
    }
  }
  return new Map([...parChoix].map(([cle, parHeros]) => [cle, [...parHeros.values()].sort(parPart)]));
}

export interface ResumeRang {
  rang: RangMesure;
  /** Nombre de heros qui prennent le choix a ce rang. */
  heros: number;
  /** Heros le plus engage a ce rang. */
  premier: UsageHeros | null;
  /** Taux de victoire moyen des builds concernes, pondere par leur part (en %). */
  victoire: number | null;
}

/** Une ligne par rang mesure, a partir des usages deja calcules pour chacun. */
export function resumeParRang(usages: Partial<Record<RangMesure, UsageHeros[]>>): ResumeRang[] {
  return RANGS_MESURE.map((rang) => {
    const liste = usages[rang] ?? [];
    let gagne = 0;
    let pese = 0;
    for (const u of liste) {
      if (u.victoire === null || u.selection <= 0) continue;
      gagne += u.victoire * u.selection;
      pese += u.selection;
    }
    return { rang, heros: liste.length, premier: liste[0] ?? null, victoire: pese > 0 ? gagne / pese : null };
  });
}

export interface PartChoix {
  cle: string;
  /** Part des builds retenus, ponderee par leur part des parties (en %). */
  part: number;
}

/**
 * Repartition d'un choix parmi les builds qui en remplissent un autre : les
 * talents pris avec un embleme, les sorts pris avec lui. Chaque build pese sa
 * part des parties ; un build sans part connue pese comme le plus faible.
 */
export function partsParChoix(
  builds: Record<string, BuildsHeros>,
  retenir: (b: BuildJoue) => boolean,
  extraire: Extraire,
  rang: RangMesure = "all",
): PartChoix[] {
  const poids = new Map<string, number>();
  let total = 0;
  for (const parLane of Object.values(builds)) {
    for (const parRang of Object.values(parLane)) {
      for (const b of parRang[rang] ?? []) {
        if (!retenir(b)) continue;
        const p = b.pickRate && b.pickRate > 0 ? b.pickRate : 0.01;
        total += p;
        for (const cle of new Set(extraire(b))) poids.set(cle, (poids.get(cle) ?? 0) + p);
      }
    }
  }
  if (total === 0) return [];
  return [...poids]
    .map(([cle, p]) => ({ cle, part: (p / total) * 100 }))
    .sort((a, b) => b.part - a.part || a.cle.localeCompare(b.cle));
}
