import { describe, expect, it } from "vitest";
import heroes from "@/data/game/heroes.json";
import data from "@/data/editorial/free-rotation.json";
import { freeRotation, STALE_DAYS, type FreeRotationData } from "@/lib/free-rotation";

const slugs = new Set((heroes as { slug: string }[]).map((h) => h.slug));
const known = (slug: string) => slugs.has(slug);
const at = (date: string) => Date.parse(`${date}T12:00:00Z`);
const rotation = (o: Partial<FreeRotationData>): FreeRotationData => ({
  weekStart: "2026-11-09",
  updated: "2026-11-09",
  source: null,
  heroes: ["miya", "balmond", "saber"],
  ...o,
});

describe("editorial free rotation file", () => {
  const file = data as FreeRotationData;

  it("names only heroes of the synced roster, once each", () => {
    const unknown = file.heroes.filter((slug) => !slugs.has(slug));
    expect(unknown, `unknown slugs: ${unknown.join(", ")}`).toEqual([]);
    expect(new Set(file.heroes).size).toBe(file.heroes.length);
  });

  it("dates a filled list with a Monday, and its edit on or after it", () => {
    if (file.heroes.length === 0) return;
    expect(file.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${file.weekStart}T00:00:00Z`).getUTCDay()).toBe(1);
    if (file.updated) expect(file.updated >= file.weekStart!).toBe(true);
    if (file.source) expect(file.source).toMatch(/^https:\/\//);
  });
});

describe("freeRotation", () => {
  it("shows a list during its week and a few days after", () => {
    expect(freeRotation(rotation({}), at("2026-11-12"), known)).toMatchObject({
      state: "current",
      heroes: ["miya", "balmond", "saber"],
    });
    expect(freeRotation(rotation({}), at("2026-11-18"), known).state).toBe("current");
  });

  it(`hides a list older than ${STALE_DAYS} days, or dated in the future`, () => {
    expect(freeRotation(rotation({}), at("2026-11-20"), known)).toEqual({
      state: "stale",
      weekStart: "2026-11-09",
      updated: "2026-11-09",
    });
    expect(freeRotation(rotation({ weekStart: "2026-12-07" }), at("2026-11-20"), known).state).toBe("stale");
  });

  it("treats a missing, malformed or empty list as empty", () => {
    expect(freeRotation(rotation({ heroes: [] }), at("2026-11-10"), known).state).toBe("empty");
    expect(freeRotation(rotation({ weekStart: null }), at("2026-11-10"), known).state).toBe("empty");
    expect(freeRotation(rotation({ weekStart: "9 Nov" }), at("2026-11-10"), known).state).toBe("empty");
    expect(freeRotation(rotation({ heroes: ["not-a-hero"] }), at("2026-11-10"), known).state).toBe("empty");
  });

  it("drops unknown and repeated slugs", () => {
    const r = freeRotation(rotation({ heroes: ["miya", "not-a-hero", "miya"] }), at("2026-11-10"), known);
    expect(r.state === "current" && r.heroes).toEqual(["miya"]);
  });
});
