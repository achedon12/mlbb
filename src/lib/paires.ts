import type { Coequipier, ContreChiffre, ContresParRang } from "./donnees";
import type { Duo, DuosParRang } from "./duos";
import { RANGS_MESURE, type RangMesure } from "./rangs-mesure";

/**
 * Logique des pages de paires de heros : face-a-face (`/compare/a-vs-b`) et
 * duos (`/heroes/{slug}/duos`). Module pur — aucun fichier de donnees importe,
 * les types seuls — pour etre teste sans charger le jeu.
 */

// ── Adresse d'une paire ────────────────────────────────────────────

export const SEPARATEUR_PAIRE = "-vs-";

/** Ordre canonique d'une paire : alphabetique des slugs. */
export const ordrePaire = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

/** « aamon-vs-fanny », quel que soit l'ordre donne. */
export const segmentPaire = (a: string, b: string) => ordrePaire(a, b).join(SEPARATEUR_PAIRE);

/** Chemin sans langue de la page face-a-face. */
export const cheminPaire = (a: string, b: string) => `/compare/${segmentPaire(a, b)}`;

/**
 * Deux slugs d'un segment « a-vs-b ». Les slugs contiennent des tirets
 * (« x-borg », « yi-sun-shin ») mais jamais « -vs- ». Null pour un segment mal
 * forme ou un heros oppose a lui-meme ; `canonique` dit si l'ordre est le bon.
 */
export function lirePaire(segment: string): { a: string; b: string; canonique: boolean } | null {
  const i = segment.indexOf(SEPARATEUR_PAIRE);
  if (i <= 0) return null;
  const a = segment.slice(0, i);
  const b = segment.slice(i + SEPARATEUR_PAIRE.length);
  if (!b || a === b || b.includes(SEPARATEUR_PAIRE)) return null;
  return { a, b, canonique: a < b };
}

const listes = (m: { strong?: ContreChiffre[]; weak?: ContreChiffre[] } | undefined) => [
  ...(m?.strong ?? []),
  ...(m?.weak ?? []),
];

/**
 * Paires au duel mesure : b figure parmi les ecarts les plus marques de a
 * (listes `fort` ou `faible`), ou l'inverse, a un rang au moins. Segments
 * canoniques, tries. `existe` ecarte un heros absent du catalogue.
 */
export function pairesMesurees(contres: Record<string, ContresParRang>, existe: (slug: string) => boolean): string[] {
  return [...rangsParPaire(contres, existe).keys()].sort();
}

/** Nombre de rangs ou chaque paire est mesuree, dans un sens ou dans l'autre. */
export function rangsParPaire(
  contres: Record<string, ContresParRang>,
  existe: (slug: string) => boolean,
): Map<string, number> {
  const vues = new Map<string, Set<string>>();
  for (const [a, parRang] of Object.entries(contres)) {
    if (!existe(a)) continue;
    for (const r of RANGS_MESURE) {
      for (const e of listes(parRang[r])) {
        if (e.slug === a || !existe(e.slug)) continue;
        const segment = segmentPaire(a, e.slug);
        vues.set(segment, (vues.get(segment) ?? new Set()).add(r));
      }
    }
  }
  return new Map([...vues].map(([segment, rangs]) => [segment, rangs.size]));
}

/**
 * Adversaires au duel mesure d'un heros, avec l'ecart le plus marque releve
 * entre eux, dans un sens ou dans l'autre, en valeur absolue : du duel le plus
 * tranche au plus serre.
 */
export function adversairesMesures(contres: Record<string, ContresParRang>, slug: string): { slug: string; ecart: number }[] {
  const ecarts = new Map<string, number>();
  const noter = (autre: string, v: number) => ecarts.set(autre, Math.max(ecarts.get(autre) ?? 0, Math.abs(v)));
  for (const r of RANGS_MESURE) {
    for (const e of listes(contres[slug]?.[r])) if (e.slug !== slug) noter(e.slug, e.advantage);
  }
  for (const [autre, parRang] of Object.entries(contres)) {
    if (autre === slug) continue;
    for (const r of RANGS_MESURE) for (const e of listes(parRang[r])) if (e.slug === slug) noter(autre, e.advantage);
  }
  return [...ecarts]
    .map(([s, ecart]) => ({ slug: s, ecart }))
    .sort((x, y) => y.ecart - x.ecart || x.slug.localeCompare(y.slug));
}

// ── Face-a-face ────────────────────────────────────────────────────

