import { describe, expect, it } from "vitest";
import assumptionsData from "@/data/editorial/account-value.json";
import {
  CURRENCIES,
  DEFAULT_INPUTS,
  RANKS,
  TIERS,
  clampInputs,
  convert,
  countsFromCollection,
  estimate,
  modelOf,
  readParams,
  roughly,
  tierOf,
  writeParams,
  type Assumptions,
  type Inputs,
} from "@/lib/account-value";
import { skinsCollectible } from "@/lib/collection";
import { catalogSkins } from "@/lib/skin-catalog-server";

const a = assumptionsData as Assumptions;

describe("tierOf", () => {
  it("lets the series win over the frame colour", () => {
    expect(tierOf({ rarity: 2, series: "Collector" })).toBe("collector");
    expect(tierOf({ rarity: 3, series: "StarLight" })).toBe("starlight");
    expect(tierOf({ rarity: 2, series: "Annual StarLight" })).toBe("starlight");
    expect(tierOf({ rarity: 6, series: "Legend" })).toBe("legend");
    expect(tierOf({ rarity: 1, series: "Elite" })).toBe("elite");
    expect(tierOf({ rarity: 3, series: "Special" })).toBe("special");
    expect(tierOf({ rarity: 4, series: "Epic" })).toBe("epic");
  });

  it("falls back on the rarity", () => {
    expect(tierOf({ rarity: 5, series: "KOF" })).toBe("grand");
    expect(tierOf({ rarity: 6, series: null })).toBe("legend");
    expect(tierOf({ rarity: 1, series: null })).toBe("basic");
    expect(tierOf({ rarity: 3, series: "Halloween" })).toBe("other");
    expect(tierOf({ rarity: 2, series: "Luckybox" })).toBe("other");
  });
});

describe("modelOf", () => {
  const skins = [
    { rarity: 1, series: "Elite", price: { dm: 599 } },
    { rarity: 1, series: "Elite", price: { dm: 499 } },
    { rarity: 1, series: "Elite", price: {} },
    { rarity: 2, series: "Collector", price: { dm: 5000 } },
  ];
  const m = modelOf(skins, 10, 6, a);
  const tier = (t: string) => m.tiers.find((x) => x.tier === t)!;

  it("costs a shop tier at its median diamond price", () => {
    expect(tier("elite")).toEqual({ tier: "elite", count: 3, priced: 2, cost: 549, basis: "shop" });
  });

  it("costs a draw tier at the editorial estimate, even with a shop price", () => {
    expect(tier("collector")).toMatchObject({ count: 1, cost: a.drawCost.collector, basis: "draw" });
  });

  it("lists every tier, in order, even an empty one", () => {
    expect(m.tiers.map((t) => t.tier)).toEqual([...TIERS]);
    expect(tier("epic")).toMatchObject({ count: 0, cost: 0 });
  });

  it("covers the synced catalogue with a cost for every tier", () => {
    const c = catalogSkins();
    const real = modelOf(skinsCollectible(c), c.heroes.length, 6, a);
    for (const t of real.tiers) {
      expect(t.count, t.tier).toBeGreaterThan(0);
      expect(t.cost, t.tier).toBeGreaterThan(0);
    }
    expect(real.tiers.reduce((n, t) => n + t.count, 0)).toBe(skinsCollectible(c).length);
  });
});

describe("estimate", () => {
  const m = modelOf(
    [
      { rarity: 4, series: "Epic", price: { dm: 1000 } },
      { rarity: 4, series: "Epic", price: { dm: 1000 } },
      { rarity: 6, series: "Legend", price: {} },
    ],
    100,
    6,
    a,
  );
  const input = (o: Partial<Inputs>): Inputs => ({ ...DEFAULT_INPUTS, ...o });

  it("adds the skins at their tier cost, then the diamond balance", () => {
    const e = estimate(input({ skins: { epic: 2, legend: 1 }, diamonds: 500 }), m, a);
    expect(e.skinDiamonds).toBe(2000 + a.drawCost.legend);
    expect(e.totalDiamonds).toBe(2500 + a.drawCost.legend);
    expect(e.usd).toBeCloseTo(e.totalDiamonds * a.usdPerDiamond);
  });

  it("applies the resale fractions and the four factors", () => {
    const e = estimate(input({ skins: { epic: 2 }, rank: "mythic", heroes: 100, emblems: 6, binding: "social" }), m, a);
    const f = a.resale.rank.mythic * a.resale.heroesMax * (1 + 6 * a.resale.perEmblem) * a.resale.binding.social;
    expect(e.resale!.low).toBeCloseTo(e.usd * a.resale.low * f);
    expect(e.resale!.high).toBeCloseTo(e.usd * a.resale.high * f);
    expect(e.resale!.high).toBeGreaterThan(e.resale!.low);
  });

  it("gives no resale range to an unbound account or an empty one", () => {
    expect(estimate(input({ skins: { epic: 1 }, binding: "none" }), m, a).resale).toBeNull();
    expect(estimate(input({}), m, a).resale).toBeNull();
  });

  it("never counts more skins than the game has, nor negative ones", () => {
    const i = clampInputs(input({ skins: { epic: 9, legend: -2 }, heroes: 400, emblems: 12, diamonds: -5 }), m);
    expect(i).toMatchObject({ skins: { epic: 2 }, heroes: 100, emblems: 6, diamonds: 0 });
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
    const i: Inputs = { skins: { elite: 4, legend: 1 }, rank: "mythic-glory", heroes: 80, emblems: 3, diamonds: 1200, binding: "social" };
    const query = writeParams(i, "EUR");
    expect(query).toBe("?s=elite.4%2Clegend.1&r=mythic-glory&h=80&e=3&d=1200&b=social&c=EUR");
    expect(readParams(query)).toEqual({ inputs: i, currency: "EUR" });
  });

  it("keeps the default address bare", () => {
    expect(writeParams(DEFAULT_INPUTS, "USD")).toBe("");
  });

  it("ignores what it does not know", () => {
    const { inputs, currency } = readParams("?s=elite.x,unknown.3,epic.2&r=god&h=-4&b=stolen&c=BTC");
    expect(inputs).toEqual({ ...DEFAULT_INPUTS, skins: { epic: 2 } });
    expect(currency).toBe("USD");
  });
});

describe("countsFromCollection", () => {
  it("counts the saved skins by tier and the known heroes", () => {
    const catalog = {
      heroes: [{ slug: "miya" }, { slug: "layla" }],
      skins: [
        { id: "010", rarity: 0, series: null },
        { id: "012", rarity: 1, series: "Elite" },
        { id: "016", rarity: 6, series: "Legend" },
        { id: "017", rarity: 4, series: "Epic" },
      ],
    };
    expect(countsFromCollection({ heros: ["miya", "gone"], skins: ["010", "012", "016", "999"] }, catalog)).toEqual({
      skins: { elite: 1, legend: 1 },
      heroes: 1,
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
  });
});
