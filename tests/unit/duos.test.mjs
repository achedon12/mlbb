import { describe, expect, it } from "vitest";
import { duosOfRank, mergeDuos, serializeDuos, BUCKETS_DUO } from "../../scripts/measures.mjs";

const byId = new Map([
  [109, "aamon"],
  [76, "lolita"],
  [97, "khaleed"],
  [69, "fanny"],
  [39, "gusion"],
]);

/** Partenaire tel que le renvoie l'API : taux entre 0 et 1, tranches de duree a plat. */
const partner = (heroid, gain, buckets = {}) => ({ heroid, increase_win_rate: gain, hero_win_rate: 0.5, ...buckets });

describe("duosOfRank", () => {
  const block = {
    main_hero_win_rate: 0.51179,
    sub_hero: [
      partner(97, 0.013651),
      partner(76, 0.024673, {
        min_win_rate6: 0,
        min_win_rate6_8: 0.444444,
        min_win_rate10_12: 0.483221,
        min_win_rate12_14: 0.532258,
        min_win_rate14_16: 0,
        min_win_rate16_18: 0.529126,
        min_win_rate18_20: 0.52381,
        min_win_rate20: 0.534426,
      }),
      partner(999, 0.02),
      partner(109, 0.05),
    ],
    sub_hero_last: [partner(69, -0.070263), partner(39, -0.087743)],
  };

  it("converts gains to points and sorts each side", () => {
    const d = duosOfRank(block, byId, "aamon");
    expect(d.winRate).toBe(51.2);
    expect(d.best.map((x) => [x.slug, x.advantage])).toEqual([
      ["lolita", 2.5],
      ["khaleed", 1.4],
    ]);
    expect(d.worst.map((x) => [x.slug, x.advantage])).toEqual([
      ["gusion", -8.8],
      ["fanny", -7],
    ]);
  });

  it("drops the hero itself and unknown ids", () => {
    const d = duosOfRank(block, byId, "aamon");
    expect(d.best.some((x) => x.slug === "aamon" || x.slug === undefined)).toBe(false);
  });

  it("keeps buckets from 10 minutes on, an empty bucket being null", () => {
    const d = duosOfRank(block, byId, "aamon");
    expect(BUCKETS_DUO).toHaveLength(6);
    expect(d.best[0].phases).toEqual([48.3, 53.2, null, 52.9, 52.4, 53.4]);
    // Sans aucune tranche mesuree, pas de cle `phases` du tout.
    expect(d.best[1]).not.toHaveProperty("phases");
  });

  it("keeps a partner only on the right side of the gain", () => {
    const d = duosOfRank({ sub_hero: [partner(76, -0.01)], sub_hero_last: [partner(69, 0.01)] }, byId, "aamon");
    expect(d).toBeNull();
  });

  it("caps each list and tolerates a missing block", () => {
    const many = { sub_hero: [partner(76, 0.03), partner(97, 0.02), partner(69, 0.01)] };
    expect(duosOfRank(many, byId, "aamon", 2).best).toHaveLength(2);
    expect(duosOfRank(many, byId, "aamon").winRate).toBeNull();
    expect(duosOfRank(undefined, byId, "aamon")).toBeNull();
    expect(duosOfRank({ sub_hero: "?" }, byId, "aamon")).toBeNull();
  });
});

describe("mergeDuos", () => {
  const rank = (slug, advantage) => ({ winRate: 50, best: [{ slug, advantage }], worst: [] });

  it("replaces re-read ranks and keeps the others", () => {
    const existing = { aamon: { all: rank("lolita", 1), mythic: rank("khaleed", 2) }, fanny: { all: rank("gusion", 3) } };
    const incoming = { aamon: { mythic: rank("gusion", 4) }, gusion: { epic: rank("fanny", 1) } };
    const f = mergeDuos(existing, incoming);
    expect(f.aamon.all.best[0].slug).toBe("lolita");
    expect(f.aamon.mythic.best[0].slug).toBe("gusion");
    expect(Object.keys(f).sort()).toEqual(["aamon", "fanny", "gusion"]);
  });

  it("tolerates a missing file or an empty read", () => {
    expect(mergeDuos(undefined, { aamon: {} })).toEqual({ aamon: {} });
    expect(mergeDuos({ aamon: { all: rank("lolita", 1) } }, null).aamon.all.winRate).toBe(50);
  });
});

describe("serializeDuos", () => {
  it("writes one hero per line, in slug order, as valid JSON", () => {
    const text = serializeDuos(30, { zilong: { all: null }, aamon: { all: { winRate: 51 } } });
    const rows = text.split("\n");
    expect(rows[1]).toBe('  "days": 30,');
    expect(rows[3].trim().startsWith('"aamon"')).toBe(true);
    expect(rows[4].trim().startsWith('"zilong"')).toBe(true);
    expect(JSON.parse(text).heroes.aamon.all.winRate).toBe(51);
  });

  it("stays valid with no heroes", () => {
    expect(JSON.parse(serializeDuos(30, {}))).toEqual({ days: 30, heroes: {} });
  });
});
