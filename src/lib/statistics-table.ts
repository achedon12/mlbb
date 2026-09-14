import type { MeasuredRank } from "./measured-ranks";
import type { Lane, Tier, Role } from "./types";
import { keySearch } from "./utils";
import { laneFromParam } from "./draft";

/**
 * Tableau des statistiques : tri, filtres, etat d'URL et mini-courbes, en
 * calculs purs. La page serveur construit les lignes et rend le tableau dans
 * l'ordre par defaut ; le composant client les reordonne et les filtre avec ce
 * seul module, sans embarquer les donnees du jeu.
 */

export const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
export const LANES: Lane[] = ["Gold", "Exp", "Mid", "Jungle", "Roam"];

/** Adresse du tableau d'un rang : « tous rangs » garde l'adresse principale. */
export const pathStatistics = (rank: MeasuredRank) => (rank === "all" ? "/statistics" : `/statistics/${rank}`);

/** Icone d'un heros, rangee par la synchronisation sous un nom fixe : inutile de l'envoyer ligne par ligne. */
export const heroIcon = (slug: string) => `/visuels/heros/${slug}/icone.png`;

/**
 * Une ligne du tableau, telle qu'elle part au navigateur. Il y en a 132 : rien
 * de ce qui se deduit (icone, trace de la courbe), et aucun champ vide.
 */
export interface RowStat {
  slug: string;
  name: string;
  roles: Role[];
  lanes: Lane[];
  tier: Tier;
  /** Score de la tier list : departage deux heros d'un meme palier. */
  score: number;
  win: number;
  ban: number;
  pick: number;
  /** Ecart du taux de victoire sur une semaine, en points, et jours compares ; absents sans mesure fiable. */
  gap?: number;
  days?: number;
  /** Trop peu joue pour que ses taux soient stables. */
  weak?: true;
  /** Mini-courbe sur trente jours (voir `echelonnerCourbe`), avec la premiere et la derniere mesure. */
  curve?: string;
  start?: number;
  end?: number;
}

/**
 * Ligne telle qu'elle voyage vers le navigateur, en tuple : les noms de champs
 * repetes sur 132 lignes pesaient pres de 20 Ko. Roles et positions y sont
 * des chiffres (`coderListe`) ; une valeur absente vaut null.
 */
export type CompactRow = [
  slug: string,
  name: string,
  roles: number,
  lanes: number,
  tier: Tier,
  score: number,
  win: number,
  ban: number,
  pick: number,
  gap: number | null,
  days: number | null,
  weak: 0 | 1,
  curve: string | null,
  start: number | null,
  end: number | null,
];

/**
 * Liste courte (deux roles, trois positions au plus) codee en un nombre, un
 * chiffre par element (sa place dans `reference`, plus un) : l'ordre est
 * garde, le role principal reste en tete.
 */
export function encodeList<T>(values: readonly T[], reference: readonly T[]): number {
  return Number(values.map((v) => reference.indexOf(v) + 1).filter((i) => i > 0).join("") || 0);
}

export function decodeList<T>(code: number, reference: readonly T[]): T[] {
  return [...String(code)].flatMap((c) => (reference[Number(c) - 1] !== undefined ? [reference[Number(c) - 1]!] : []));
}

export function encodeRow(l: RowStat): CompactRow {
  return [
    l.slug,
    l.name,
    encodeList(l.roles, ROLES),
    encodeList(l.lanes, LANES),
    l.tier,
    l.score,
    l.win,
    l.ban,
    l.pick,
    l.gap ?? null,
    l.days ?? null,
    l.weak ? 1 : 0,
    l.curve ?? null,
    l.start ?? null,
    l.end ?? null,
  ];
}

export function decodeRow([
  slug,
  name,
  roles,
  lanes,
  tier,
  score,
  win,
  ban,
  pick,
  gap,
  days,
  weak,
  curve,
  start,
  end,
]: CompactRow): RowStat {
  return {
    slug,
    name,
    roles: decodeList(roles, ROLES),
    lanes: decodeList(lanes, LANES),
    tier,
    score,
    win,
    ban,
    pick,
    ...(gap !== null ? { gap } : {}),
    ...(days !== null ? { days } : {}),
    ...(weak ? { weak: true as const } : {}),
    ...(curve !== null ? { curve } : {}),
    ...(start !== null ? { start } : {}),
    ...(end !== null ? { end } : {}),
  };
}

export const COLUMNS_SORT = ["name", "tier", "win", "trend", "ban", "pick"] as const;
export type ColumnSort = (typeof COLUMNS_SORT)[number];
export type Order = "asc" | "desc";

export interface StateTable {
  sort: ColumnSort;
  order: Order;
  role: Role | null;
  lane: Lane | null;
  search: string;
}

/** Ordre rendu par le serveur : le taux de victoire, du plus haut au plus bas. */
export const STATE_DEFAULT: StateTable = { sort: "win", order: "desc", role: null, lane: null, search: "" };

/** Sens du premier clic sur une colonne : alphabetique pour le nom, du plus fort au plus faible ailleurs. */
export const orderInitial = (c: ColumnSort): Order => (c === "name" ? "asc" : "desc");

const RANK_TIER: Record<Tier, number> = { "S+": 5, S: 4, A: 3, B: 2, C: 1 };

function value(l: RowStat, c: Exclude<ColumnSort, "name">): number | null {
  switch (c) {
    case "tier":
      return RANK_TIER[l.tier] * 1000 + l.score;
    case "trend":
      return l.gap ?? null;
    default:
      return l[c];
  }
}