const arrondi = (v: number) => Math.round(v * 10) / 10;
const moyenne = (valeurs: number[]) =>
  valeurs.length > 0 ? arrondi(valeurs.reduce((s, v) => s + v, 0) / valeurs.length) : null;

/** Duel de deux heros dans un rang, du point de vue de `a`. */
export interface DuelRang {
  rang: RangMesure;
  /** Variation du taux de victoire de a quand il affronte b, lue dans les listes de a (points). */
  aContreB: number | null;
  /** Variation du taux de victoire de b quand il affronte a, lue dans les listes de b. */
  bContreA: number | null;
  /**
   * Avantage de a, en points : aContreB et l'oppose de bContreA, moyennes
   * quand les deux sont mesures. Positif, a prend le dessus.
   */
  avantage: number;
}

export function duelParRang(contres: Record<string, ContresParRang>, a: string, b: string): DuelRang[] {
  const ecart = (x: string, y: string, r: RangMesure) => listes(contres[x]?.[r]).find((e) => e.slug === y)?.advantage ?? null;
  return RANGS_MESURE.flatMap((rang) => {
    const aContreB = ecart(a, b, rang);
    const bContreA = ecart(b, a, rang);
    const vues = [aContreB, bContreA === null ? null : -bContreA].filter((v): v is number => v !== null);
    const avantage = moyenne(vues);
    return avantage === null ? [] : [{ rang, aContreB, bContreA, avantage }];
  });
}

/** Rang de la synthese : Mythique, rang de reference des joueurs classes, sinon tous rangs, sinon le premier mesure. */
export function duelDeReference(duels: DuelRang[]): DuelRang | null {
  return duels.find((d) => d.rang === "mythic") ?? duels.find((d) => d.rang === "all") ?? duels[0] ?? null;
}

/** Ecart sous lequel un duel est dit equilibre, en points. */
export const SEUIL_EQUILIBRE = 0.3;

/** Rangs de tranche (hors « tous rangs ») ou chacun prend le dessus. */
export function rangsGagnes(duels: DuelRang[]): { a: number; b: number; total: number } {
  const tranches = duels.filter((d) => d.rang !== "all");
  return {
    a: tranches.filter((d) => d.avantage >= SEUIL_EQUILIBRE).length,
    b: tranches.filter((d) => d.avantage <= -SEUIL_EQUILIBRE).length,
    total: tranches.length,
  };
}

// ── Phases de partie ───────────────────────────────────────────────

export type Phase = "debut" | "milieu" | "fin";
export const PHASES: readonly Phase[] = ["debut", "milieu", "fin"];

/** Minutes de debut des tranches d'un duo, dans l'ordre du fichier (TRANCHES_DUO, scripts/mesures.mjs). */
export const DEBUTS_TRANCHES_DUO = [10, 12, 14, 16, 18, 20] as const;

/** Debut de partie : 10 a 14 minutes ; milieu : 14 a 18 ; fin : 18 et plus. */
export const phaseDe = (minutes: number): Phase => (minutes < 14 ? "debut" : minutes < 18 ? "milieu" : "fin");

interface Tranche {
  from: number;
  winRate: number | null;
}

/** Taux moyen de chaque phase d'une courbe de duree ; null pour une phase sans tranche. */
export function tauxParPhase(tranches: Tranche[] | undefined): Record<Phase, number | null> {
  const parPhase = (phase: Phase) =>
    moyenne((tranches ?? []).flatMap((t) => (t.winRate !== null && phaseDe(t.from) === phase ? [t.winRate] : [])));
  return { debut: parPhase("debut"), milieu: parPhase("milieu"), fin: parPhase("fin") };
}

/** Tranches d'un duo, du tableau aligne sur DEBUTS_TRANCHES_DUO a des tranches datees. */
export const tranchesDuo = (phases: (number | null)[] | undefined): Tranche[] =>
  (phases ?? []).slice(0, DEBUTS_TRANCHES_DUO.length).map((winRate, i) => ({ from: DEBUTS_TRANCHES_DUO[i], winRate }));

export interface PhaseDuo {
  phase: Phase;
  /** Taux de victoire du duo sur la phase, en %. */
  victoire: number;
  /**
   * Gain sur le heros seul a la meme duree et au meme rang, en points :
   * moyenne des ecarts tranche par tranche, la ou les deux sont mesures.
   */
  gain: number | null;
}

