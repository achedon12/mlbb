import type { T } from "@/i18n/t";
import type { SeriesRate } from "./evolution";
import type { AdjustmentType } from "./types";

/**
 * Tendances du taux de victoire : ecart sur une semaine, effet d'un patch,
 * series alignees pour etre superposees.
 *
 * Calculs purs, sans lecture de donnees : les pages serveur les appliquent a
 * `evolution.json`, et un composant client peut les importer sans embarquer le
 * fichier (les imports de types s'effacent a la compilation).
 */

/** Serie quotidienne du taux de victoire, alignee sur sa date de debut ; un jour manquant vaut null. */
export type WinStreak = Pick<SeriesRate, "start" | "winRate" | "measuredSince">;

const DAY_MS = 86_400_000;
const time = (date: string) => Date.parse(`${date}T00:00:00Z`);
const rounded = (v: number) => Math.round(v * 100) / 100;
const average = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
const measure = (v: number | null | undefined): v is number => typeof v === "number";

/** Date AAAA-MM-JJ decalee d'un nombre de jours. */
export function shiftDate(date: string, days: number): string {
  return new Date(time(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Jours separant deux dates AAAA-MM-JJ (negatif si `a` precede `de`). */
export function daysBetween(de: string, a: string): number {
  return Math.round((time(a) - time(de)) / DAY_MS);
}

export interface PointDate {
  date: string;
  value: number | null;
}

/** Une serie quotidienne, jour par jour, avec sa date. */
export function pointsOf(start: string, values: (number | null)[]): PointDate[] {
  return values.map((value, k) => ({ date: shiftDate(start, k), value }));
}

// ── Ecart sur une semaine ──────────────────────────────────────────

/** Ecart vise entre les deux mesures comparees, en jours. */
const WEEK = 7;
/** Quand J-7 manque, on accepte le jour mesure le plus proche, a deux jours pres. */
const TOLERANCE = 2;
/** Mesures exigees entre les deux bornes, incluses : deux points isoles ne font pas une tendance. */
const MEASURES_MIN = 4;
/** Une derniere mesure plus vieille que cela ne dit plus rien de « cette semaine ». */
const FRESHNESS = 3;

/**
 * En dessous de cet ecart, en points, la variation se confond avec l'arrondi :
 * le jeu publie ses taux au dixieme, un dixieme d'ecart n'est que du bruit.
 */
export const THRESHOLD_NOTABLE = 0.2;

export interface Variation {
  /** Dernier taux mesure. */
  current: number;
  /** Taux mesure une semaine plus tot, ou au jour mesure le plus proche. */
  before: number;
  /** `actuel - avant`, en points, arrondi au centieme. */
  gap: number;
  /** Jours separant les deux mesures (de 5 a 9). */
  days: number;
  /** Date de la derniere mesure. */
  date: string;
}

/**
 * Ecart du taux de victoire sur une semaine : derniere mesure contre celle de
 * J-7. Les jours manquants sont ignores ; sans mesure recente, sans reference
 * a J-7 (a deux jours pres) ou avec trop peu de mesures entre les deux, pas de
 * tendance plutot qu'une tendance inventee.
 */
export function variationWeek(series: WinStreak | null | undefined): Variation | null {
  const values = series?.winRate ?? [];
  const end = values.length - 1;

  let last = -1;
  for (let i = end; i >= 0 && i >= end - FRESHNESS; i--) {
    if (measure(values[i])) {
      last = i;
      break;
    }
  }
  if (!series || last < 0) return null;

  // Le jour mesure le plus proche de J-7 ; a distance egale, le plus ancien.
  let reference = -1;
  for (let d = 0; d <= TOLERANCE && reference < 0; d++) {
    for (const i of d === 0 ? [last - WEEK] : [last - WEEK - d, last - WEEK + d]) {
      if (i >= 0 && measure(values[i])) {
        reference = i;
        break;
      }
    }
  }
  if (reference < 0) return null;
  if (values.slice(reference, last + 1).filter(measure).length < MEASURES_MIN) return null;

  const current = values[last]!;
  const before = values[reference]!;
  return {
    current,
    before,
    gap: rounded(current - before),
    days: last - reference,
    date: shiftDate(series.start, last),
  };
}

/** Vrai quand l'ecart depasse le bruit de l'arrondi. */
export function isNotable(v: Variation | null | undefined): v is Variation {
  return !!v && Math.abs(v.gap) >= THRESHOLD_NOTABLE - 1e-9;
}

export interface Motion {
  slug: string;
  variation: Variation;
}

/**
 * Plus fortes hausses et baisses de la semaine, parmi les ecarts notables. A
 * ecart egal, le taux actuel le plus haut (hausses) ou le plus bas (baisses)
 * passe devant, puis l'ordre alphabetique : le resultat ne depend pas de
 * l'ordre d'entree.
 */
export function movesWeek(
  entries: { slug: string; series?: WinStreak | null }[],
  count = 5,
): { rises: Motion[]; drops: Motion[] } {
  const notables = entries.flatMap(({ slug, series }) => {
    const variation = variationWeek(series);
    return isNotable(variation) ? [{ slug, variation }] : [];
  });
  const rises = notables
    .filter((m) => m.variation.gap > 0)
    .sort(
      (a, b) =>
        b.variation.gap - a.variation.gap ||
        b.variation.current - a.variation.current ||
        a.slug.localeCompare(b.slug),
    );
  const drops = notables
    .filter((m) => m.variation.gap < 0)
    .sort(
      (a, b) =>
        a.variation.gap - b.variation.gap ||
        a.variation.current - b.variation.current ||
        a.slug.localeCompare(b.slug),
    );
  return { rises: rises.slice(0, count), drops: drops.slice(0, count) };
}

// ── Effet d'un patch ───────────────────────────────────────────────

/** Jours compares de part et d'autre du patch. */
export const DAYS_IMPACT = 7;
/** Jours mesures exiges de chaque cote. */
export const MEASURES_MIN_IMPACT = 4;
/**
 * Ecart de moyennes au-dela duquel le patch a vraiment deplace le taux : les
 * moyennes sur sept jours lissent l'arrondi, pas les variations de la
 * frequentation d'une semaine a l'autre.
 */
export const THRESHOLD_IMPACT = 0.3;

export interface ImpactPatch {
  /** Taux de victoire moyen sur les sept jours precedant le patch. */
  before: number;
  /** Taux de victoire moyen sur les sept jours suivant le patch. */
  after: number;
  /** `apres - avant`, en points. */
  gap: number;
  daysBefore: number;
  daysAfter: number;
}

/**
 * Taux de victoire moyen sur les sept jours avant et apres un patch. Le jour
 * du patch lui-meme est ecarte : il melange parties d'avant et d'apres, et la
 * date retenue (mise en ligne des notes) peut preceder la sortie d'un jour ou
 * deux. Il faut au moins quatre jours mesures de chaque cote.
 */
export function impactPatch(history: WinStreak | null | undefined, date: string | null | undefined) {
  if (!history || !date) return null;
  const dayPatch = daysBetween(history.start, date);
  if (!Number.isFinite(dayPatch)) return null;
  // Les semaines compactees sont interpolees jour par jour : ce ne sont pas
  // des mesures, elles lisseraient l'impact d'un patch ancien.
  const firstMeasure = history.measuredSince ? Math.max(0, daysBetween(history.start, history.measuredSince)) : 0;

  const readings = (de: number, a: number) => {
    const output: number[] = [];
    for (let k = de; k <= a; k++) {
      const v = dayPatch + k >= firstMeasure ? history.winRate[dayPatch + k] : null;
      if (measure(v)) output.push(v);
    }
    return output;
  };
  const before = readings(-DAYS_IMPACT, -1);
  const after = readings(1, DAYS_IMPACT);
  if (before.length < MEASURES_MIN_IMPACT || after.length < MEASURES_MIN_IMPACT) return null;

  const impact: ImpactPatch = {
    before: rounded(average(before)),
    after: rounded(average(after)),
    gap: rounded(average(after) - average(before)),
    daysBefore: before.length,
    daysAfter: after.length,
  };
  return impact;
}

/**
 * Le patch a-t-il fait ce qu'il annoncait ? Une amelioration doit faire
 * monter le taux, un affaiblissement le faire baisser. Un « ajustement » n'a
 * pas de sens attendu : pas de verdict.
 */
export type Verdict = "expected" | "neutral" | "opposite";

export function verdictImpact(type: AdjustmentType | null, gap: number): Verdict | null {
  if (type !== "buff" && type !== "nerf") return null;
  if (Math.abs(gap) < THRESHOLD_IMPACT - 1e-9) return "neutral";
  return (gap > 0) === (type === "buff") ? "expected" : "opposite";
}

export interface ImpactAdjustment extends ImpactPatch {
  version: string;
  date: string;
  type: AdjustmentType | null;
  verdict: Verdict | null;
}

function impactAdjustment(
  history: WinStreak | null | undefined,
  a: { version: string; date?: string | null; type: AdjustmentType | null },
): ImpactAdjustment | null {
  const impact = a.date ? impactPatch(history, a.date) : null;
  if (!impact || !a.date) return null;
  return { ...impact, version: a.version, date: a.date, type: a.type, verdict: verdictImpact(a.type, impact.gap) };
}

/** Effet mesurable de chaque patch date qui a touche un heros, dans l'ordre recu. */
export function heroImpacts(
  history: WinStreak | null | undefined,
  adjustments: { version: string; date?: string | null; type: AdjustmentType | null }[],
): ImpactAdjustment[] {
  return adjustments.flatMap((a) => {
    const impact = impactAdjustment(history, a);
    return impact ? [impact] : [];
  });
}

/**
 * Effet d'un patch sur chacun des heros qu'il ajuste, par slug : de quoi
 * annoter les notes de patch (« le nerf a-t-il porte ? »). L'historique est
 * lu par la fonction fournie — `historiqueDe` cote serveur.
 */
export function impactsOfPatch(
  patch: { version: string; date?: string | null; adjustments: { slug: string; type: AdjustmentType | null }[] },
  historyOf: (slug: string) => WinStreak | null | undefined,
): Record<string, ImpactAdjustment> {
  const output: Record<string, ImpactAdjustment> = {};
  if (!patch.date) return output;
  for (const a of patch.adjustments) {
    const impact = impactAdjustment(historyOf(a.slug), { version: patch.version, date: patch.date, type: a.type });
    if (impact) output[a.slug] = impact;
  }
  return output;
}

// ── Series superposees ─────────────────────────────────────────────

/**
 * Aligne des series quotidiennes sur les memes dates : l'union de leurs jours,
 * un jour absent d'une serie valant null. Deux heros synchronises a des dates
 * differentes se lisent ainsi sur un meme axe.
 */
export function alignSeries(series: { start: string; values: (number | null)[] }[]): {
  dates: string[];
  values: (number | null)[][];
} {
  const present = series.filter((s) => s.values.length > 0);
  if (present.length === 0) return { dates: [], values: series.map(() => []) };

  const start = present.map((s) => s.start).sort()[0]!;
  const end = present.map((s) => shiftDate(s.start, s.values.length - 1)).sort().at(-1)!;
  const dates = Array.from({ length: daysBetween(start, end) + 1 }, (_, k) => shiftDate(start, k));
  const values = series.map((s) => {
    const offset = daysBetween(start, s.start);
    return dates.map((_, k) => (k - offset >= 0 ? (s.values[k - offset] ?? null) : null));
  });
  return { dates, values };
}

// ── Affichage ──────────────────────────────────────────────────────

/** Ecart signe, au format de la langue : « +0,7 », « -0.3 », « 0,0 ». */
export function formatGap(gap: number, locale: string, decimals = 1): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: "exceptZero",
  }).format(gap);
}

/**
 * Forme de l'unite selon la valeur affichee et la langue : « 0,7 point » en
 * francais, « 0.7 points » en anglais.
 */
export function plural(value: number, locale: string, decimals = 1): "one" | "other" {
  const shown = Math.abs(Number(value.toFixed(decimals)));
  return new Intl.PluralRules(locale, { minimumFractionDigits: decimals }).select(shown) === "one" ? "one" : "other";
}

/**
 * Ecart en toutes lettres, pour les lecteurs d'ecran : « en hausse de 0,7
 * point en 7 jours » plutot qu'une fleche et une abreviation.
 */
export function describeGap(t: T, locale: string, gap: number, days: number): string {
  const v = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(gap));
  return t(gap > 0 ? "trends.rise" : "trends.fall", {
    v,
    unite: t(`trends.point.${plural(gap, locale)}`),
    n: days,
  });
}
