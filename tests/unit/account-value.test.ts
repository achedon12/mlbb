import { describe, expect, it } from "vitest";
import assumptionsData from "@/data/editorial/account-value.json";
import {
  CURRENCIES,
  DEFAULT_INPUTS,
  MAX_PER_TIER,
  POINTS,
  RANKS,
  TIERS,
  clampInputs,
  convert,
  countsFromCollection,
  estimate,
  modelOf,
  pointsOf,
  readParams,
  roughly,
  tierOf,
  writeParams,
  type Assumptions,
  type Inputs,
} from "@/lib/account-value";
import { skinsCollectible } from "@/lib/collection";
import { RARITIES } from "@/lib/rarities";
import { catalogSkins } from "@/lib/skin-catalog-server";

const a = assumptionsData as Assumptions;

describe("tierOf", () => {
  it("maps every catalogue rarity to its Showcase row", () => {
    expect(tierOf({ rarity: 6 })).toBe("legend");
    expect(tierOf({ rarity: 5 })).toBe("grand");
    expect(tierOf({ rarity: 4 })).toBe("deluxe");
    expect(tierOf({ rarity: 3 })).toBe("exceptional");
    expect(tierOf({ rarity: 2 })).toBe("exquisite");
    expect(tierOf({ rarity: 1 })).toBe("common");
  });

  it("follows the wiki rarity names, Supreme being the Legend row", () => {
    const byName = Object.fromEntries(Object.values(RARITIES).map((r) => [r.key, tierOf({ rarity: r.rank })]));
    expect(byName).toEqual({
      Supreme: "legend",
      Grand: "grand",
      Exquisite: "exquisite",
      Deluxe: "deluxe",
      Exceptional: "exceptional",
      Common: "common",
    });
  });

  it("gives no row to the original skin or an unknown rank", () => {
    expect(tierOf({ rarity: 0 })).toBeNull();
    expect(tierOf({ rarity: 9 })).toBeNull();
  });
});

describe("collection points", () => {
  it("gives each tier the game's points, the shining skins none", () => {
    expect(TIERS.map((t) => POINTS[t])).toEqual([4000, 3000, 2000, 400, 200, 100, 40, 0]);
  });

  it("adds up to the total of a real Showcase", () => {
    // Counts copied from an in-game Showcase: 157 160 points.
    const skins = { legend: 1, grand: 12, exquisite: 19, deluxe: 69, exceptional: 130, common: 240, painted: 39 };
    expect(pointsOf(skins)).toBe(4000 + 36000 + 38000 + 27600 + 26000 + 24000 + 1560);
    expect(pointsOf(skins)).toBe(157_160);
    expect(pointsOf({ ...skins, glow: 25 })).toBe(157_160);
  });
});

describe("modelOf", () => {
  const skins = [
    { rarity: 1, price: { dm: 599 } },
    { rarity: 1, price: { dm: 499 } },
    { rarity: 1, price: {} },
    { rarity: 2, price: { dm: 5000 } },
    { rarity: 0, price: { dm: 32000 } },
  ];
  const m = modelOf(skins, 10, 6, a);
  const tier = (t: string) => m.tiers.find((x) => x.tier === t)!;

  it("costs a shop tier at its median diamond price", () => {
    expect(tier("common")).toEqual({ tier: "common", points: 100, count: 3, priced: 2, cost: 549, basis: "shop" });
  });

  it("costs a draw tier at the editorial estimate, even with a shop price", () => {
    expect(tier("exquisite")).toMatchObject({ count: 1, cost: a.drawCost.exquisite, basis: "draw", points: 2000 });
  });

  it("gives the colour variants a flat cost and no catalogue count", () => {
    expect(tier("painted")).toMatchObject({ count: null, cost: a.flatCost.painted, basis: "flat", points: 40 });
    expect(tier("glow")).toMatchObject({ count: null, cost: 0, basis: "flat", points: 0 });
  });

  it("lists every tier, in the Showcase order, even an empty one", () => {
    expect(m.tiers.map((t) => t.tier)).toEqual([...TIERS]);
    expect(tier("deluxe")).toMatchObject({ count: 0, cost: 0 });
  });

  it("covers the synced catalogue with a cost for every listed tier", () => {
    const c = catalogSkins();
    const real = modelOf(skinsCollectible(c), c.heroes.length, 6, a);
    for (const t of real.tiers) {
      if (t.basis === "flat") continue;
      expect(t.count, t.tier).toBeGreaterThan(0);
      expect(t.cost, t.tier).toBeGreaterThan(0);
    }
    expect(real.tiers.reduce((n, t) => n + (t.count ?? 0), 0)).toBe(skinsCollectible(c).length);
  });
});

