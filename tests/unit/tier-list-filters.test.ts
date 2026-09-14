import { describe, expect, it } from "vitest";
import {
  pathFilter,
  pathRole,
  matches,
  filterRanking,
  FILTERS_LANE,
  FILTERS_ROLE,
  laneOfSlug,
  roleOfSlug,
  SLUGS_LANE,
  SLUGS_ROLE,
} from "@/lib/tier-list-filters";
import type { Lane, Role } from "@/lib/types";

const heroes = (slug: string, lanes: Lane[], roles: Role[]) => ({ hero: { slug, lanes, roles } });

describe("lane and role addresses", () => {
  it("round-trips between internal value and English address", () => {
    for (const [lane, slug] of Object.entries(SLUGS_LANE)) expect(laneOfSlug(slug)).toBe(lane);
    for (const [role, slug] of Object.entries(SLUGS_ROLE)) expect(roleOfSlug(slug)).toBe(role);
  });

  it("refuses an unknown address or the French internal value", () => {
    expect(laneOfSlug("Gold")).toBeNull();
    expect(laneOfSlug("milieu")).toBeNull();
    expect(roleOfSlug("tireur")).toBeNull();
  });

  it("gives distinct, lowercase addresses", () => {
    const paths = [...FILTERS_LANE, ...FILTERS_ROLE].map(pathFilter);
    expect(new Set(paths).size).toBe(11);
    expect(pathFilter({ type: "lane", value: "Gold" })).toBe("/tier-list/lane/gold");
    expect(pathFilter({ type: "role", value: "Marksman" })).toBe("/tier-list/role/marksman");
    expect(pathRole("Support")).toBe("/heroes/role/support");
    expect(paths.every((c) => c === c.toLowerCase())).toBe(true);
  });
});

describe("ranking filter", () => {
  const ranking = [
    heroes("a", ["Jungle"], ["Assassin"]),
    heroes("b", ["Roam", "Exp"], ["Tank", "Fighter"]),
    heroes("c", ["Jungle", "Exp"], ["Fighter"]),
  ];

  it("keeps a lane's heroes, in ranking order", () => {
    expect(filterRanking(ranking, { type: "lane", value: "Exp" }).map((e) => e.hero.slug)).toEqual([
      "b",
      "c",
    ]);
  });

  it("counts a secondary role", () => {
    expect(filterRanking(ranking, { type: "role", value: "Fighter" }).map((e) => e.hero.slug)).toEqual([
      "b",
      "c",
    ]);
  });

  it("lets everything through without a filter", () => {
    expect(filterRanking(ranking, null)).toHaveLength(3);
    expect(matches(ranking[0].hero, null)).toBe(true);
  });
});
