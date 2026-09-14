import type { Teammate, CounterFigure, CountersByRank } from "./data";
import type { Duo, DuosByRank } from "./duos";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";

/**
 * Logique des pages de paires de heros : face-a-face (`/compare/a-vs-b`) et
 * duos (`/heroes/{slug}/duos`). Module pur — aucun fichier de donnees importe,
 * les types seuls — pour etre teste sans charger le jeu.
 */

// ── Adresse d'une paire ────────────────────────────────────────────

export const SEPARATOR_PAIR = "-vs-";

/** Ordre canonique d'une paire : alphabetique des slugs. */
export const orderPair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

/** « aamon-vs-fanny », quel que soit l'ordre donne. */
export const segmentPair = (a: string, b: string) => orderPair(a, b).join(SEPARATOR_PAIR);

/** Chemin sans langue de la page face-a-face. */
export const pathPair = (a: string, b: string) => `/compare/${segmentPair(a, b)}`;

/**
 * Deux slugs d'un segment « a-vs-b ». Les slugs contiennent des tirets
 * (« x-borg », « yi-sun-shin ») mais jamais « -vs- ». Null pour un segment mal
 * forme ou un heros oppose a lui-meme ; `canonique` dit si l'ordre est le bon.
 */
export function readPair(segment: string): { a: string; b: string; canonical: boolean } | null {
  const i = segment.indexOf(SEPARATOR_PAIR);
  if (i <= 0) return null;
  const a = segment.slice(0, i);
  const b = segment.slice(i + SEPARATOR_PAIR.length);
  if (!b || a === b || b.includes(SEPARATOR_PAIR)) return null;
  return { a, b, canonical: a < b };
}

const lists = (m: { strong?: CounterFigure[]; weak?: CounterFigure[] } | undefined) => [
  ...(m?.strong ?? []),
  ...(m?.weak ?? []),
];

/**
 * Paires au duel mesure : b figure parmi les ecarts les plus marques de a
 * (listes `fort` ou `faible`), ou l'inverse, a un rang au moins. Segments
 * canoniques, tries. `existe` ecarte un heros absent du catalogue.
 */
export function pairsMeasured(counters: Record<string, CountersByRank>, exists: (slug: string) => boolean): string[] {
  return [...ranksByPair(counters, exists).keys()].sort();
}

/** Nombre de rangs ou chaque paire est mesuree, dans un sens ou dans l'autre. */
export function ranksByPair(
  counters: Record<string, CountersByRank>,
  exists: (slug: string) => boolean,
): Map<string, number> {
  const views = new Map<string, Set<string>>();
  for (const [a, byRank] of Object.entries(counters)) {
    if (!exists(a)) continue;
    for (const r of MEASURED_RANKS) {
      for (const e of lists(byRank[r])) {
        if (e.slug === a || !exists(e.slug)) continue;
        const segment = segmentPair(a, e.slug);
        views.set(segment, (views.get(segment) ?? new Set()).add(r));
      }
    }
  }
  return new Map([...views].map(([segment, ranks]) => [segment, ranks.size]));
}

/**
 * Adversaires au duel mesure d'un heros, avec l'ecart le plus marque releve
 * entre eux, dans un sens ou dans l'autre, en valeur absolue : du duel le plus
 * tranche au plus serre.
 */
export function measuredOpponents(counters: Record<string, CountersByRank>, slug: string): { slug: string; gap: number }[] {
  const gaps = new Map<string, number>();
  const rate = (other: string, v: number) => gaps.set(other, Math.max(gaps.get(other) ?? 0, Math.abs(v)));
  for (const r of MEASURED_RANKS) {
    for (const e of lists(counters[slug]?.[r])) if (e.slug !== slug) rate(e.slug, e.advantage);
  }
  for (const [other, byRank] of Object.entries(counters)) {
    if (other === slug) continue;
    for (const r of MEASURED_RANKS) for (const e of lists(byRank[r])) if (e.slug === slug) rate(other, e.advantage);
  }
  return [...gaps]
    .map(([s, gap]) => ({ slug: s, gap }))
    .sort((x, y) => y.gap - x.gap || x.slug.localeCompare(y.slug));
}

// ── Face-a-face ────────────────────────────────────────────────────

const rounded = (v: number) => Math.round(v * 10) / 10;
const average = (values: number[]) =>
  values.length > 0 ? rounded(values.reduce((s, v) => s + v, 0) / values.length) : null;

