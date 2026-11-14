import { describe, expect, it } from "vitest";
import { compare, emojiRow, nextClue, skillGrid, unlockedClues } from "../src/games/mlbbdle.js";
import { answer, buildSteps, hash } from "../src/games/quiz.js";
import { nextResetDaily, nextResetWeekly, nextStarlight, wallServer } from "../src/games/server-time.js";
import { DayStore } from "../src/games/state.js";
import type { Daily, MlbbdleHero } from "../src/site/schemas.js";

const hero = (slug: string, over: Partial<MlbbdleHero> = {}): MlbbdleHero => ({
  slug, name: slug, icon: null, gender: "male", roles: ["Fighter"], lanes: ["Exp"], specialties: ["charge"],
  damage: "physical", range: "melee", resource: "mana", region: "moniyan", year: 2018, ...over,
});

describe("MLBBdle comparison (ported from the site)", () => {
  it("gives partial matches for overlaps and the wide values", () => {
    const cells = compare(hero("a", { roles: ["Fighter", "Tank"], damage: "mixed", year: 2016 }), hero("b"));
    expect(cells.roles.verdict).toBe("partial");
    expect(cells.damage.verdict).toBe("partial");
    expect(cells.year).toEqual({ verdict: "miss", direction: "newer" });
    expect(compare(hero("a", { gender: null }), hero("b")).gender.verdict).toBe("unknown");
    expect(emojiRow(hero("b"), hero("b"))).toBe("🟩".repeat(9));
  });

  it("unlocks skill clues after 4, 6 and 8 misses", () => {
    expect([...unlockedClues(3)]).toEqual([]);
    expect([...unlockedClues(6)]).toEqual(["name", "description"]);
    expect(nextClue(5)).toEqual({ key: "description", remaining: 1 });
    expect(nextClue(9)).toBeNull();
    expect(skillGrid(["x", "y", "a"], "a")).toBe("🟥🟥🟩");
  });
});

describe("quiz in Discord", () => {
  const daily = {
    day: "2026-11-14",
    number: 65,
    mlbbdle: { classic: "a", skill: null, roster: [], labels: {} },
    quiz: {
      numero: 65,
      manches: [
        { type: "skill", reponse: "layla", nom: "Malefic Gun", icone: "/x.webp", extrait: "▢▢▢ shoots" },
        { type: "item", reponse: "blade", bonus: "+60", prix: 2000, categorie: "Attack", recette: [], passif: null },
        { type: "duel", paires: [[{ slug: "chou", victoire: 51 }, { slug: "layla", victoire: 49 }], [{ slug: "a", victoire: 50 }, { slug: "b", victoire: 50 }]] },
        { type: "story", reponse: "ghost", extraits: ["…"] },
      ],
    },
    quizRoster: {
      heroes: ["layla", "chou", "a", "b", "c", "d", "e"].map((s) => ({ slug: s, nom: s.toUpperCase() })),
      items: ["blade", "wand", "boots", "shield"].map((s) => ({ slug: s, nom: s })),
    },
  } as unknown as Daily;

  it("builds four distinct choices with the answer, the same for every player", () => {
    const steps = buildSteps(daily);
    // skill, item, two duel pairs; the story round answers a hero not in the roster and is skipped.
    expect(steps.map((s) => s.kind)).toEqual(["guess", "guess", "duel", "duel"]);
    const first = steps[0]!;
    expect(first.choices).toHaveLength(4);
    expect(new Set(first.choices.map((c) => c.slug)).size).toBe(4);
    expect(first.choices.map((c) => c.slug)).toContain("layla");
    expect(steps[1]!.choices.every((c) => ["blade", "wand", "boots", "shield"].includes(c.slug))).toBe(true);
    expect(buildSteps(daily)).toEqual(steps);
  });

  it("scores like the site: one per round found, one per duel pair, ties to the first hero", () => {
    const steps = buildSteps(daily);
    expect(steps[2]!.answer).toBe("chou");
    expect(steps[3]!.answer).toBe("a");
    const progress = { step: 0, points: 0, finished: false };
    expect(answer(progress, steps, 0, "layla")).toBe(true);
    expect(answer(progress, steps, 0, "layla")).toBeNull(); // double click
    expect(answer(progress, steps, 1, "wand")).toBe(false);
    expect(answer(progress, steps, 2, "chou")).toBe(true);
    expect(answer(progress, steps, 3, "a")).toBe(true);
    expect(progress).toEqual({ step: 4, points: 3, finished: true });
    expect(answer(progress, steps, 3, "a")).toBeNull();
  });

  it("uses the site's FNV-1a hash", () => {
    expect(hash("")).toBe(0x811c9dc5);
    expect(hash("a")).toBe(0xe40c292c);
  });
});

describe("server time (UTC-8)", () => {
  const now = Date.UTC(2026, 10, 14, 9, 30); // Saturday 01:30 server time
  it("computes the next resets", () => {
    expect(wallServer(now).getUTCHours()).toBe(1);
    expect(new Date(nextResetDaily(now)).toISOString()).toBe("2026-11-15T08:00:00.000Z");
    expect(new Date(nextResetWeekly(now)).toISOString()).toBe("2026-11-16T08:00:00.000Z");
    expect(new Date(nextStarlight(now)).toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });
});

describe("day store", () => {
  it("forgets yesterday and caps its size", () => {
    const store = new DayStore<number>(2);
    store.set("2026-11-14", "a", 1);
    store.set("2026-11-14", "b", 2);
    store.set("2026-11-14", "c", 3);
    expect(store.size).toBe(2);
    expect(store.get("2026-11-14", "a")).toBeUndefined();
    expect(store.get("2026-11-15", "c")).toBeUndefined();
    expect(store.size).toBe(0);
  });
});
