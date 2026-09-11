/**
 * Draw odds calculator (random-draw events of the in-game shop).
 *
 * The player enters the parameters the game publishes: price of one draw (and
 * of a 10-draw), chance of the wanted prize on each draw, and an optional
 * guarantee ("pity") on the Nth draw. Draws are assumed independent with the
 * same chance `p` until the pity, which is what the event rules describe.
 *
 * Number of draws T until the first prize: P(T > n) = (1 - p)^n while n < N,
 * then 0. Hence E[T] = (1 - (1 - p)^N) / p, and 1 / p without pity. Powers go
 * through `log1p`/`expm1`: for p = 0.01 %, computing 1 - 0.9999^n directly
 * would lose half of the significant digits. Diamonds stay exact integers.
 */

/** Input bounds: beyond them, the value is more likely a typo than a real event. */
export const LIMITS = {
  cost: 100_000,
  tenCost: 1_000_000,
  pity: 100_000,
  budget: 1_000_000_000,
  draws: 1_000_000,
  /** Minimum chance, in percent: 0.0001 %, one in a million. */
  minChance: 0.0001,
} as const;

/** Tolerance of probability comparisons, so that 50 % computed as 0.4999999999 counts as 50 %. */
const EPSILON = 1e-12;

export interface DrawEvent {
  /** Price of one draw, in diamonds. */
  cost: number;
  /** Price of a 10-draw; `null` when there is none. */
  tenCost: number | null;
  /** Chance of the wanted prize on each draw, in percent. */
  chance: number;
  /** Draw on which the prize is guaranteed; `null` without pity. */
  pity: number | null;
}

/**
 * Reads a whole number of diamonds or draws. The thousands separators of
 * every site language (space, dot, comma, apostrophe) are ignored: "3,000",
 * "3.000" and "3 000" all read as 3000.
 */
