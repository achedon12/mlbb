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
const ECHELLE = 10_000;

/** Nombre de parties au-dela duquel la saisie est jugee fantaisiste. */
export const PARTIES_MAX = 1_000_000;

const centiemes = (pourcent: number) => Math.round(pourcent * 100);

/**
 * Lit un nombre saisi : la virgule decimale des langues europeennes vaut le
 * point. Une saisie vide ou illisible donne `null`.
 */
export function lireNombre(saisie: string): number | null {
  const texte = saisie.trim().replace(",", ".").replace(/\s|%/g, "");
  if (texte === "") return null;
  const valeur = Number(texte);
  return Number.isFinite(valeur) ? valeur : null;
}

export interface Situation {
  /** Parties jouees. */
  parties: number;
  /** Taux de victoire actuel, en pourcent. */
  taux: number;
  /** Taux vise, en pourcent. */
  objectif: number;
}

export type Resultat =
  | { etat: "invalide" }
  /** Objectif de 100 % avec au moins une defaite : aucune serie n'y mene. */
  | { etat: "impossible"; victoiresActuelles: number }
  | { etat: "victoires"; victoires: number; victoiresActuelles: number }
  /**
   * Objectif deja atteint : `marge` defaites d'affilee le laissent tenir,
   * `null` quand aucune serie ne peut le faire tomber (objectif de 0 %).
   */
  | { etat: "atteint"; marge: number | null; victoiresActuelles: number };

/** Saisie exploitable : des parties entieres, des taux entre 0 et 100. */
export function situationValide(s: Situation): boolean {
  return (
    Number.isInteger(s.parties) &&
    s.parties >= 1 &&
    s.parties <= PARTIES_MAX &&
    [s.taux, s.objectif].every((p) => Number.isFinite(p) && p >= 0 && p <= 100)
  );
}

/** Victoires deja acquises : le taux affiche est arrondi, les victoires non. */
export function victoiresActuelles(parties: number, taux: number): number {
  return Math.min(parties, Math.max(0, Math.round((parties * centiemes(taux)) / ECHELLE)));
}

export function calculer(s: Situation): Resultat {
  if (!situationValide(s)) return { etat: "invalide" };
  const n = s.parties;
  const v = victoiresActuelles(n, s.taux);
  const t = centiemes(s.objectif);
  // Avance, en centiemes de partie, des victoires acquises sur celles que
  // demande l'objectif ; negative tant qu'il n'est pas atteint.
  const avance = ECHELLE * v - t * n;

  if (avance >= 0) {
    return { etat: "atteint", marge: t === 0 ? null : Math.floor(avance / t), victoiresActuelles: v };
  }
  if (t >= ECHELLE) return { etat: "impossible", victoiresActuelles: v };
  return { etat: "victoires", victoires: Math.ceil(-avance / (ECHELLE - t)), victoiresActuelles: v };
}

/**
 * Parties a jouer a un rythme donne pour atteindre l'objectif : sur la duree,
 * le taux tend vers ce rythme. `null` si le rythme ne depasse pas l'objectif —
 * il n'y mene jamais —, 0 si l'objectif est deja atteint.
 */
export function partiesAuRythme(s: Situation, rythme: number): number | null {
  if (!situationValide(s) || !Number.isFinite(rythme) || rythme < 0 || rythme > 100) return null;
  const t = centiemes(s.objectif);
  const manque = t * s.parties - ECHELLE * victoiresActuelles(s.parties, s.taux);
  if (manque <= 0) return 0;
  const r = centiemes(rythme);
  return r > t ? Math.ceil(manque / (r - t)) : null;
}
