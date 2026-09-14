import {
  NUMERIC_CURRENCIES,
  isOrigin,
  readRelease,
  type Catalog,
  type Currency,
  type SkinCatalog,
} from "./skin-catalog";

/**
 * Value of a collection: what the heroes and skins a player has ticked cost,
 * at the in-game shop price. Nothing else: no resale value, no account
 * appraisal — account selling is forbidden by Moonton's terms. Data-free
 * module, importable by a client component.
 *
 * A hero's price is that of their original skin, which comes with them.
 * Many are bought with diamonds or battle points: the diamond total only
 * counts diamond prices, battle points are summed separately.
 */

export interface Ownership {
  heros: ReadonlySet<string>;
  /** Skin IDs, excluding original skins (carried by `heros`). */
  skins: ReadonlySet<string>;
}

export interface RowSummary {
  owned: number;
  total: number;
  diamonds: number;
}

export interface Summary {
  heroes: RowSummary & {
    battlePoints: number;
    /** Owned heroes with no diamond price (battle points, fragments…). */
    withoutDiamond: number;
  };
  skins: RowSummary & {
    /** Owned skins with no diamond price: event, draw, StarLight, pass. */
    withoutDiamond: number;
    /** Other currencies of owned skins (magic cores, gems…), excluding diamonds. */
    others: Partial<Record<Currency, number>>;
  };
  /** Heroes and skins, in diamonds. */
  diamonds: number;
  byRarity: (RowSummary & { rank: number })[];
  bySeries: (RowSummary & { series: string })[];
  plusRare: SkinCatalog[];
}

/** Skins that can be ticked: released or already in the shop, excluding original and announced skins. */
export const skinsCollectible = (c: Catalog) => c.skins.filter((s) => !isOrigin(s) && s.availability !== "Upcoming");

/** Original skin of each hero: it carries the hero's price. */
export function originsByHero(c: Catalog): Map<string, SkinCatalog> {
  const m = new Map<string, SkinCatalog>();
  for (const s of c.skins) if (isOrigin(s) && !m.has(s.hero)) m.set(s.hero, s);
  return m;
}

/**
 * From rarest to most common: rarity, then limited edition, then smallest
 * series, then oldest. The first in the list is the collection's
 * centerpiece.
 */
export function compareRarity(runLength: ReadonlyMap<string, number>) {
  const size = (s: SkinCatalog) => (s.series ? (runLength.get(s.series) ?? Infinity) : Infinity);
  const keyDate = (s: SkinCatalog) => (readRelease(s.release) ? s.release! : "9999");
  return (a: SkinCatalog, b: SkinCatalog) =>
    b.rarity - a.rarity ||
    Number(b.availability === "Limited") - Number(a.availability === "Limited") ||
    size(a) - size(b) ||
    keyDate(a).localeCompare(keyDate(b)) ||
    a.name.localeCompare(b.name, "en");
}

export function summaryCollection(c: Catalog, p: Ownership, rareCount = 6): Summary {
  const origins = originsByHero(c);
  const heroes = { owned: 0, total: c.heroes.length, diamonds: 0, battlePoints: 0, withoutDiamond: 0 };
  for (const h of c.heroes) {
    if (!p.heros.has(h.slug)) continue;
    heroes.owned += 1;
    const price = origins.get(h.slug)?.price ?? {};
    heroes.diamonds += price.dm ?? 0;
    heroes.battlePoints += price.bp ?? 0;
    if (price.dm == null) heroes.withoutDiamond += 1;
  }

  const collectible = skinsCollectible(c);
  const skins = { owned: 0, total: collectible.length, diamonds: 0, withoutDiamond: 0, others: {} as Summary["skins"]["others"] };
  const byRarity = new Map<number, RowSummary & { rank: number }>();
  const bySeries = new Map<string, RowSummary & { series: string }>();
  const owned: SkinCatalog[] = [];

  for (const s of collectible) {
    const r = byRarity.get(s.rarity) ?? { rank: s.rarity, owned: 0, total: 0, diamonds: 0 };
    byRarity.set(s.rarity, r);
    const series = s.series ? (bySeries.get(s.series) ?? { series: s.series, owned: 0, total: 0, diamonds: 0 }) : null;
    if (series) bySeries.set(s.series!, series);
    r.total += 1;
    if (series) series.total += 1;
    if (!p.skins.has(s.id)) continue;

    owned.push(s);
    const dm = s.price.dm ?? 0;
    skins.owned += 1;
    skins.diamonds += dm;
    if (s.price.dm == null) skins.withoutDiamond += 1;
    for (const m of NUMERIC_CURRENCIES) {
      if (m !== "dm" && s.price[m] != null) skins.others[m] = (skins.others[m] ?? 0) + s.price[m]!;
    }
    r.owned += 1;
    r.diamonds += dm;
    if (series) {
      series.owned += 1;
      series.diamonds += dm;
    }
  }

  const sizes = new Map([...bySeries].map(([name, l]) => [name, l.total]));
  return {
    heroes,
    skins,
    diamonds: heroes.diamonds + skins.diamonds,
    byRarity: [...byRarity.values()].sort((a, b) => b.rank - a.rank),
    // Started series first, by completion rate; then the largest.
    bySeries: [...bySeries.values()].sort(
      (a, b) =>
        Number(b.owned > 0) - Number(a.owned > 0) ||
        b.owned / b.total - a.owned / a.total ||
        b.total - a.total ||
        a.series.localeCompare(b.series, "en"),
    ),
    plusRare: owned.sort(compareRarity(sizes)).slice(0, rareCount),
  };
}

/**
 * Price coverage of the catalogue, to state honestly what the total counts:
 * heroes and skins priced in diamonds, and the rest.
 */
export function coveragePrice(c: Catalog) {
  const origins = originsByHero(c);
  const skins = skinsCollectible(c);
  return {
    heroes: c.heroes.length,
    heroDiamonds: c.heroes.filter((h) => origins.get(h.slug)?.price.dm != null).length,
    skins: skins.length,
    skinsDiamonds: skins.filter((s) => s.price.dm != null).length,
    skinsOtherCurrency: skins.filter((s) => s.price.dm == null && Object.keys(s.price).length > 0).length,
  };
}

// ── Local save ─────────────────────────────────────────────────────

export const KEY_COLLECTION = "mlbbdex:collection";

export interface StoredOwnership {
  heros: string[];
  skins: string[];
}

/** Reads the save back; a corrupted or differently shaped value yields an empty collection. */
export function readOwnership(raw: string | null): StoredOwnership {
  const empty = { heros: [], skins: [] };
  if (!raw) return empty;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return empty;
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((e): e is string => typeof e === "string") : []);
    return { heros: list((v as StoredOwnership).heros), skins: list((v as StoredOwnership).skins) };
  } catch {
    return empty;
  }
}

export function writeOwnership(p: Ownership): string {
  return JSON.stringify({ heros: [...p.heros].sort(), skins: [...p.skins].sort() });
}