export function phasesDuo(phases: (number | null)[] | undefined, tranchesHeros: Tranche[] | undefined): PhaseDuo[] {
  const seul = new Map((tranchesHeros ?? []).flatMap((t) => (t.winRate === null ? [] : [[t.from, t.winRate] as const])));
  return PHASES.flatMap((phase) => {
    const duo = tranchesDuo(phases).filter((t): t is { from: number; winRate: number } => t.winRate !== null && phaseDe(t.from) === phase);
    if (duo.length === 0) return [];
    const ecarts = duo.flatMap((t) => (seul.has(t.from) ? [t.winRate - seul.get(t.from)!] : []));
    return [{ phase, victoire: moyenne(duo.map((t) => t.winRate))!, gain: moyenne(ecarts) }];
  });
}

/**
 * Meilleur partenaire de chaque phase : le plus fort gain sur le heros seul,
 * ou le plus fort taux quand un candidat n'a pas de gain mesurable.
 */
export function meilleursParPhase(duos: Duo[], tranchesHeros: Tranche[] | undefined): ({ slug: string } & PhaseDuo)[] {
  return PHASES.flatMap((phase) => {
    const candidats = duos.flatMap((d) => {
      const p = phasesDuo(d.phases, tranchesHeros).find((x) => x.phase === phase);
      return p ? [{ slug: d.slug, ...p }] : [];
    });
    if (candidats.length === 0) return [];
    const parGain = candidats.every((c) => c.gain !== null);
    const cle = (c: PhaseDuo) => (parGain ? c.gain! : c.victoire);
    return [candidats.reduce((m, c) => (cle(c) > cle(m) ? c : m))];
  });
}

/** Deux heros face a la duree de partie : taux de chacun par phase, et l'ecart a − b. */
export function phasesDuel(
  ta: Tranche[] | undefined,
  tb: Tranche[] | undefined,
): { phase: Phase; a: number | null; b: number | null; ecart: number | null }[] {
  const pa = tauxParPhase(ta);
  const pb = tauxParPhase(tb);
  return PHASES.map((phase) => ({
    phase,
    a: pa[phase],
    b: pb[phase],
    ecart: pa[phase] !== null && pb[phase] !== null ? arrondi(pa[phase]! - pb[phase]!) : null,
  }));
}

/** Phase la plus favorable a a (ecart le plus haut, positif) et a b (le plus bas, negatif). */
export function lecturePhases(duel: ReturnType<typeof phasesDuel>): { a: Phase | null; b: Phase | null } {
  const mesures = duel.filter((p): p is typeof p & { ecart: number } => p.ecart !== null);
  const haut = mesures.reduce<(typeof mesures)[number] | null>((m, p) => (!m || p.ecart > m.ecart ? p : m), null);
  const bas = mesures.reduce<(typeof mesures)[number] | null>((m, p) => (!m || p.ecart < m.ecart ? p : m), null);
  return { a: haut && haut.ecart > 0 ? haut.phase : null, b: bas && bas.ecart < 0 ? bas.phase : null };
}

// ── Meme equipe ────────────────────────────────────────────────────

/** Duos au format des contres : `fort` pour les meilleurs partenaires, `faible` pour les pires. */
export function duosCommeContres(parRang: DuosParRang): ContresParRang {
  return Object.fromEntries(
    Object.entries(parRang).flatMap(([r, d]) => (d ? [[r, { strong: d.best, weak: d.worst, winRate: d.winRate }]] : [])),
  );
}

export interface LienEquipe {
  rang: RangMesure;
  /** Heros dont le taux varie. */
  de: string;
  /** Coequipier qui le fait varier. */
  avec: string;
  avantage: number;
  source: "duos" | "coequipiers";
}

/**
 * Ce que chacun gagne ou perd a jouer avec l'autre, rang par rang : les duos
 * (compatibilite) d'abord, les coequipiers de l'academie a defaut.
 */
export function liensEquipe(
  duos: Record<string, DuosParRang>,
  coequipiers: Record<string, Partial<Record<RangMesure, Coequipier[]>>>,
  a: string,
  b: string,
): LienEquipe[] {
  return RANGS_MESURE.flatMap((rang) =>
    [
      [a, b],
      [b, a],
    ].flatMap(([de, avec]): LienEquipe[] => {
      const d = duos[de]?.[rang];
      const duo = [...(d?.best ?? []), ...(d?.worst ?? [])].find((e) => e.slug === avec);
      if (duo) return [{ rang, de, avec, avantage: duo.advantage, source: "duos" }];
      const c = coequipiers[de]?.[rang]?.find((e) => e.slug === avec);
      return c ? [{ rang, de, avec, avantage: c.advantage, source: "coequipiers" }] : [];
    }),
  );
}
