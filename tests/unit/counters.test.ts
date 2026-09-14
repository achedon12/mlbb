import { describe, expect, it } from "vitest";
import { createTFrom } from "@/i18n/t";
import {
  aggregateCounters,
  countersByLane,
  frenchOf,
  formatGap,
  momentsMatch,
  itemsCounter,
  summarySentence,
  hasLifesteal,
  summaryRank,
  reasonsCounter,
  type ProfileThreat,
} from "@/lib/counters";
import type { CountersByRank } from "@/lib/data";
import type { Lane } from "@/lib/types";

const t = createTFrom({
  counters: { pts: "pts" },
  measuredRanks: { mythic: "Mythique", all: "Tous rangs" },
  pages: {
    heroCounters: {
      allRanks: "Tous rangs confondus",
      atRank: "En {rank}",
      overview: "{context}, {name} souffre le plus face à {weakAgainst}, et prend l'avantage sur {strongAgainst}.",
      overviewNoStrong: "{context}, {name} souffre le plus face à {weakAgainst}.",
      noMeasure: "Pas encore de counter mesuré pour {name}.",
    },
  },
});

const measure = (weak: [string, number][], strong: [string, number][] = []) => ({
  weak: weak.map(([slug, advantage]) => ({ slug, advantage })),
  strong: strong.map(([slug, advantage]) => ({ slug, advantage })),
  winRate: 50,
});

describe("frenchOf", () => {
  it("elides before a vowel, not before a consonant, an h or a y", () => {
    expect(frenchOf("Aamon")).toBe("d'Aamon");
    expect(frenchOf("Esmeralda")).toBe("d'Esmeralda");
    expect(frenchOf("Gusion")).toBe("de Gusion");
    expect(frenchOf("Hayabusa")).toBe("de Hayabusa");
    expect(frenchOf("Yve")).toBe("de Yve");
  });
});

describe("aggregateCounters", () => {
  const byRank: CountersByRank = {
    all: measure([["gloo", -9]]),
    epic: measure([["gloo", -2], ["atlas", -4]], [["cici", 3]]),
    mythic: measure([["gloo", -3], ["lolita", -5]], [["cici", 2], ["marcel", 4]]),
  };

  it("reads buckets one by one, excluding `all`, and ranks by consistency then by gap", () => {
    expect(aggregateCounters(byRank, "weak")).toEqual([
      { slug: "gloo", ranks: 2, average: -2.5 },
      { slug: "lolita", ranks: 1, average: -5 },
      { slug: "atlas", ranks: 1, average: -4 },
    ]);
    expect(aggregateCounters(byRank, "strong").map((c) => c.slug)).toEqual(["cici", "marcel"]);
  });

  it("falls back to `all` when no bucket is measured", () => {
    expect(aggregateCounters({ all: measure([["gloo", -9]]) }, "weak")).toEqual([{ slug: "gloo", ranks: 1, average: -9 }]);
    expect(aggregateCounters({}, "weak")).toEqual([]);
  });

  it("picks Mythic for the summary, else all ranks, else the first measured rank", () => {
    expect(summaryRank(byRank)).toBe("mythic");
    expect(summaryRank({ all: measure([]) })).toBe("all");
    expect(summaryRank({ glory: measure([]) })).toBe("glory");
    expect(summaryRank({})).toBeNull();
  });
});

describe("summarySentence", () => {
  const weak = [
    { name: "Hayabusa", advantage: -3 },
    { name: "Gloo", advantage: -4.3 },
    { name: "Silvanna", advantage: -2.7 },
    { name: "Lolita", advantage: -2.6 },
  ];
  const strong = [
    { name: "Marcel", advantage: 3.2 },
    { name: "Cici", advantage: 3.3 },
    { name: "Claude", advantage: 2.8 },
  ];

  it("names three counters and two victims, the first of each with its gap", () => {
    const sentence = summarySentence("fr", t, { name: "Aamon", rank: "mythic", weak, strong });
    expect(sentence).toMatch(
      /^En Mythique, Aamon souffre le plus face à Gloo \([-−]4,3 pts\), Hayabusa et Silvanna, et prend l'avantage sur Cici \(\+3,3 pts\) et Marcel\.$/,
    );
  });

  it("says 'all ranks combined' and omits missing victims", () => {
    expect(summarySentence("fr", t, { name: "Aamon", rank: "all", weak: weak.slice(1, 2), strong: [] })).toMatch(
      /^Tous rangs confondus, Aamon souffre le plus face à Gloo \([-−]4,3 pts\)\.$/,
    );
    expect(summarySentence("fr", t, { name: "Aamon", rank: "all", weak: [], strong })).toBe(
      "Pas encore de counter mesuré pour Aamon.",
    );
  });

  it("formats the signed gap in the locale", () => {
    expect(formatGap("en", t, 3.25)).toBe("+3.3 pts");
    expect(formatGap("fr", t, 2)).toBe("+2,0 pts");
    expect(formatGap("fr", t, 0)).toBe("0,0 pts");
  });
});