/** Duel de deux heros dans un rang, du point de vue de `a`. */
export interface DuelRank {
  rank: MeasuredRank;
  /** Variation du taux de victoire de a quand il affronte b, lue dans les listes de a (points). */
  aAgainstB: number | null;
  /** Variation du taux de victoire de b quand il affronte a, lue dans les listes de b. */
  bAgainstA: number | null;
  /**
   * Avantage de a, en points : aContreB et l'oppose de bContreA, moyennes
   * quand les deux sont mesures. Positif, a prend le dessus.
   */
  advantage: number;
}

export function duelByRank(counters: Record<string, CountersByRank>, a: string, b: string): DuelRank[] {
  const gap = (x: string, y: string, r: MeasuredRank) => lists(counters[x]?.[r]).find((e) => e.slug === y)?.advantage ?? null;
  return MEASURED_RANKS.flatMap((rank) => {
    const aAgainstB = gap(a, b, rank);
    const bAgainstA = gap(b, a, rank);
    const views = [aAgainstB, bAgainstA === null ? null : -bAgainstA].filter((v): v is number => v !== null);
    const advantage = average(views);
    return advantage === null ? [] : [{ rank, aAgainstB, bAgainstA, advantage }];
  });
}

/** Rang de la synthese : Mythique, rang de reference des joueurs classes, sinon tous rangs, sinon le premier mesure. */
export function duelOfReference(duels: DuelRank[]): DuelRank | null {
  return duels.find((d) => d.rank === "mythic") ?? duels.find((d) => d.rank === "all") ?? duels[0] ?? null;
}

/** Ecart sous lequel un duel est dit equilibre, en points. */
export const THRESHOLD_BALANCE = 0.3;

/** Rangs de tranche (hors « tous rangs ») ou chacun prend le dessus. */
export function ranksWon(duels: DuelRank[]): { a: number; b: number; total: number } {
  const buckets = duels.filter((d) => d.rank !== "all");
  return {
    a: buckets.filter((d) => d.advantage >= THRESHOLD_BALANCE).length,
    b: buckets.filter((d) => d.advantage <= -THRESHOLD_BALANCE).length,
    total: buckets.length,
  };
}

// ── Phases de partie ───────────────────────────────────────────────

export type Phase = "early" | "mid" | "late";
export const PHASES: readonly Phase[] = ["early", "mid", "late"];

/** Minutes de debut des tranches d'un duo, dans l'ordre du fichier (TRANCHES_DUO, scripts/measures.mjs). */
export const STARTS_BUCKETS_DUO = [10, 12, 14, 16, 18, 20] as const;

/** Debut de partie : 10 a 14 minutes ; milieu : 14 a 18 ; fin : 18 et plus. */
export const phaseOf = (minutes: number): Phase => (minutes < 14 ? "early" : minutes < 18 ? "mid" : "late");

interface Bucket {
  from: number;
  winRate: number | null;
}

/** Taux moyen de chaque phase d'une courbe de duree ; null pour une phase sans tranche. */
export function rateByPhase(buckets: Bucket[] | undefined): Record<Phase, number | null> {
  const byPhase = (phase: Phase) =>
    average((buckets ?? []).flatMap((t) => (t.winRate !== null && phaseOf(t.from) === phase ? [t.winRate] : [])));
  return { early: byPhase("early"), mid: byPhase("mid"), late: byPhase("late") };
}

/** Tranches d'un duo, du tableau aligne sur DEBUTS_TRANCHES_DUO a des tranches datees. */
export const bucketsDuo = (phases: (number | null)[] | undefined): Bucket[] =>
  (phases ?? []).slice(0, STARTS_BUCKETS_DUO.length).map((winRate, i) => ({ from: STARTS_BUCKETS_DUO[i], winRate }));

export interface PhaseDuo {
  phase: Phase;
  /** Taux de victoire du duo sur la phase, en %. */
  win: number;
  /**
   * Gain sur le heros seul a la meme duree et au meme rang, en points :
   * moyenne des ecarts tranche par tranche, la ou les deux sont mesures.
   */
  gain: number | null;
}

