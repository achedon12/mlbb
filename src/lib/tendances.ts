import type { T } from "@/i18n/t";
import type { SerieTaux } from "./evolution";
import type { TypeAjustement } from "./types";

/**
 * Tendances du taux de victoire : ecart sur une semaine, effet d'un patch,
 * series alignees pour etre superposees.
 *
 * Calculs purs, sans lecture de donnees : les pages serveur les appliquent a
 * `evolution.json`, et un composant client peut les importer sans embarquer le
 * fichier (les imports de types s'effacent a la compilation).
 */

/** Serie quotidienne du taux de victoire, alignee sur sa date de debut ; un jour manquant vaut null. */
export type SerieVictoire = Pick<SerieTaux, "start" | "winRate" | "measuredSince">;

const JOUR_MS = 86_400_000;
const temps = (date: string) => Date.parse(`${date}T00:00:00Z`);
const arrondi = (v: number) => Math.round(v * 100) / 100;
const moyenne = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
const mesure = (v: number | null | undefined): v is number => typeof v === "number";

/** Date AAAA-MM-JJ decalee d'un nombre de jours. */
export function decalerDate(date: string, jours: number): string {
  return new Date(temps(date) + jours * JOUR_MS).toISOString().slice(0, 10);
}

/** Jours separant deux dates AAAA-MM-JJ (negatif si `a` precede `de`). */
export function joursEntre(de: string, a: string): number {
  return Math.round((temps(a) - temps(de)) / JOUR_MS);
}

export interface PointDate {
  date: string;
  valeur: number | null;
}

/** Une serie quotidienne, jour par jour, avec sa date. */
export function pointsDe(debut: string, valeurs: (number | null)[]): PointDate[] {
  return valeurs.map((valeur, k) => ({ date: decalerDate(debut, k), valeur }));
}

// ── Ecart sur une semaine ──────────────────────────────────────────

/** Ecart vise entre les deux mesures comparees, en jours. */
const SEMAINE = 7;
/** Quand J-7 manque, on accepte le jour mesure le plus proche, a deux jours pres. */
const TOLERANCE = 2;
/** Mesures exigees entre les deux bornes, incluses : deux points isoles ne font pas une tendance. */
const MESURES_MIN = 4;
/** Une derniere mesure plus vieille que cela ne dit plus rien de « cette semaine ». */
const FRAICHEUR = 3;

/**
 * En dessous de cet ecart, en points, la variation se confond avec l'arrondi :
 * le jeu publie ses taux au dixieme, un dixieme d'ecart n'est que du bruit.
 */
export const SEUIL_NOTABLE = 0.2;

export interface Variation {
  /** Dernier taux mesure. */
  actuel: number;
  /** Taux mesure une semaine plus tot, ou au jour mesure le plus proche. */
  avant: number;
  /** `actuel - avant`, en points, arrondi au centieme. */
  ecart: number;
  /** Jours separant les deux mesures (de 5 a 9). */
  jours: number;
  /** Date de la derniere mesure. */
  date: string;
}

/**
 * Ecart du taux de victoire sur une semaine : derniere mesure contre celle de
 * J-7. Les jours manquants sont ignores ; sans mesure recente, sans reference
 * a J-7 (a deux jours pres) ou avec trop peu de mesures entre les deux, pas de
 * tendance plutot qu'une tendance inventee.
 */
export function variationSemaine(serie: SerieVictoire | null | undefined): Variation | null {
  const valeurs = serie?.winRate ?? [];
  const fin = valeurs.length - 1;

  let dernier = -1;
  for (let i = fin; i >= 0 && i >= fin - FRAICHEUR; i--) {
    if (mesure(valeurs[i])) {
      dernier = i;
      break;
    }
  }
  if (!serie || dernier < 0) return null;

  // Le jour mesure le plus proche de J-7 ; a distance egale, le plus ancien.
  let reference = -1;
  for (let d = 0; d <= TOLERANCE && reference < 0; d++) {
    for (const i of d === 0 ? [dernier - SEMAINE] : [dernier - SEMAINE - d, dernier - SEMAINE + d]) {
      if (i >= 0 && mesure(valeurs[i])) {
        reference = i;
        break;
      }
    }
  }
  if (reference < 0) return null;
  if (valeurs.slice(reference, dernier + 1).filter(mesure).length < MESURES_MIN) return null;

  const actuel = valeurs[dernier]!;
  const avant = valeurs[reference]!;
  return {
    actuel,
    avant,
    ecart: arrondi(actuel - avant),
    jours: dernier - reference,
    date: decalerDate(serie.start, dernier),
  };
}

