import { describe, expect, it } from "vitest";
import { splitSuggestions, suggest, type DraftHero, type Suggestion } from "@/lib/draft";

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

describe("splitSuggestions", () => {
  const argued = (slug: string): Suggestion => ({
    hero: heroes(slug),
    score: 3,
    reasons: [{ type: "counter", detail: "OPPONENT", favorable: true }],
  });
  const silent = (slug: string): Suggestion => ({ hero: heroes(slug), score: 0, reasons: [] });

  it("shows the argued suggestions and keeps the rest one click away", () => {
    const { head, tail } = splitSuggestions([argued("a"), argued("b"), argued("c"), argued("d")]);
    expect(head.map((s) => s.hero.slug)).toEqual(["a", "b", "c"]);
    expect(tail.map((s) => s.hero.slug)).toEqual(["d"]);
  });

  it("never pads the head with a suggestion the line-up says nothing about", () => {
    const { head, tail } = splitSuggestions([argued("a"), silent("b"), silent("c"), silent("d")]);
    expect(head.map((s) => s.hero.slug)).toEqual(["a"]);
    expect(tail.map((s) => s.hero.slug)).toEqual(["b", "c", "d"]);
  });

  it("demotes the silent ones behind the argued ones that did not fit", () => {
    const { head, tail } = splitSuggestions([argued("a"), silent("b"), argued("c"), argued("d"), argued("e")]);
    expect(head.map((s) => s.hero.slug)).toEqual(["a", "c", "d"]);
    expect(tail.map((s) => s.hero.slug)).toEqual(["e", "b"]);
  });

  it("takes the size of the head as an argument", () => {
    expect(splitSuggestions([argued("a"), argued("b")], 1).head).toHaveLength(1);
    expect(splitSuggestions([], 3)).toEqual({ head: [], tail: [] });
  });

  it("marks a suggestion as argued as soon as it has one reason", () => {
    expect(argued("a").reasons.every((r) => r.type)).toBe(true);
    expect(splitSuggestions([silent("a")]).head).toEqual([]);
  });
});
