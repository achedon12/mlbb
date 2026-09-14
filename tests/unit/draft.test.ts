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
    heroes("counter", { strongAgainst: ["opponent"], synergies: ["ally"], win: 55 }),
    heroes("struggling", { weakAgainst: ["opponent"], win: 45 }),
    heroes("neutral"),
    heroes("opponent", { lanes: ["Jungle"] }),
    heroes("ally", { lanes: ["Roam"] }),
  ];
  const result = suggest({ candidates, lane: "Gold", enemies: ["opponent"], allies: ["ally"] });

  it("ranks the hero that counters the opponent first", () => {
    expect(result[0].hero.slug).toBe("counter");
    expect(result.at(-1)?.hero.slug).toBe("struggling");
  });

  it("gives typed reasons, translated at display time", () => {
    expect(result[0].reasons).toEqual([
      { type: "counter", detail: "OPPONENT", favorable: true },
      { type: "synergy", detail: "ALLY", favorable: true },
      { type: "win", detail: "55.0", favorable: true },
    ]);
    expect(result.at(-1)?.reasons.map((r) => r.type)).toEqual(["countered", "win"]);
  });

  it("reads a relationship declared on one side only", () => {
    const [first] = suggest({
      candidates: [heroes("a"), heroes("b"), heroes("opponent", { lanes: ["Jungle"], weakAgainst: ["b"] })],
      lane: "Gold",
      enemies: ["opponent"],
      allies: [],
    });
    expect(first.hero.slug).toBe("b");
  });
});