describe("items against a hero", () => {
  const profile = (p: Partial<ProfileThreat>): ProfileThreat => ({
    typeDamage: null,
    roles: [],
    specialties: [],
    lifesteal: false,
    ...p,
  });
  const all = () => true;

  it("counters magic damage with magic defense, physical damage with physical defense", () => {
    expect(itemsCounter(profile({ typeDamage: "Magic" }), all).map((o) => o.slug)).toEqual([
      "athena-s-shield",
      "radiant-armor",
      "tough-boots",
    ]);
    // The wiki's typo counts as physical.
    expect(reasonsCounter(profile({ typeDamage: "Phyiscal" }))).toEqual(["physical"]);
    expect(reasonsCounter(profile({ typeDamage: "Mixed" }))).toEqual(["magic", "physical"]);
  });

  it("adds role and specialty rules without listing an item twice", () => {
    const tips = itemsCounter(
      profile({ typeDamage: "Magic", roles: ["Marksman"], specialties: ["Regen", "Crowd Control"] }),
      all,
    );
    expect(tips.filter((c) => c.slug === "tough-boots")).toEqual([{ slug: "tough-boots", reason: "magic" }]);
    expect(new Set(tips.map((c) => c.reason))).toEqual(new Set(["magic", "attacks", "healing"]));
  });

  it("detects lifesteal in the played build's bonuses and drops items missing from the catalog", () => {
    expect(hasLifesteal(["+60 Physical Attack, +10% Lifesteal", null])).toBe(true);
    expect(hasLifesteal(["+75 Magic Power, +10% Spell Vamp"])).toBe(true);
    expect(hasLifesteal(["+60 Physical Attack", null])).toBe(false);
    expect(
      itemsCounter(profile({ lifesteal: true }), (s) => s !== "sea-halberd").map((o) => o.slug),
    ).toEqual(["dominance-ice", "necklace-of-durance"]);
  });
});

describe("momentsMatch", () => {
  it("finds the weakest and strongest bucket", () => {
    const buckets = [
      { from: 10, to: 12, winRate: 53 },
      { from: 12, to: 14, winRate: 50 },
      { from: 14, to: null, winRate: 48 },
    ];
    const m = momentsMatch(buckets)!;
    expect(m.weak.from).toBe(14);
    expect(m.strong.from).toBe(10);
    expect(m.profile).toBe("early");
  });

  it("says nothing about a flat or too short curve", () => {
    expect(momentsMatch([{ from: 10, to: null, winRate: 50 }])).toBeNull();
    expect(momentsMatch([{ from: 10, to: 12, winRate: 50 }, { from: 12, to: null, winRate: 50 }])).toBeNull();
    expect(momentsMatch(undefined)).toBeNull();
  });
});

describe("countersByLane", () => {
  const lanes: Record<string, Lane[]> = { gloo: ["Roam", "Exp"], hayabusa: ["Jungle"], fredrinn: ["Jungle", "Roam"] };
  const counters = ["gloo", "hayabusa", "fredrinn"].map((slug, i) => ({ slug, ranks: 3 - i, average: -3 }));

  it("puts the hero's position first and files a counter under each of its positions", () => {
    const groups = countersByLane(counters, (s) => lanes[s] ?? [], ["Jungle"], 1);
    expect(groups.map((g) => [g.lane, g.counters.map((c) => c.slug)])).toEqual([
      ["Jungle", ["hayabusa"]],
      ["Exp", ["gloo"]],
      ["Roam", ["gloo"]],
    ]);
  });
});
