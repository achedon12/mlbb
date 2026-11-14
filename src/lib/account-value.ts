/**
 * Account value estimator: what a collection cost, and the range an account
 * like it is sometimes offered for.
 *
 * Every figure is an order of magnitude, never a price. The cost side adds up
 * skins at a typical diamond cost per tier — the median shop price of the tier
 * when the shop sells it, an editorial draw cost otherwise. The resale side
 * applies a fraction of that cost, nudged by rank, heroes, emblems and the
 * account's binding. Each factor is shown on the page, with its value: a
 * reader can redo the sum by hand.
 *
 * Account trading breaks Moonton's terms of service: the page says so, and the
 * estimate is no advice to sell or buy. Pure module, without data: the
 * editorial assumptions and the catalogue are passed in, so the client
 * component can import it.
 */

// ── Tiers ───────────────────────────────────────────────────────────

/**
 * How players count their skins: by the shop line or the event that sold
 * them, more than by the frame colour. From the cheapest to the dearest.
 */
export const TIERS = ["basic", "elite", "special", "epic", "starlight", "other", "collector", "grand", "legend"] as const;
export type Tier = (typeof TIERS)[number];

/** Tiers no shop sells: their cost is an editorial draw or pass estimate. */
export const DRAW_TIERS = ["starlight", "collector", "grand", "legend"] as const satisfies readonly Tier[];
export type DrawTier = (typeof DRAW_TIERS)[number];

/**
 * Tier of a skin, from its rarity rank (1 Common to 6 Supreme) and its series
 * as the wiki labels it. The label wins: a Collector skin is framed
 * Exquisite, a StarLight one Exceptional.
 */
export function tierOf(skin: { rarity: number; series: string | null }): Tier {
  const series = skin.series?.toLowerCase() ?? "";
  if (series === "legend") return "legend";
  if (series === "collector") return "collector";
  if (series.includes("starlight")) return "starlight";
  if (series === "elite") return "elite";
  if (series === "special") return "special";
  if (series === "epic") return "epic";
  if (skin.rarity >= 6) return "legend";
  if (skin.rarity === 5) return "grand";
  if (!skin.series && skin.rarity <= 1) return "basic";
  return "other";
}

// ── Model ───────────────────────────────────────────────────────────

export const RANKS = [
  "warrior",
  "elite",
  "master",
  "grandmaster",
  "epic",
  "legend",
  "mythic",
  "mythic-honor",
  "mythic-glory",
  "mythic-immortal",
] as const;
export type Rank = (typeof RANKS)[number];

export const BINDINGS = ["moonton", "social", "none"] as const;
export type Binding = (typeof BINDINGS)[number];