const compareNames = (a: RowStat, b: RowStat) => a.name.localeCompare(b.name, "en");

/**
 * Lignes triees sur une colonne. Un heros sans mesure (ecart de la semaine)
 * passe en fin de liste dans les deux sens ; a egalite, l'ordre alphabetique
 * departage : le resultat ne depend pas de l'ordre d'entree.
 */
export function sortRows(rows: readonly RowStat[], sort: ColumnSort, order: Order): RowStat[] {
  const direction = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort === "name") return direction * compareNames(a, b);
    const va = value(a, sort);
    const vb = value(b, sort);
    if (va === null || vb === null) return va === vb ? compareNames(a, b) : va === null ? 1 : -1;
    return direction * (va - vb) || compareNames(a, b);
  });
}

/** Lignes qui passent les filtres : role, position, et recherche sans casse ni accents. */
export function filterRows(
  rows: readonly RowStat[],
  f: Pick<StateTable, "role" | "lane" | "search">,
): RowStat[] {
  const term = keySearch(f.search.trim());
  return rows.filter(
    (l) =>
      (!f.role || l.roles.includes(f.role)) &&
      (!f.lane || l.lanes.includes(f.lane)) &&
      (!term || keySearch(l.name).includes(term)),
  );
}

/** Sort tokens used before the English ones, still present in shared addresses (`?tri=victoire`). */
const LEGACY_SORTS: Record<string, ColumnSort> = { nom: "name", palier: "tier", victoire: "win", tendance: "trend", selection: "pick" };

/** Etat lu dans l'URL (`?tri=ban&ordre=asc&role=Mage&lane=Jungle&q=…`) ; une valeur inconnue garde le defaut. */
export function readState(params: URLSearchParams): StateTable {
  const requested = params.get("tri");
  const sort = COLUMNS_SORT.find((c) => c === (LEGACY_SORTS[requested ?? ""] ?? requested)) ?? STATE_DEFAULT.sort;
  const order = params.get("ordre");
  return {
    sort,
    order: order === "asc" || order === "desc" ? order : orderInitial(sort),
    role: ROLES.find((r) => r === params.get("role")) ?? null,
    lane: laneFromParam(params.get("lane")),
    search: params.get("q") ?? "",
  };
}

/**
 * Report de l'etat dans des parametres d'URL existants, sans les valeurs par
 * defaut : l'adresse du tableau non filtre reste nue, donc canonique.
 */
export function writeState(state: StateTable, base = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(base);
  const values: [string, string | null][] = [
    ["tri", state.sort === STATE_DEFAULT.sort ? null : state.sort],
    ["ordre", state.order === orderInitial(state.sort) ? null : state.order],
    ["role", state.role],
    ["lane", state.lane],
    ["q", state.search.trim() || null],
  ];
  for (const [key, v] of values) {
    if (v) params.set(key, v);
    else params.delete(key);
  }
  return params;
}

// ── Mini-courbe ────────────────────────────────────────────────────

/** Points de la mini-courbe : un tous les deux jours sur trente. */
export const POINTS_CURVE = 15;
/** Hauteur du dessin, en unites ; en largeur, une unite separe deux points. */
export const HEIGHT_CURVE = 20;

/**
 * Ordonnees de la mini-courbe, en texte compact : « 9 9 10 - 11 ». Les jours
 * sont regroupes en `points` tranches (moyenne des jours mesures). L'echelle
 * est propre a la serie, mais jamais plus serree que `ecartMin` points : un
 * taux stable reste plat au lieu de grossir l'arrondi du jeu. Une tranche
 * sans mesure vaut « - » et coupera le trait. Moins de deux tranches
 * mesurees : pas de courbe.
 */
export function scaleCurve(
  values: (number | null)[],
  points = POINTS_CURVE,
  height = HEIGHT_CURVE,
  gapMin = 2,
): string | null {
  const n = Math.min(points, values.length);
  if (n < 2) return null;
  const buckets = Array.from({ length: n }, (_, k) => {
    const days = values.slice(Math.floor((k * values.length) / n), Math.floor(((k + 1) * values.length) / n));
    const measures = days.filter((v): v is number => typeof v === "number");
    return measures.length ? measures.reduce((a, b) => a + b, 0) / measures.length : null;
  });
  const measured = buckets.filter((v): v is number => v !== null);
  if (measured.length < 2) return null;
  let min = Math.min(...measured);
  let max = Math.max(...measured);
  if (max - min < gapMin) {
    const milieu = (min + max) / 2;
    min = milieu - gapMin / 2;
    max = milieu + gapMin / 2;
  }
  // Une unite de marge garde l'epaisseur du trait dans le cadre.
  return buckets
    .map((v) => (v === null ? "-" : String(Math.round(1 + (height - 2) * (1 - (v - min) / (max - min))))))
    .join(" ");
}

/** Trace SVG d'une mini-courbe : un point par unite de largeur, le trait coupe sur « - ». */
export function pathCurve(scale: string): string {
  let trace = "";
  let inProgress = false;
  scale.split(" ").forEach((y, x) => {
    if (y === "-") {
      inProgress = false;
      return;
    }
    // Apres un deplacement, les couples suivants sont des segments : pas besoin de « L ».
    trace += `${inProgress ? " " : "M"}${x} ${y}`;
    inProgress = true;
  });
  return trace;
}

/** Taux au format de la langue, a une decimale : « 52,4 % », « 52.4% ». */
export function formatterRate(locale: string): (v: number) => string {
  const f = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (v) => f.format(v / 100);
}