describe("estimate", () => {
  const m = modelOf(
    [
      { rarity: 4, price: { dm: 1000 } },
      { rarity: 4, price: { dm: 1000 } },
      { rarity: 6, price: {} },
    ],
    100,
    6,
    a,
  );
  const input = (o: Partial<Inputs>): Inputs => ({ ...DEFAULT_INPUTS, ...o });

  it("adds the skins at their tier cost, then the diamond balance", () => {
    const e = estimate(input({ skins: { deluxe: 2, legend: 1, painted: 3 }, diamonds: 500 }), m, a);
    expect(e.skinDiamonds).toBe(2000 + a.drawCost.legend + 3 * a.flatCost.painted);
    expect(e.totalDiamonds).toBe(e.skinDiamonds + 500);
    expect(e.usd).toBeCloseTo(e.totalDiamonds * a.usdPerDiamond);
    expect(e.points).toBe(2 * 400 + 4000 + 3 * 40);
  });

  it("applies the resale fractions and the four factors", () => {
    const e = estimate(input({ skins: { deluxe: 2 }, rank: "mythic", heroes: 100, emblems: 6, binding: "social" }), m, a);
    const f = a.resale.rank.mythic * a.resale.heroesMax * (1 + 6 * a.resale.perEmblem) * a.resale.binding.social;
    expect(e.resale!.low).toBeCloseTo(e.usd * a.resale.low * f);
    expect(e.resale!.high).toBeCloseTo(e.usd * a.resale.high * f);
    expect(e.resale!.high).toBeGreaterThan(e.resale!.low);
  });

  it("gives no resale range to an unbound account or an empty one", () => {
    expect(estimate(input({ skins: { deluxe: 1 }, binding: "none" }), m, a).resale).toBeNull();
    expect(estimate(input({}), m, a).resale).toBeNull();
  });

  it("does not cap a tier at the catalogue count, only a typo, nor keeps negative counts", () => {
    const i = clampInputs(input({ skins: { deluxe: 9, grand: 99_999, legend: -2 }, heroes: 400, emblems: 12, diamonds: -5 }), m);
    expect(i).toMatchObject({ skins: { deluxe: 9, grand: MAX_PER_TIER }, heroes: 100, emblems: 6, diamonds: 0 });
  });
});

describe("display", () => {
  it("rounds to two significant figures", () => {
    expect(roughly(1234)).toBe(1200);
    expect(roughly(987_654)).toBe(990_000);
    expect(roughly(0.4749)).toBeCloseTo(0.47);
    expect(roughly(0)).toBe(0);
  });

  it("converts with the editorial rates", () => {
    expect(convert(10, "USD", a)).toBe(10);
    expect(convert(10, "PHP", a)).toBe(10 * a.rates.PHP);
  });
});

describe("address", () => {
  it("round-trips the inputs and the currency", () => {
    const i: Inputs = { skins: { legend: 1, deluxe: 69, glow: 2 }, rank: "mythic-glory", heroes: 80, emblems: 3, diamonds: 1200, binding: "social" };
    const query = writeParams(i, "EUR");
    expect(query).toBe("?s=legend.1%2Cdeluxe.69%2Cglow.2&r=mythic-glory&h=80&e=3&d=1200&b=social&c=EUR");
    expect(readParams(query)).toEqual({ inputs: i, currency: "EUR" });
  });

  it("keeps the default address bare", () => {
    expect(writeParams(DEFAULT_INPUTS, "USD")).toBe("");
  });

  it("ignores what it does not know", () => {
    const { inputs, currency } = readParams("?s=deluxe.x,unknown.3,exquisite.2,elite.4&r=god&h=-4&b=stolen&c=BTC");
    expect(inputs).toEqual({ ...DEFAULT_INPUTS, skins: { exquisite: 2 } });
    expect(currency).toBe("USD");
  });
});

describe("countsFromCollection", () => {
  it("counts the saved skins by Showcase tier, the unmapped ones apart, and the known heroes", () => {
    const catalog = {
      heroes: [{ slug: "miya" }, { slug: "layla" }],
      skins: [
        { id: "010", rarity: 0 },
        { id: "012", rarity: 1 },
        { id: "013", rarity: 2 },
        { id: "016", rarity: 6 },
        { id: "017", rarity: 4 },
        { id: "018", rarity: 7 },
      ],
    };
    const owned = { heros: ["miya", "gone"], skins: ["010", "012", "013", "016", "018", "999", "012"] };
    expect(countsFromCollection(owned, catalog)).toEqual({
      skins: { common: 1, exquisite: 1, legend: 1 },
      heroes: 1,
      unmapped: 2,
    });
  });
});

describe("editorial assumptions", () => {
  it("dates its rates and covers every currency, rank and binding", () => {
    expect(a.ratesDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.ratesSource).toMatch(/^https:\/\//);
    for (const c of CURRENCIES) expect(a.rates[c]).toBeGreaterThan(0);
    expect(a.rates.USD).toBe(1);
    for (const r of RANKS) expect(a.resale.rank[r]).toBeGreaterThan(0);
    expect(a.resale.low).toBeLessThan(a.resale.high);
    expect(a.resale.binding.none).toBe(0);
    for (const t of ["legend", "grand", "exquisite"] as const) expect(a.drawCost[t]).toBeGreaterThan(0);
    expect(a.drawCostSources.length).toBeGreaterThan(0);
    for (const url of a.drawCostSources) expect(url).toMatch(/^https:\/\//);
    expect(a.flatCost.glow).toBe(0);
  });
});