export function parseInteger(input: string): number | null {
  const text = input.replace(/[\s\u00a0\u202f.,'’]/g, "");
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

/** Reads a percentage: decimal comma or dot, % sign allowed. */
export function parsePercent(input: string): number | null {
  const text = input.trim().replace(/[\s\u00a0\u202f%]/g, "").replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Faulty input field, so the interface can flag it. */
export type DrawField = "cost" | "tenCost" | "chance" | "pity" | "budget" | "draws";

const isIntegerIn = (v: number | null, min: number, max: number) =>
  v !== null && Number.isInteger(v) && v >= min && v <= max;

/** Invalid fields of an event; empty when everything is usable. */
export function validateEvent(e: DrawEvent): DrawField[] {
  const errors: DrawField[] = [];
  if (!isIntegerIn(e.cost, 1, LIMITS.cost)) errors.push("cost");
  if (e.tenCost !== null && !isIntegerIn(e.tenCost, 1, LIMITS.tenCost)) errors.push("tenCost");
  if (!(Number.isFinite(e.chance) && e.chance >= LIMITS.minChance && e.chance <= 100)) errors.push("chance");
  if (e.pity !== null && !isIntegerIn(e.pity, 1, LIMITS.pity)) errors.push("pity");
  return errors;
}

/** The 10-draw only matters when it costs less than ten single draws. */
export function tenDrawPays(e: DrawEvent): boolean {
  return e.tenCost !== null && e.tenCost < 10 * e.cost;
}

/** ln(1 - p), accurate even for a tiny p; -Infinity when p = 1. */
const logMiss = (e: DrawEvent) => Math.log1p(-e.chance / 100);

/** Chance of having the prize within `n` draws (between 0 and 1). */
export function chanceWithin(n: number, e: DrawEvent): number {
  if (n <= 0) return 0;
  if (e.pity !== null && n >= e.pity) return 1;
  if (e.chance >= 100) return 1;
  return -Math.expm1(n * logMiss(e));
}

/** Average number of draws to get the prize, pity included. */
export function expectedDraws(e: DrawEvent): number {
  const p = e.chance / 100;
  if (p >= 1) return 1;
  if (e.pity === null) return 1 / p;
  return -Math.expm1(e.pity * logMiss(e)) / p;
}

/**
 * Average number of 10-draws bought when drawing only by ten and stopping at
 * the first prize: E[ceil(T/10)] = sum of P(T > 10j), a geometric series of
 * ratio (1 - p)^10, cut at the pity.
 */
export function expectedTenDraws(e: DrawEvent): number {
  if (e.chance >= 100) return 1;
  const ratio = 10 * logMiss(e);
  const oneMinusRatio = -Math.expm1(ratio);
  if (e.pity === null) return 1 / oneMinusRatio;
  const terms = Math.ceil(e.pity / 10);
  return -Math.expm1(terms * ratio) / oneMinusRatio;
}

/**
 * Diamonds needed for at least `n` draws, at the best price: 10-draws and the
 * rest one by one, or one more 10-draw when it costs less than the singles
 * left (9 draws at 50 versus a 10-draw at 450).
 */
export function diamondsFor(n: number, e: DrawEvent): number {
  if (n <= 0) return 0;
  if (!tenDrawPays(e)) return n * e.cost;
  const ten = e.tenCost!;
  const full = Math.floor(n / 10);
  return Math.min(full * ten + (n % 10) * e.cost, Math.ceil(n / 10) * ten);
}

/**
 * Draws a budget pays for: as many 10-draws as possible, then singles.
 * Giving up a 10-draw for singles never yields more, since ten singles cost
 * at least one 10-draw.
 */
export function drawsForBudget(budget: number, e: DrawEvent): number {
  if (budget <= 0) return 0;
  if (!tenDrawPays(e)) return Math.floor(budget / e.cost);
  const ten = e.tenCost!;
  return 10 * Math.floor(budget / ten) + Math.floor((budget % ten) / e.cost);
}

/** Smallest number of draws giving at least `target` (between 0 and 1) chance of the prize. */
export function drawsForChance(target: number, e: DrawEvent): number {
  if (target <= 0) return 0;
  if (e.chance >= 100) return 1;
  const reached = (n: number) => chanceWithin(n, e) >= target - EPSILON;
  // Logarithmic estimate, then a one-step adjustment for rounding.
  let n = target >= 1 ? Infinity : Math.max(1, Math.ceil(Math.log1p(-target) / logMiss(e)));
  if (e.pity !== null) n = Math.min(n, e.pity);
  if (!Number.isFinite(n)) return Infinity;
  while (n > 1 && reached(n - 1)) n--;
  while (!reached(n)) n++;
  return n;
}

/** Displayed milestones: even odds, nine in ten, near certainty. */
export const MILESTONES = [0.5, 0.9, 0.99] as const;

export interface Milestone {
  target: number;
  draws: number;
  diamonds: number;
}

export interface Analysis {
  /** Draws made: those the budget pays for, or those entered. */
  draws: number;
  /** Diamonds spent on those draws (at most the budget). */
  diamonds: number;
  /** Chance of having the prize after those draws (between 0 and 1). */
  chance: number;
  expectedDraws: number;
  /** Average diamonds when drawing one at a time. */
  expectedDiamondsSingle: number;
  /** Average diamonds when drawing by ten; `null` without a worthwhile 10-draw. */
  expectedDiamondsTen: number | null;
  milestones: Milestone[];
}

export type Goal = { type: "budget"; diamonds: number } | { type: "draws"; count: number };

export type Result = { state: "invalid"; errors: DrawField[] } | ({ state: "ok" } & Analysis);

/** Everything the calculator shows, for an event and a budget (or a number of draws). */
export function analyze(e: DrawEvent, goal: Goal): Result {
  const errors = validateEvent(e);
  if (goal.type === "budget" && !isIntegerIn(goal.diamonds, 0, LIMITS.budget)) errors.push("budget");
  if (goal.type === "draws" && !isIntegerIn(goal.count, 1, LIMITS.draws)) errors.push("draws");
  if (errors.length) return { state: "invalid", errors };

  const draws = goal.type === "budget" ? drawsForBudget(goal.diamonds, e) : goal.count;
  const expected = expectedDraws(e);
  return {
    state: "ok",
    draws,
    diamonds: diamondsFor(draws, e),
    chance: chanceWithin(draws, e),
    expectedDraws: expected,
    expectedDiamondsSingle: expected * e.cost,
    expectedDiamondsTen: tenDrawPays(e) ? expectedTenDraws(e) * e.tenCost! : null,
    milestones: MILESTONES.map((target) => {
      const n = drawsForChance(target, e);
      return { target, draws: n, diamonds: diamondsFor(n, e) };
    }),
  };
}

/**
 * Events whose odds the wiki publishes, copied as is with their page and its
 * last edit date: rules change, the player must be able to check. The prize is
 * "a skin (or hero) from the pool", not a specific one: the wiki does not give
 * each one's chance. The name is the event's in-game name, in English as on
 * the wiki.
 */
export interface Preset {
  key: "aurora" | "newArrivalSkin" | "newArrivalHero";
  name: string;
  event: DrawEvent;
  source: string;
  /** ISO date of the last edit of the cited page. */
  checked: string;
}

export const PRESETS: readonly Preset[] = [
  {
    // 10 Lucky Points per draw, capped at 90: the 10th draw is guaranteed.
    key: "aurora",
    name: "Aurora Summon",
    event: { cost: 50, tenCost: 450, chance: 1, pity: 10 },
    source: "https://mobilelegends.fandom.com/wiki/Aurora_Summon",
    checked: "2025-04-11",
  },
  {
    key: "newArrivalSkin",
    name: "New Arrival Shop",
    event: { cost: 10, tenCost: 90, chance: 1.38, pity: 160 },
    source: "https://mobilelegends.fandom.com/wiki/New_Arrival_Shop",
    checked: "2025-07-04",
  },
  {
    key: "newArrivalHero",
    name: "New Arrival Shop",
    event: { cost: 10, tenCost: 90, chance: 1, pity: 160 },
    source: "https://mobilelegends.fandom.com/wiki/New_Arrival_Shop",
    checked: "2025-07-04",
  },
];

/** Wiki page stating that one Crystal of Aurora equals one diamond in draws. */
export const CRYSTAL_SOURCE = "https://mobilelegends.fandom.com/wiki/Crystal_of_Aurora";

/**
 * Events this model does not cover, cited by the page to explain why: rising
 * price (Grand Collection), points to accumulate (Zodiac), cores to exchange
 * (Magic Wheel).
 */
export const OUT_OF_MODEL_SOURCES = [
  { name: "Grand Collection", url: "https://mobilelegends.fandom.com/wiki/Grand_Collection" },
  { name: "Zodiac", url: "https://mobilelegends.fandom.com/wiki/Zodiac" },
  { name: "Magic Wheel", url: "https://mobilelegends.fandom.com/wiki/Magic_Wheel" },
] as const;

/**
 * Points of the cumulative chance curve, from 0 to `upTo` draws. At most
 * `points` + 1 points, keeping the pity step: without the point just before
 * it, the curve would slope up instead of jumping.
 */
export function curve(e: DrawEvent, upTo: number, points = 120): { n: number; p: number }[] {
  const max = Math.max(1, Math.round(upTo));
  const step = Math.max(1, max / points);
  const ns = new Set<number>([0, max]);
  for (let x = 0; x <= max; x += step) ns.add(Math.round(x));
  if (e.pity !== null && e.pity <= max) {
    ns.add(e.pity - 1);
    ns.add(e.pity);
  }
  return [...ns].sort((a, b) => a - b).map((n) => ({ n, p: chanceWithin(n, e) }));
}
