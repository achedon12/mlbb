import type { MeasuredRank } from "./measured-ranks";
import type { Lane, Tier, Role } from "./types";
import { keySearch } from "./utils";
import { laneFromParam } from "./draft";

/**
 * Statistics table: sorting, filters, URL state and sparklines, as
 * pure computations. The server page builds the rows and renders the table in
 * default order; the client component reorders and filters them with this
 * module alone, without bundling the game data.
 */

export const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
export const LANES: Lane[] = ["Gold", "Exp", "Mid", "Jungle", "Roam"];

/** Address of a rank's table: "all ranks" keeps the main address. */
export const pathStatistics = (rank: MeasuredRank) => (rank === "all" ? "/statistics" : `/statistics/${rank}`);

/** Hero icon, stored by the sync under a fixed name: no need to send it row by row. */
export const heroIcon = (slug: string) => `/visuels/heros/${slug}/icone.png`;

/**
 * A table row, as it is sent to the browser. There are 132 of them: nothing
 * that can be derived (icon, curve path), and no empty field.
 */
export interface RowStat {
  slug: string;
  name: string;
  roles: Role[];
  lanes: Lane[];
  tier: Tier;
  /** Tier list score: breaks ties between two heroes of the same tier. */
  score: number;
  win: number;
  ban: number;
  pick: number;
  /** Win rate change over a week, in points, and days compared; absent without a reliable measurement. */
  gap?: number;
  days?: number;
  /** Played too little for its rates to be stable. */
  weak?: true;
  /** Thirty-day sparkline (see `scaleCurve`), with the first and last measurement. */
  curve?: string;
  start?: number;
  end?: number;
}

/**
 * Row as it travels to the browser, as a tuple: field names
 * repeated over 132 rows weighed nearly 20 KB. Roles and lanes are
 * digits there (`encodeList`); a missing value is null.
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
 * Short list (two roles, three lanes at most) encoded as one number, one
 * digit per element (its position in `reference`, plus one): order is
 * kept, the main role stays first.
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

/** Order rendered by the server: win rate, from highest to lowest. */
export const STATE_DEFAULT: StateTable = { sort: "win", order: "desc", role: null, lane: null, search: "" };

/** Direction of the first click on a column: alphabetical for the name, strongest to weakest elsewhere. */
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
 * Rows sorted by a column. A hero without a measurement (weekly change)
 * goes to the end of the list in both directions; on ties, alphabetical order
 * decides: the result does not depend on input order.
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

/** Rows that pass the filters: role, lane, and case- and accent-insensitive search. */
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

/** State read from the URL (`?tri=ban&ordre=asc&role=Mage&lane=Jungle&q=…`); an unknown value keeps the default. */
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
 * Writes the state into existing URL parameters, without default
 * values: the unfiltered table's address stays bare, hence canonical.
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

// ── Sparkline ────────────────────────────────────────────────────

/** Sparkline points: one every two days over thirty. */
export const POINTS_CURVE = 15;
/** Drawing height, in units; horizontally, one unit separates two points. */
export const HEIGHT_CURVE = 20;

/**
 * Sparkline y values, as compact text: "9 9 10 - 11". Days
 * are grouped into `points` buckets (average of measured days). The scale
 * is specific to the series, but never tighter than `gapMin` points: a
 * stable rate stays flat instead of magnifying the game's rounding. A bucket
 * without a measurement is "-" and will break the line. Fewer than two measured
 * buckets: no curve.
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
    const middle = (min + max) / 2;
    min = middle - gapMin / 2;
    max = middle + gapMin / 2;
  }
  // One unit of margin keeps the line thickness inside the frame.
  return buckets
    .map((v) => (v === null ? "-" : String(Math.round(1 + (height - 2) * (1 - (v - min) / (max - min))))))
    .join(" ");
}

/** SVG path of a sparkline: one point per width unit, the line broken on "-". */
export function pathCurve(scale: string): string {
  let trace = "";
  let inProgress = false;
  scale.split(" ").forEach((y, x) => {
    if (y === "-") {
      inProgress = false;
      return;
    }
    // After a move, the following pairs are segments: no need for "L".
    trace += `${inProgress ? " " : "M"}${x} ${y}`;
    inProgress = true;
  });
  return trace;
}

/** Rate in the locale's format, with one decimal: "52,4 %", "52.4%". */
export function formatterRate(locale: string): (v: number) => string {
  const f = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (v) => f.format(v / 100);
}