/** Vrai quand l'ecart depasse le bruit de l'arrondi. */
export function estNotable(v: Variation | null | undefined): v is Variation {
  return !!v && Math.abs(v.ecart) >= SEUIL_NOTABLE - 1e-9;
}

export interface Mouvement {
  slug: string;
  variation: Variation;
}

/**
 * Plus fortes hausses et baisses de la semaine, parmi les ecarts notables. A
 * ecart egal, le taux actuel le plus haut (hausses) ou le plus bas (baisses)
 * passe devant, puis l'ordre alphabetique : le resultat ne depend pas de
 * l'ordre d'entree.
 */
export function mouvementsSemaine(
  entrees: { slug: string; serie?: SerieVictoire | null }[],
  nombre = 5,
): { hausses: Mouvement[]; baisses: Mouvement[] } {
  const notables = entrees.flatMap(({ slug, serie }) => {
    const variation = variationSemaine(serie);
    return estNotable(variation) ? [{ slug, variation }] : [];
  });
  const hausses = notables
    .filter((m) => m.variation.ecart > 0)
    .sort(
      (a, b) =>
        b.variation.ecart - a.variation.ecart ||
        b.variation.actuel - a.variation.actuel ||
        a.slug.localeCompare(b.slug),
    );
  const baisses = notables
    .filter((m) => m.variation.ecart < 0)
    .sort(
      (a, b) =>
        a.variation.ecart - b.variation.ecart ||
        a.variation.actuel - b.variation.actuel ||
        a.slug.localeCompare(b.slug),
    );
  return { hausses: hausses.slice(0, nombre), baisses: baisses.slice(0, nombre) };
}

// ── Effet d'un patch ───────────────────────────────────────────────

/** Jours compares de part et d'autre du patch. */
export const JOURS_IMPACT = 7;
/** Jours mesures exiges de chaque cote. */
export const MESURES_MIN_IMPACT = 4;
/**
 * Ecart de moyennes au-dela duquel le patch a vraiment deplace le taux : les
 * moyennes sur sept jours lissent l'arrondi, pas les variations de la
 * frequentation d'une semaine a l'autre.
 */
export const SEUIL_IMPACT = 0.3;

export interface ImpactPatch {
  /** Taux de victoire moyen sur les sept jours precedant le patch. */
  avant: number;
  /** Taux de victoire moyen sur les sept jours suivant le patch. */
  apres: number;
  /** `apres - avant`, en points. */
  ecart: number;
  joursAvant: number;
  joursApres: number;
}

/**
 * Taux de victoire moyen sur les sept jours avant et apres un patch. Le jour
 * du patch lui-meme est ecarte : il melange parties d'avant et d'apres, et la
 * date retenue (mise en ligne des notes) peut preceder la sortie d'un jour ou
 * deux. Il faut au moins quatre jours mesures de chaque cote.
 */
export function impactPatch(historique: SerieVictoire | null | undefined, date: string | null | undefined) {
  if (!historique || !date) return null;
  const jourPatch = joursEntre(historique.start, date);
  if (!Number.isFinite(jourPatch)) return null;
  // Les semaines compactees sont interpolees jour par jour : ce ne sont pas
  // des mesures, elles lisseraient l'impact d'un patch ancien.
  const premierMesure = historique.measuredSince ? Math.max(0, joursEntre(historique.start, historique.measuredSince)) : 0;

  const releves = (de: number, a: number) => {
    const sortie: number[] = [];
    for (let k = de; k <= a; k++) {
      const v = jourPatch + k >= premierMesure ? historique.winRate[jourPatch + k] : null;
      if (mesure(v)) sortie.push(v);
    }
    return sortie;
  };
  const avant = releves(-JOURS_IMPACT, -1);
  const apres = releves(1, JOURS_IMPACT);
  if (avant.length < MESURES_MIN_IMPACT || apres.length < MESURES_MIN_IMPACT) return null;

  const impact: ImpactPatch = {
    avant: arrondi(moyenne(avant)),
    apres: arrondi(moyenne(apres)),
    ecart: arrondi(moyenne(apres) - moyenne(avant)),
    joursAvant: avant.length,
    joursApres: apres.length,
  };
  return impact;
}

/**
 * Le patch a-t-il fait ce qu'il annoncait ? Une amelioration doit faire
 * monter le taux, un affaiblissement le faire baisser. Un « ajustement » n'a
 * pas de sens attendu : pas de verdict.
 */
export type Verdict = "attendu" | "neutre" | "inverse";

