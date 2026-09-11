import { lireSortie, type SkinCatalogue } from "./catalogue-skins";

/**
 * Events calendar: what comes out each month (StarLight skin, Collector
 * skins, event, draw or shop skins), built from the skin catalogue and the
 * wiki's monthly lists.
 *
 * No data here: the logic is tested on its own, the join with the wiki files
 * lives in `events-server`.
 */

/**
 * How a skin is obtained, read from the skin module's own fields only: label
 * (series), numeric prices and obtain text. Display order.
 */
export const OBTAIN_MODES = ["starlight", "collector", "event", "shop", "pass"] as const;
export type ObtainMode = (typeof OBTAIN_MODES)[number];
export type OtherMode = Exclude<ObtainMode, "starlight" | "collector">;
export const OTHER_MODES: readonly OtherMode[] = ["event", "shop", "pass"];

/** Pass, ranked season or first top-up reward ("M5 Pass", "Season 36", "S36 First Recharge"). */
const PASS = /\b(?:pass|season|recharge)\b/i;

export function obtainMode(s: Pick<SkinCatalogue, "serie" | "obtention" | "prix">): ObtainMode {
  const series = s.serie?.toLowerCase() ?? "";
  const obtain = s.obtention ?? "";
  // The label is sometimes missing, the "2025/05 StarLight Member" text is not.
  if (series === "starlight" || /starlight member/i.test(obtain)) return "starlight";
  if (series === "collector") return "collector";
  if (PASS.test(obtain) || /^s\d+$/.test(series)) return "pass";
  // Diamonds, battle points, tickets or fragments: a fixed price, in the shop.
  if (s.prix.dm || s.prix.bp || s.prix.ticket || s.prix.hf) return "shop";
  // The rest: magic cores (wheel), gems, myth coins, or no fixed price at all (draws, collaborations).
  return "event";
}

// ── Months ─────────────────────────────────────────────────────────

const MONTH_FORMAT = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-09": a valid month, as it appears in a page URL. */
export const isMonth = (m: string) => MONTH_FORMAT.test(m);

/** Month shifted by `n` months, across years. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Month of a wiki date; null when it only gives the year, or nothing readable. */
export function monthOfRelease(release: string | null | undefined): string | null {
  const d = lireSortie(release);
  return d?.mois ? `${d.annee}-${String(d.mois).padStart(2, "0")}` : null;
}

/** Past, current, or announced by a source, as of the data date. */
export type MonthStatus = "past" | "current" | "announced";
export function monthStatus(month: string, reference: string): MonthStatus {
  const current = reference.slice(0, 7);
  return month === current ? "current" : month > current ? "announced" : "past";
}

// ── Assembly ───────────────────────────────────────────────────────

/** Calendar skin; `notInCatalogue`: known from the wiki lists only, without rarity or price. */
export interface EventSkin extends SkinCatalogue {
  notInCatalogue?: boolean;
}

/** Entry of a wiki monthly list, already resolved to its skin. */
export interface ListEntry {
  mode: "starlight" | "collector";
  month: string;
  skin: EventSkin;
}

export interface EventMonth {
  month: string;
  starlight: EventSkin[];
  collector: EventSkin[];
  /** The wiki list states explicitly that no Collector skin came out that month. */
  noCollector: boolean;
  others: Record<OtherMode, EventSkin[]>;
  total: number;
}

const skinKey = (s: Pick<SkinCatalogue, "heros" | "id" | "nom">) => `${s.heros}|${s.id || s.nom}`;
const byDate = (a: SkinCatalogue, b: SkinCatalogue) =>
  (a.sortie ?? "").localeCompare(b.sortie ?? "") || a.nom.localeCompare(b.nom, "en");

/**
 * Months with at least one skin, newest first.
 *
 * A skin quoted by a monthly list takes the list's month, even when the
 * module dates it otherwise: the lists follow releases closely, the module
 * does not. Other skins take their release month; a skin dated to the year
 * only goes into no month.
 */
export function buildMonths(o: {
  released: readonly SkinCatalogue[];
  lists: readonly ListEntry[];
  noCollector: readonly string[];
}): EventMonth[] {
  const byMonth = new Map<string, EventMonth>();
  const block = (month: string) => {
    let m = byMonth.get(month);
    if (!m) {
      m = { month, starlight: [], collector: [], noCollector: false, others: { event: [], shop: [], pass: [] }, total: 0 };
      byMonth.set(month, m);
    }
    return m;
  };

  const listed = new Set<string>();
  for (const e of o.lists) {
    const key = skinKey(e.skin);
    // A list may quote a skin twice (a rerun from one month to the next): the first occurrence counts.
    if (listed.has(key)) continue;
    listed.add(key);
    block(e.month)[e.mode].push(e.skin);
  }
  for (const s of o.released) {
    const month = monthOfRelease(s.sortie);
    if (!month || listed.has(skinKey(s))) continue;
    const mode = obtainMode(s);
    const m = block(month);
    if (mode === "starlight" || mode === "collector") m[mode].push(s);
    else m.others[mode].push(s);
  }
  for (const month of o.noCollector) {
    const m = byMonth.get(month);
    if (m && m.collector.length === 0) m.noCollector = true;
  }

  return [...byMonth.values()]
    .map((m) => {
      m.starlight.sort(byDate);
      m.collector.sort(byDate);
      for (const mode of OTHER_MODES) m.others[mode].sort(byDate);
      m.total = m.starlight.length + m.collector.length + OTHER_MODES.reduce((n, k) => n + m.others[k].length, 0);
      return m;
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** Neighbouring months in a newest-first list: `previous` is older. */
export function neighbours(months: readonly string[], current: string): { previous: string | null; next: string | null } {
  const i = months.indexOf(current);
  if (i < 0) return { previous: null, next: null };
  return { previous: months[i + 1] ?? null, next: months[i - 1] ?? null };
}