export const CURRENCIES = ["USD", "EUR", "PHP", "IDR", "MYR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** `src/data/editorial/account-value.json`, as read. */
export interface Assumptions {
  checked: string;
  usdPerDiamond: number;
  drawCost: Record<DrawTier, number>;
  resale: {
    low: number;
    high: number;
    rank: Record<Rank, number>;
    heroesMin: number;
    heroesMax: number;
    perEmblem: number;
    binding: Record<Binding, number>;
  };
  ratesDate: string;
  ratesSource: string;
  rates: Record<Currency, number>;
}

export interface TierCost {
  tier: Tier;
  /** Collectible skins of the tier in the game. */
  count: number;
  /** Of them, skins with a diamond shop price. */
  priced: number;
  /** Diamonds counted for one skin of the tier. */
  cost: number;
  /** Where `cost` comes from: the tier's median shop price, or an editorial draw estimate. */
  basis: "shop" | "draw";
}

export interface Model {
  tiers: TierCost[];
  heroes: number;
  /** Emblem sets a player can max out. */
  emblems: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

const isDrawTier = (t: Tier): t is DrawTier => (DRAW_TIERS as readonly Tier[]).includes(t);

/**
 * Cost table of the tiers, from the collectible skins of the catalogue. A
 * draw tier always takes its editorial cost, even when a few of its skins
 * were also sold in the shop: the draw is how most players got them.
 */
export function modelOf(
  skins: readonly { rarity: number; series: string | null; price: { dm?: number } }[],
  heroes: number,
  emblems: number,
  assumptions: Pick<Assumptions, "drawCost">,
): Model {
  const groups = new Map<Tier, number[]>(TIERS.map((t) => [t, []]));
  const counts = new Map<Tier, number>(TIERS.map((t) => [t, 0]));
  for (const s of skins) {
    const tier = tierOf(s);
    counts.set(tier, counts.get(tier)! + 1);
    if (s.price.dm) groups.get(tier)!.push(s.price.dm);
  }
  return {
    heroes,
    emblems,
    tiers: TIERS.map((tier) => {
      const prices = groups.get(tier)!;
      const draw = isDrawTier(tier);
      return {
        tier,
        count: counts.get(tier)!,
        priced: prices.length,
        cost: draw ? assumptions.drawCost[tier] : median(prices),
        basis: draw ? "draw" : "shop",
      };
    }),
  };
}

// ── Estimate ────────────────────────────────────────────────────────

export interface Inputs {
  skins: Partial<Record<Tier, number>>;
  rank: Rank;
  heroes: number;
  emblems: number;
  diamonds: number;
  binding: Binding;
}

export const DEFAULT_INPUTS: Inputs = { skins: {}, rank: "epic", heroes: 0, emblems: 0, diamonds: 0, binding: "moonton" };

/** Upper bound of the diamond balance field: past it, a typo rather than an account. */
export const MAX_DIAMONDS = 1_000_000;

export interface Estimate {
  /** Diamonds the skins cost, at the tier costs. */
  skinDiamonds: number;
  /** Skins plus the diamond balance. */
  totalDiamonds: number;
  /** `totalDiamonds` in US dollars. */
  usd: number;
  factors: { rank: number; heroes: number; emblems: number; binding: number };
  /** Indicative resale range, in US dollars; null when the account cannot change hands. */
  resale: { low: number; high: number } | null;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
const rounded = (n: number, decimals = 3) => Math.round(n * 10 ** decimals) / 10 ** decimals;

/** Inputs brought back inside what the game allows: no more skins than exist, no negative count. */
export function clampInputs(i: Inputs, m: Model): Inputs {
  const skins: Partial<Record<Tier, number>> = {};
  for (const t of m.tiers) {
    const n = Math.round(clamp(i.skins[t.tier] ?? 0, 0, t.count));
    if (n > 0) skins[t.tier] = n;
  }
  return {
    skins,
    rank: (RANKS as readonly string[]).includes(i.rank) ? i.rank : DEFAULT_INPUTS.rank,
    heroes: Math.round(clamp(i.heroes, 0, m.heroes)),
    emblems: Math.round(clamp(i.emblems, 0, m.emblems)),
    diamonds: Math.round(clamp(i.diamonds, 0, MAX_DIAMONDS)),
    binding: (BINDINGS as readonly string[]).includes(i.binding) ? i.binding : DEFAULT_INPUTS.binding,
  };
}

export function estimate(input: Inputs, m: Model, a: Assumptions): Estimate {
  const i = clampInputs(input, m);
  const skinDiamonds = m.tiers.reduce((sum, t) => sum + (i.skins[t.tier] ?? 0) * t.cost, 0);
  const totalDiamonds = skinDiamonds + i.diamonds;
  const usd = totalDiamonds * a.usdPerDiamond;
  const share = m.heroes > 0 ? i.heroes / m.heroes : 0;
  const factors = {
    rank: a.resale.rank[i.rank],
    heroes: rounded(a.resale.heroesMin + (a.resale.heroesMax - a.resale.heroesMin) * share),
    emblems: rounded(1 + a.resale.perEmblem * i.emblems),
    binding: a.resale.binding[i.binding],
  };
  const multiplier = factors.rank * factors.heroes * factors.emblems * factors.binding;
  return {
    skinDiamonds,
    totalDiamonds,
    usd,
    factors,
    resale: multiplier > 0 && usd > 0 ? { low: usd * a.resale.low * multiplier, high: usd * a.resale.high * multiplier } : null,
  };
}

/** A dollar amount in another currency, at the editorial rate. */
export const convert = (usd: number, currency: Currency, a: Pick<Assumptions, "rates">) => usd * a.rates[currency];

/**
 * Two significant figures: 1 234 becomes 1 200, 0.47 stays 0.47. An
 * estimate shown to the cent would claim a precision it does not have.
 */
export function roughly(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  const magnitude = 10 ** (Math.floor(Math.log10(Math.abs(n))) - 1);
  return Math.round(n / magnitude) * magnitude;
}

// ── Address ─────────────────────────────────────────────────────────

/**
 * The estimate lives in the address, so it can be shared: counts only, no
 * name, no account id. `?s=elite.4,epic.2&r=mythic&h=80&e=3&d=500&b=moonton&c=EUR`.
 */
export function writeParams(i: Inputs, currency: Currency): string {
  const p = new URLSearchParams();
  const skins = TIERS.filter((t) => (i.skins[t] ?? 0) > 0).map((t) => `${t}.${i.skins[t]}`);
  if (skins.length) p.set("s", skins.join(","));
  if (i.rank !== DEFAULT_INPUTS.rank) p.set("r", i.rank);
  if (i.heroes) p.set("h", String(i.heroes));
  if (i.emblems) p.set("e", String(i.emblems));
  if (i.diamonds) p.set("d", String(i.diamonds));
  if (i.binding !== DEFAULT_INPUTS.binding) p.set("b", i.binding);
  if (currency !== "USD") p.set("c", currency);
  const query = p.toString();
  return query ? `?${query}` : "";
}

const integer = (v: string | null) => {
  const n = Number(v);
  return v !== null && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

/** Reads an address back; anything unknown or malformed falls back to the default. */
export function readParams(search: string): { inputs: Inputs; currency: Currency } {
  const p = new URLSearchParams(search);
  const skins: Partial<Record<Tier, number>> = {};
  for (const part of (p.get("s") ?? "").split(",")) {
    const [tier, n] = part.split(".");
    if ((TIERS as readonly string[]).includes(tier) && integer(n ?? null) > 0) skins[tier as Tier] = integer(n);
  }
  const rank = p.get("r") ?? "";
  const binding = p.get("b") ?? "";
  const currency = p.get("c") ?? "";
  return {
    inputs: {
      skins,
      rank: (RANKS as readonly string[]).includes(rank) ? (rank as Rank) : DEFAULT_INPUTS.rank,
      heroes: integer(p.get("h")),
      emblems: integer(p.get("e")),
      diamonds: integer(p.get("d")),
      binding: (BINDINGS as readonly string[]).includes(binding) ? (binding as Binding) : DEFAULT_INPUTS.binding,
    },
    currency: (CURRENCIES as readonly string[]).includes(currency) ? (currency as Currency) : "USD",
  };
}

/** Counts of a saved collection, by tier: what the collection tool's save holds, read in the browser. */
export function countsFromCollection(
  owned: { heros: readonly string[]; skins: readonly string[] },
  catalog: { heroes: readonly { slug: string }[]; skins: readonly { id: string; rarity: number; series: string | null }[] },
): { skins: Partial<Record<Tier, number>>; heroes: number } {
  const ids = new Set(owned.skins);
  const skins: Partial<Record<Tier, number>> = {};
  for (const s of catalog.skins) {
    if (s.rarity === 0 || !ids.has(s.id)) continue;
    const tier = tierOf(s);
    skins[tier] = (skins[tier] ?? 0) + 1;
  }
  const slugs = new Set(catalog.heroes.map((h) => h.slug));
  return { skins, heroes: owned.heros.filter((h) => slugs.has(h)).length };
}
