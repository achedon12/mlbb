/**
 * Calculateur de taux de victoire.
 *
 * Le jeu affiche un taux arrondi et un nombre de parties ; on en deduit le
 * nombre de victoires (entier : une partie se gagne ou se perd), puis ce qu'il
 * faut pour atteindre l'objectif. Pour `n` parties et `v` victoires, un
 * objectif `t` demande `x` victoires d'affilee telles que (v + x) / (n + x) >= t,
 * soit x = ceil((t·n − v) / (1 − t)).
 *
 * Tous les pourcentages passent en centiemes de point entiers (48,53 % donne
 * 4853) : le calcul reste exact. En flottants, 99,9 % sur 10 parties a 50 %
 * donnait 4991 victoires au lieu de 4990 — l'erreur que commet l'API
 * communautaire qui a servi de reference.
 */

/** Precision retenue : deux decimales, comme l'affichage du jeu. */
const SCALE = 10_000;

/** Nombre de parties au-dela duquel la saisie est jugee fantaisiste. */
export const MATCHES_MAX = 1_000_000;

const hundredths = (percent: number) => Math.round(percent * 100);

/**
 * Lit un nombre saisi : la virgule decimale des langues europeennes vaut le
 * point. Une saisie vide ou illisible donne `null`.
 */
export function readCount(input: string): number | null {
  const text = input.trim().replace(",", ".").replace(/\s|%/g, "");
  if (text === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export interface Situation {
  /** Parties jouees. */
  matches: number;
  /** Taux de victoire actuel, en pourcent. */
  rate: number;
  /** Taux vise, en pourcent. */
  objective: number;
}

export type Result =
  | { state: "invalid" }
  /** Objectif de 100 % avec au moins une defaite : aucune serie n'y mene. */
  | { state: "impossible"; currentWins: number }
  | { state: "wins"; wins: number; currentWins: number }
  /**
   * Objectif deja atteint : `marge` defaites d'affilee le laissent tenir,
   * `null` quand aucune serie ne peut le faire tomber (objectif de 0 %).
   */
  | { state: "reached"; margin: number | null; currentWins: number };

/** Saisie exploitable : des parties entieres, des taux entre 0 et 100. */
export function situationValid(s: Situation): boolean {
  return (
    Number.isInteger(s.matches) &&
    s.matches >= 1 &&
    s.matches <= MATCHES_MAX &&
    [s.rate, s.objective].every((p) => Number.isFinite(p) && p >= 0 && p <= 100)
  );
}

/** Victoires deja acquises : le taux affiche est arrondi, les victoires non. */
export function currentWins(matches: number, rate: number): number {
  return Math.min(matches, Math.max(0, Math.round((matches * hundredths(rate)) / SCALE)));
}

export function compute(s: Situation): Result {
  if (!situationValid(s)) return { state: "invalid" };
  const n = s.matches;
  const v = currentWins(n, s.rate);
  const t = hundredths(s.objective);
  // Avance, en centiemes de partie, des victoires acquises sur celles que
  // demande l'objectif ; negative tant qu'il n'est pas atteint.
  const lead = SCALE * v - t * n;

  if (lead >= 0) {
    return { state: "reached", margin: t === 0 ? null : Math.floor(lead / t), currentWins: v };
  }
  if (t >= SCALE) return { state: "impossible", currentWins: v };
  return { state: "wins", wins: Math.ceil(-lead / (SCALE - t)), currentWins: v };
}

/**
 * Parties a jouer a un rythme donne pour atteindre l'objectif : sur la duree,
 * le taux tend vers ce rythme. `null` si le rythme ne depasse pas l'objectif —
 * il n'y mene jamais —, 0 si l'objectif est deja atteint.
 */
export function matchesAuPace(s: Situation, pace: number): number | null {
  if (!situationValid(s) || !Number.isFinite(pace) || pace < 0 || pace > 100) return null;
  const t = hundredths(s.objective);
  const missing = t * s.matches - SCALE * currentWins(s.matches, s.rate);
  if (missing <= 0) return 0;
  const r = hundredths(pace);
  return r > t ? Math.ceil(missing / (r - t)) : null;
}