export function phasesDuo(phases: (number | null)[] | undefined, heroBuckets: Bucket[] | undefined): PhaseDuo[] {
  const alone = new Map((heroBuckets ?? []).flatMap((t) => (t.winRate === null ? [] : [[t.from, t.winRate] as const])));
  return PHASES.flatMap((phase) => {
    const duo = bucketsDuo(phases).filter((t): t is { from: number; winRate: number } => t.winRate !== null && phaseOf(t.from) === phase);
    if (duo.length === 0) return [];
    const gaps = duo.flatMap((t) => (alone.has(t.from) ? [t.winRate - alone.get(t.from)!] : []));
    return [{ phase, win: average(duo.map((t) => t.winRate))!, gain: average(gaps) }];
  });
}

/**
 * Meilleur partenaire de chaque phase : le plus fort gain sur le heros seul,
 * ou le plus fort taux quand un candidat n'a pas de gain mesurable.
 */
export function bestByPhase(duos: Duo[], heroBuckets: Bucket[] | undefined): ({ slug: string } & PhaseDuo)[] {
  return PHASES.flatMap((phase) => {
    const candidates = duos.flatMap((d) => {
      const p = phasesDuo(d.phases, heroBuckets).find((x) => x.phase === phase);
      return p ? [{ slug: d.slug, ...p }] : [];
    });
    if (candidates.length === 0) return [];
    const byGain = candidates.every((c) => c.gain !== null);
    const key = (c: PhaseDuo) => (byGain ? c.gain! : c.win);
    return [candidates.reduce((m, c) => (key(c) > key(m) ? c : m))];
  });
}

/** Deux heros face a la duree de partie : taux de chacun par phase, et l'ecart a − b. */
export function phasesDuel(
  ta: Bucket[] | undefined,
  tb: Bucket[] | undefined,
): { phase: Phase; a: number | null; b: number | null; gap: number | null }[] {
  const pa = rateByPhase(ta);
  const pb = rateByPhase(tb);
  return PHASES.map((phase) => ({
    phase,
    a: pa[phase],
    b: pb[phase],
    gap: pa[phase] !== null && pb[phase] !== null ? rounded(pa[phase]! - pb[phase]!) : null,
  }));
}

/** Phase la plus favorable a a (ecart le plus haut, positif) et a b (le plus bas, negatif). */
export function readPhases(duel: ReturnType<typeof phasesDuel>): { a: Phase | null; b: Phase | null } {
  const measures = duel.filter((p): p is typeof p & { gap: number } => p.gap !== null);
  const top = measures.reduce<(typeof measures)[number] | null>((m, p) => (!m || p.gap > m.gap ? p : m), null);
  const bottom = measures.reduce<(typeof measures)[number] | null>((m, p) => (!m || p.gap < m.gap ? p : m), null);
  return { a: top && top.gap > 0 ? top.phase : null, b: bottom && bottom.gap < 0 ? bottom.phase : null };
}

// ── Meme equipe ────────────────────────────────────────────────────

/** Duos au format des contres : `fort` pour les meilleurs partenaires, `faible` pour les pires. */
export function duosAsCounters(byRank: DuosByRank): CountersByRank {
  return Object.fromEntries(
    Object.entries(byRank).flatMap(([r, d]) => (d ? [[r, { strong: d.best, weak: d.worst, winRate: d.winRate }]] : [])),
  );
}

export interface LinkTeam {
  rank: MeasuredRank;
  /** Heros dont le taux varie. */
  de: string;
  /** Coequipier qui le fait varier. */
  partner: string;
  advantage: number;
  source: "duos" | "coequipiers";
}

/**
 * Ce que chacun gagne ou perd a jouer avec l'autre, rang par rang : les duos
 * (compatibilite) d'abord, les coequipiers de l'academie a defaut.
 */
export function linksTeam(
  duos: Record<string, DuosByRank>,
  teammates: Record<string, Partial<Record<MeasuredRank, Teammate[]>>>,
  a: string,
  b: string,
): LinkTeam[] {
  return MEASURED_RANKS.flatMap((rank) =>
    [
      [a, b],
      [b, a],
    ].flatMap(([de, partner]): LinkTeam[] => {
      const d = duos[de]?.[rank];
      const duo = [...(d?.best ?? []), ...(d?.worst ?? [])].find((e) => e.slug === partner);
      if (duo) return [{ rank, de, partner, advantage: duo.advantage, source: "duos" }];
      const c = teammates[de]?.[rank]?.find((e) => e.slug === partner);
      return c ? [{ rank, de, partner, advantage: c.advantage, source: "coequipiers" }] : [];
    }),
  );
}
