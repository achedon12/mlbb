import { describe, expect, it } from "vitest";
import {
  assignLanes,
  alerts,
  analyzeTeam,
  curveTeam,
  writeSettings,
  readSettings,
  threats,
  profileDuration,
  profileNotes,
  breakdownDamage,
  synergiesInternal,
  type TeamHero,
  type MeasuresRank,
} from "@/lib/composition";
import { MEASURED_RANKS } from "@/lib/measured-ranks";

const heroes = (slug: string, o: Partial<TeamHero> = {}): TeamHero => ({
  slug,
  name: slug.toUpperCase(),
  lanes: ["Gold"],
  roles: ["Marksman"],
  icon: null,
  synergies: [],
  damage: "physical",
  notes: { offense: 5, durability: 5, abilityEffects: 5, difficulty: 5 },
  ...o,
});

const measures = (o: Partial<MeasuresRank> = {}): MeasuresRank => ({
  rank: "all",
  stats: {},
  buckets: [
    { from: 10, to: 12 },
    { from: 12, to: 14 },
    { from: 14, to: null },
  ],
  duration: {},
  teammates: {},
  weak: {},
  ...o,
});

/** A composition with no weakness: one lane each, varied damage and ratings. */
const balanced = [
  heroes("tank", { lanes: ["Roam"], roles: ["Tank"], notes: { offense: 3, durability: 9, abilityEffects: 8, difficulty: 4 } }),
  heroes("jungle", { lanes: ["Jungle"], roles: ["Assassin"], notes: { offense: 8, durability: 3, abilityEffects: 3, difficulty: 5 } }),
  heroes("mage", { lanes: ["Mid"], roles: ["Mage"], damage: "magic", notes: { offense: 8, durability: 2, abilityEffects: 7, difficulty: 5 } }),
  heroes("marksman", { lanes: ["Gold"], notes: { offense: 8, durability: 2, abilityEffects: 2, difficulty: 4 } }),
  heroes("fighter", { lanes: ["Exp"], roles: ["Fighter"], damage: "magic", notes: { offense: 6, durability: 7, abilityEffects: 5, difficulty: 5 } }),
];

describe("assignLanes", () => {
  it("moves a flexible hero to make room for another", () => {
    const a = assignLanes([heroes("b", { lanes: ["Gold", "Jungle"] }), heroes("a", { lanes: ["Gold"] })]);
    expect(a.lanes).toEqual({ Gold: "a", Jungle: "b" });
    expect(a.extra).toEqual([]);
    expect(a.missing).toEqual(["Mid", "Exp", "Roam"]);
  });

  it("keeps everyone on their main position when possible", () => {
    const a = assignLanes([heroes("c", { lanes: ["Jungle", "Roam"] }), heroes("d", { lanes: ["Roam", "Jungle"] })]);
    expect(a.lanes).toEqual({ Jungle: "c", Roam: "d" });
  });

  it("flags the hero left without a free lane", () => {
    const a = assignLanes([heroes("a"), heroes("b")]);
    expect(a.lanes).toEqual({ Gold: "a" });
    expect(a.extra).toEqual(["b"]);
  });
});

describe("team profile", () => {
  it("counts damage, a hybrid hero counting as half", () => {
    const d = breakdownDamage([
      heroes("a"),
      heroes("b"),
      heroes("c", { damage: "magic" }),
      heroes("d", { damage: "mixed" }),
      heroes("e", { damage: null }),
    ]);
    expect(d).toMatchObject({ physical: 2, magic: 1, mixed: 1 });
    expect(d.physicalShare).toBeCloseTo(0.625);
    expect(breakdownDamage([heroes("x", { damage: null })]).physicalShare).toBeNull();
  });

  it("averages ratings, ignoring missing ones", () => {
    expect(
      profileNotes([
        heroes("a", { notes: { offense: 6, durability: 4, abilityEffects: 3, difficulty: null } }),
        heroes("b", { notes: { offense: 8, durability: 5, abilityEffects: 4, difficulty: 6 } }),
      ]),
    ).toEqual({ offense: 7, durability: 4.5, abilityEffects: 3.5, difficulty: 6 });
  });
});

describe("match duration", () => {
  it("tells whether a curve rises, falls or stays flat", () => {
    expect(profileDuration([50, 50, 50, 52, 53])).toBe("late");
    expect(profileDuration([53, 52, 50, 50])).toBe("early");
    expect(profileDuration([50, 50.5, 50])).toBe("stable");
  });

  it("averages measured heroes, bucket by bucket", () => {
    const curve = curveTeam(
      ["a", "b", "c", "d"],
      // c is bucketed differently, d is not measured: both are left out.
      measures({ duration: { a: [49, 51, 54], b: [53, 51, 49], c: [50, 50] } }),
    );
    expect(curve?.win).toEqual([51, 51, 51.5]);
    expect(curve?.profile).toBe("stable");
    expect(curve?.pic).toBe(2);
    expect(curve?.byHero).toEqual([
      { slug: "a", profile: "late" },
      { slug: "b", profile: "early" },
    ]);
    expect(curveTeam(["d"], measures())).toBeNull();
  });
});