export function verdictImpact(type: TypeAjustement | null, ecart: number): Verdict | null {
  if (type !== "amelioration" && type !== "affaiblissement") return null;
  if (Math.abs(ecart) < SEUIL_IMPACT - 1e-9) return "neutre";
  return (ecart > 0) === (type === "amelioration") ? "attendu" : "inverse";
}

export interface ImpactAjustement extends ImpactPatch {
  version: string;
  date: string;
  type: TypeAjustement | null;
  verdict: Verdict | null;
}

function impactAjustement(
  historique: SerieVictoire | null | undefined,
  a: { version: string; date?: string | null; type: TypeAjustement | null },
): ImpactAjustement | null {
  const impact = a.date ? impactPatch(historique, a.date) : null;
  if (!impact || !a.date) return null;
  return { ...impact, version: a.version, date: a.date, type: a.type, verdict: verdictImpact(a.type, impact.ecart) };
}

/** Effet mesurable de chaque patch date qui a touche un heros, dans l'ordre recu. */
export function impactsDuHeros(
  historique: SerieVictoire | null | undefined,
  ajustements: { version: string; date?: string | null; type: TypeAjustement | null }[],
): ImpactAjustement[] {
  return ajustements.flatMap((a) => {
    const impact = impactAjustement(historique, a);
    return impact ? [impact] : [];
  });
}

/**
 * Effet d'un patch sur chacun des heros qu'il ajuste, par slug : de quoi
 * annoter les notes de patch (« le nerf a-t-il porte ? »). L'historique est
 * lu par la fonction fournie — `historiqueDe` cote serveur.
 */
export function impactsDuPatch(
  patch: { version: string; date?: string | null; adjustments: { slug: string; type: TypeAjustement | null }[] },
  historiqueDe: (slug: string) => SerieVictoire | null | undefined,
): Record<string, ImpactAjustement> {
  const sortie: Record<string, ImpactAjustement> = {};
  if (!patch.date) return sortie;
  for (const a of patch.adjustments) {
    const impact = impactAjustement(historiqueDe(a.slug), { version: patch.version, date: patch.date, type: a.type });
    if (impact) sortie[a.slug] = impact;
  }
  return sortie;
}

// ── Series superposees ─────────────────────────────────────────────

/**
 * Aligne des series quotidiennes sur les memes dates : l'union de leurs jours,
 * un jour absent d'une serie valant null. Deux heros synchronises a des dates
 * differentes se lisent ainsi sur un meme axe.
 */
export function alignerSeries(series: { debut: string; valeurs: (number | null)[] }[]): {
  dates: string[];
  valeurs: (number | null)[][];
} {
  const presentes = series.filter((s) => s.valeurs.length > 0);
  if (presentes.length === 0) return { dates: [], valeurs: series.map(() => []) };

  const debut = presentes.map((s) => s.debut).sort()[0]!;
  const fin = presentes.map((s) => decalerDate(s.debut, s.valeurs.length - 1)).sort().at(-1)!;
  const dates = Array.from({ length: joursEntre(debut, fin) + 1 }, (_, k) => decalerDate(debut, k));
  const valeurs = series.map((s) => {
    const decalage = joursEntre(debut, s.debut);
    return dates.map((_, k) => (k - decalage >= 0 ? (s.valeurs[k - decalage] ?? null) : null));
  });
  return { dates, valeurs };
}

// ── Affichage ──────────────────────────────────────────────────────

/** Ecart signe, au format de la langue : « +0,7 », « -0.3 », « 0,0 ». */
export function formaterEcart(ecart: number, langue: string, decimales = 1): string {
  return new Intl.NumberFormat(langue, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    signDisplay: "exceptZero",
  }).format(ecart);
}

/**
 * Forme de l'unite selon la valeur affichee et la langue : « 0,7 point » en
 * francais, « 0.7 points » en anglais.
 */
export function pluriel(valeur: number, langue: string, decimales = 1): "one" | "other" {
  const affichee = Math.abs(Number(valeur.toFixed(decimales)));
  return new Intl.PluralRules(langue, { minimumFractionDigits: decimales }).select(affichee) === "one" ? "one" : "other";
}

/**
 * Ecart en toutes lettres, pour les lecteurs d'ecran : « en hausse de 0,7
 * point en 7 jours » plutot qu'une fleche et une abreviation.
 */
export function decrireEcart(t: T, langue: string, ecart: number, jours: number): string {
  const v = new Intl.NumberFormat(langue, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(ecart));
  return t(ecart > 0 ? "tendances.hausse" : "tendances.baisse", {
    v,
    unite: t(`tendances.point.${pluriel(ecart, langue)}`),
    n: jours,
  });
}
