import { describe, expect, it } from "vitest";
import { suggest, type DraftHero } from "@/lib/draft";

const heroes = (slug: string, o: Partial<DraftHero> = {}): DraftHero => ({
  slug,
  name: slug.toUpperCase(),
  lanes: ["Gold"],
  roles: ["Marksman"],
  icon: null,
  win: 50,
  strongAgainst: [],
  weakAgainst: [],
  synergies: [],
  ...o,
});

describe("suggest", () => {
  const candidates = [
    heroes("counter", { strongAgainst: ["ennemi"], synergies: ["allie"], win: 55 }),
    heroes("subit", { weakAgainst: ["ennemi"], win: 45 }),
    heroes("neutre"),
    heroes("ennemi", { lanes: ["Jungle"] }),
    heroes("allie", { lanes: ["Roam"] }),
  ];
  const result = suggest({ candidates, lane: "Gold", enemies: ["ennemi"], allies: ["allie"] });

  it("ranks the hero that counters the opponent first", () => {
    expect(result[0].hero.slug).toBe("counter");
    expect(result.at(-1)?.hero.slug).toBe("subit");
  });

  it("gives typed reasons, translated at display time", () => {
    expect(result[0].reasons).toEqual([
      { type: "counter", detail: "ENNEMI", favorable: true },
      { type: "synergy", detail: "ALLIE", favorable: true },
      { type: "win", detail: "55.0", favorable: true },
    ]);
    expect(result.at(-1)?.reasons.map((r) => r.type)).toEqual(["countered", "win"]);
  });

  it("reads a relationship declared on one side only", () => {
    const [first] = suggest({
      candidates: [heroes("a"), heroes("b"), heroes("ennemi", { lanes: ["Jungle"], weakAgainst: ["b"] })],
      lane: "Gold",
      enemies: ["ennemi"],
      allies: [],
    });
    expect(first.hero.slug).toBe("b");
  });
});