describe("synergies and threats", () => {
  it("reads both directions of a measure and keeps known synergies without figures", () => {
    const pairs = synergiesInternal(
      [heroes("a", { synergies: ["d"] }), heroes("b"), heroes("c"), heroes("d")],
      measures({
        teammates: {
          a: [["b", 1.2]],
          b: [
            ["a", 2.1],
            ["c", -0.5],
          ],
          c: [["d", 0.8]],
        },
      }),
    );
    expect(pairs).toEqual([
      { a: "a", b: "b", points: 2.1 },
      { a: "c", b: "d", points: 0.8 },
      { a: "a", b: "d", points: null },
    ]);
  });

  it("keeps only opponents that trouble several heroes of the team", () => {
    const list = threats(
      ["a", "b", "c"],
      measures({
        weak: {
          a: [
            ["x", -3],
            ["y", -2],
            ["c", -4],
          ],
          b: [
            ["x", -1.5],
            ["z", -2],
          ],
          c: [
            ["z", -1],
            ["w", 1],
          ],
        },
      }),
    );
    expect(list).toEqual([
      {
        slug: "x",
        targets: [
          ["a", -3],
          ["b", -1.5],
        ],
        total: -4.5,
      },
      {
        slug: "z",
        targets: [
          ["b", -2],
          ["c", -1],
        ],
        total: -3,
      },
    ]);
  });
});

describe("alerts", () => {
  it("flags duplicate lanes, missing tank, uniform damage and low ratings", () => {
    const team = ["a", "b", "c", "d", "e"].map((s) =>
      heroes(s, { notes: { offense: 8, durability: 3, abilityEffects: 2, difficulty: 7 } }),
    );
    const list = alerts(team, assignLanes(team));
    expect(list.map((a) => a.type)).toEqual(["lanes", "tank", "damage", "control", "fragile", "hard"]);
    expect(list[0]).toEqual({ type: "lanes", lanes: ["Jungle", "Mid", "Exp", "Roam"], extra: ["b", "c", "d", "e"] });
    expect(list[2]).toEqual({ type: "damage", dominant: "physical" });
  });

  it("says nothing about a balanced composition, nor about a team too small to judge", () => {
    expect(alerts(balanced, assignLanes(balanced))).toEqual([]);
    const duo = [heroes("a"), heroes("b", { lanes: ["Jungle"] })];
    expect(alerts(duo, assignLanes(duo))).toEqual([]);
  });
});

describe("analyzeTeam", () => {
  const catalog = [
    heroes("o"),
    heroes("j1", { lanes: ["Jungle"] }),
    heroes("j2", { lanes: ["Jungle"] }),
    heroes("j3", { lanes: ["Jungle"], synergies: ["o"] }),
  ];
  const rank = measures({
    stats: { o: [52, "A"], j1: [55, "S"], j2: [45, "C"], j3: [50, "B"] },
    teammates: { j2: [["o", 2]] },
  });

  it("suggests picks for free lanes only, tie-broken by the rank's win rate", () => {
    const analysis = analyzeTeam({ catalog, slugs: ["o"], measures: rank });
    expect(analysis.win).toBe(52);
    expect(analysis.suggestions.map((s) => s.lane)).toEqual(["Jungle", "Mid", "Exp", "Roam"]);
    const jungle = analysis.suggestions[0].picks;
    expect(jungle.map((p) => p.hero.slug)).toEqual(["j1", "j3", "j2"]);
    // A teammate measured at the rank counts as a synergy.
    expect(jungle[2].reasons.map((r) => r.type)).toContain("synergy");
  });

  it("ignores unknown heroes and suggests nothing for a full team", () => {
    const analysis = analyzeTeam({ catalog: balanced, slugs: [...balanced.map((h) => h.slug), "unknown-hero"], measures: null });
    expect(analysis.team).toHaveLength(5);
    expect(analysis.suggestions).toEqual([]);
    expect(analysis.assignment.missing).toEqual([]);
    // Without the rank's measures, whatever depends on them stays empty.
    expect(analysis.win).toBeNull();
    expect(analysis.curve).toBeNull();
    expect(analysis.threats).toEqual([]);
  });
});

describe("shareable URL", () => {
  const known = new Set(["a", "b", "c", "d", "e", "f"]);

  it("reads team and rank, dropping unknowns, duplicates and extras", () => {
    expect(readSettings("?h=a,zz,b,a,c,d,e,f&rang=mythic", known, MEASURED_RANKS)).toEqual({
      slugs: ["a", "b", "c", "d", "e"],
      rank: "mythic",
    });
    expect(readSettings("?rang=inexistant", known, MEASURED_RANKS)).toEqual({ slugs: [], rank: null });
  });

  it("writes a readable URL and keeps other parameters", () => {
    expect(writeSettings("?utm=1&h=old&rang=epic", ["a", "b"], "mythic")).toBe("h=a,b&utm=1&rang=mythic");
    expect(writeSettings("?h=a", [], "all")).toBe("");
  });
});
