import { describe, expect, it } from "vitest";
import { LANGUES } from "@/i18n/config";
import {
  averageGuesses,
  classicGrid,
  COLUMNS,
  compare,
  drawRandom,
  drawSecrets,
  eligibleFrom,
  emojiRow,
  EPOCH,
  LAST_BUCKET,
  nextClue,
  puzzleNumber,
  recordWin,
  shareText,
  skillGrid,
  unlockedClues,
  WINDOW,
  type Candidate,
  type MlbbdleHero,
} from "@/lib/mlbbdle";
import { mlbbdleCandidates, mlbbdlePuzzle, mlbbdleRoster } from "@/lib/mlbbdle-data";
import { decalerJour, serieCourante, STATS_VIDES } from "@/lib/quiz";

const BASE: MlbbdleHero = {
  slug: "a",
  name: "A",
  icon: null,
  gender: "male",
  roles: ["Mage"],
  lanes: ["Milieu"],
  specialties: ["burst"],
  damage: "magic",
  range: "ranged",
  resource: "mana",
  region: "eruditio",
  year: 2020,
};
const hero = (o: Partial<MlbbdleHero>): MlbbdleHero => ({ ...BASE, ...o });
const squares = (row: string) => [...row].filter((c) => /[🟩🟧🟥⬛]/u.test(c)).length;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containsName = (text: string, name: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, "iu").test(text);

describe("classic-mode comparison", () => {
  it("is all green for the same hero", () => {
    const c = compare(BASE, BASE);
    for (const col of COLUMNS) expect(c[col].verdict).toBe("match");
    expect(c.year.direction).toBe("same");
  });

  it("tells exact, partial and no overlap apart on lists", () => {
    const target = hero({ roles: ["Mage", "Support"] });
    expect(compare(hero({ roles: ["Support", "Mage"] }), target).roles.verdict).toBe("match");
    expect(compare(hero({ roles: ["Mage"] }), target).roles.verdict).toBe("partial");
    expect(compare(hero({ roles: ["Mage", "Tank"] }), target).roles.verdict).toBe("partial");
    expect(compare(hero({ roles: ["Tank"] }), target).roles.verdict).toBe("miss");
  });

  it("treats mixed damage and hybrid range as partial matches", () => {
    expect(compare(hero({ damage: "mixed" }), hero({ damage: "physical" })).damage.verdict).toBe("partial");
    expect(compare(hero({ damage: "magic" }), hero({ damage: "mixed" })).damage.verdict).toBe("partial");
    expect(compare(hero({ damage: "magic" }), hero({ damage: "physical" })).damage.verdict).toBe("miss");
    expect(compare(hero({ range: "hybrid" }), hero({ range: "melee" })).range.verdict).toBe("partial");
    expect(compare(hero({ range: "ranged" }), hero({ range: "melee" })).range.verdict).toBe("miss");
    // A single value with no "wide" value never gives a partial match.
    expect(compare(hero({ region: "abyss" }), hero({ region: "eruditio" })).region.verdict).toBe("miss");
  });

  it("points the release year and flags missing values", () => {
    expect(compare(hero({ year: 2018 }), hero({ year: 2020 })).year).toEqual({ verdict: "miss", direction: "newer" });
    expect(compare(hero({ year: 2022 }), hero({ year: 2020 })).year).toEqual({ verdict: "miss", direction: "older" });
    expect(compare(hero({ year: null }), BASE).year).toEqual({ verdict: "unknown", direction: "unknown" });
    expect(compare(hero({ gender: null }), BASE).gender.verdict).toBe("unknown");
    expect(compare(hero({ specialties: [] }), BASE).specialties.verdict).toBe("unknown");
  });
});

describe("dates and draw", () => {
  it("makes a hero eligible a few days after release", () => {
    expect(eligibleFrom("26 October 2021")).toBe("2021-11-09");
    expect(eligibleFrom("January 2017")).toBe("2017-01-15");
    expect(eligibleFrom("2016")).toBe("2016-01-15");
    expect(eligibleFrom("TBA")).toBeNull();
    expect(eligibleFrom(null)).toBeNull();
    expect(eligibleFrom("Octember 2021")).toBeNull();
  });

  it("numbers days from the epoch", () => {
    expect(puzzleNumber(EPOCH)).toBe(1);
    expect(puzzleNumber(decalerJour(EPOCH, 30))).toBe(31);
  });

  const candidates = mlbbdleCandidates();
  const end = decalerJour(EPOCH, 400);
  const secrets = drawSecrets(candidates, end);

  it("draws one secret a day, never repeated within the window, never the same in both modes", () => {
    expect(secrets).toHaveLength(401);
    const since = new Map(candidates.map((c) => [c.slug, c.since]));
    const withSkill = new Set(candidates.filter((c) => c.hasSkill).map((c) => c.slug));
    secrets.forEach((s, i) => {
      expect(s.classic).not.toBeNull();
      expect(s.skill).not.toBeNull();
      expect(s.classic).not.toBe(s.skill);
      expect(since.get(s.classic!)! <= s.day).toBe(true);
      expect(withSkill.has(s.skill!)).toBe(true);
      const before = secrets.slice(Math.max(0, i - WINDOW), i);
      expect(before.map((x) => x.classic)).not.toContain(s.classic);
      expect(before.map((x) => x.skill)).not.toContain(s.skill);
    });
  });

  it("depends neither on roster order nor on a hero released later", () => {
    expect(drawSecrets([...candidates].reverse(), end)).toEqual(secrets);
    const newcomer: Candidate = { slug: "aaa-newcomer", since: decalerJour(EPOCH, 200), hasSkill: true };
    const withNewcomer = drawSecrets([...candidates, newcomer], end);
    expect(withNewcomer.slice(0, 200)).toEqual(secrets.slice(0, 200));
  });

  it("reuses a recent hero rather than going without a secret", () => {
    const few: Candidate[] = ["x", "y", "z"].map((slug) => ({ slug, since: "2016-01-01", hasSkill: true }));
    const s = drawSecrets(few, decalerJour(EPOCH, 9));
    expect(s.every((d) => d.classic && d.skill && d.classic !== d.skill)).toBe(true);
  });

  it("avoids the latest secrets in practice", () => {
    for (let i = 0; i < 50; i++) expect(drawRandom(["a", "b", "c"], ["a", "b"])).toBe("c");
    expect(drawRandom(["a"], ["a"])).toBe("a");
    expect(drawRandom([], [])).toBeNull();
  });
});

describe("daily puzzle", () => {
  const day = decalerJour(EPOCH, 12);

  it("sets the same answers in every language", () => {
    const fr = mlbbdlePuzzle("fr", day)!;
    expect(fr.number).toBe(13);
    for (const l of LANGUES) {
      const p = mlbbdlePuzzle(l, day)!;
      expect(p.classic).toBe(fr.classic);
      expect(p.skill?.answer).toBe(fr.skill?.answer);
      expect(p.skill?.icon).toBe(fr.skill?.icon);
    }
  });

  it("gives yesterday's answers, except on the first day", () => {
    const previous = mlbbdlePuzzle("en", decalerJour(day, -1))!;
    expect(mlbbdlePuzzle("en", day)!.yesterday).toEqual({
      classic: previous.classic,
      skill: previous.skill?.answer ?? null,
    });
    expect(mlbbdlePuzzle("en", EPOCH)!.yesterday).toBeNull();
  });

  it("masks the hero's name in the skill puzzle, in every language", () => {
    const names = new Map(mlbbdleRoster("en").heroes.map((x) => [x.slug, x.name]));
    const leaks: string[] = [];
    for (let i = 0; i < 45; i++) {
      for (const l of LANGUES) {
        const s = mlbbdlePuzzle(l, decalerJour(EPOCH, i))?.skill;
        if (!s) continue;
        const name = names.get(s.answer)!;
        for (const text of [s.name, s.excerpt ?? ""]) if (containsName(text, name)) leaks.push(`${l}/${s.answer}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("labels every roster value in every language", () => {
    for (const l of LANGUES) {
      const { heroes, labels } = mlbbdleRoster(l);
      expect(heroes.length).toBeGreaterThan(100);
      const missing = heroes
        .flatMap((x) => [
          ...(x.gender ? [`gender.${x.gender}`] : []),
          ...x.roles.map((r) => `roles.${r}`),
          ...x.lanes.map((v) => `lanes.${v}`),
          ...x.specialties.map((v) => `specialties.${v}`),
          ...(["damage", "range", "resource", "region"] as const).flatMap((c) => (x[c] ? [`${c}.${x[c]}`] : [])),
        ])
        .filter((key) => !labels[key] || labels[key].startsWith("pages."));
      expect(missing).toEqual([]);
    }
  });
});

describe("sharing and stats", () => {
  it("makes one row of squares per guess, green for the right answer", () => {
    const target = hero({ slug: "target" });
    expect(squares(emojiRow(hero({ roles: ["Tank"] }), target))).toBe(COLUMNS.length);
    expect(emojiRow(target, target)).toBe("🟩".repeat(COLUMNS.length));
  });

  it("summarises a long grid without losing the winning row", () => {
    const heroes = Array.from({ length: 12 }, (_, i) => hero({ slug: `h${i}`, year: 2010 + i }));
    const bySlug = new Map(heroes.map((x) => [x.slug, x]));
    const rows = classicGrid(heroes.map((x) => x.slug), heroes[11], bySlug, 8);
    expect(rows).toHaveLength(9);
    expect(rows[7]).toBe("⋯ +4");
    expect(rows.at(-1)).toBe("🟩".repeat(COLUMNS.length));
  });

  it("never puts a hero name in the shared text", () => {
    const { heroes } = mlbbdleRoster("fr");
    const bySlug = new Map(heroes.map((x) => [x.slug, x]));
    const guesses = heroes.slice(0, 5).map((x) => x.slug);
    const text = shareText({
      title: "MLBBdle #3",
      rows: [...classicGrid(guesses, heroes[4], bySlug), skillGrid(guesses, heroes[4].slug)],
      url: "https://mlbbdex.com/fr/mlbbdle",
    });
    for (const x of heroes.slice(0, 5)) expect(containsName(text, x.name)).toBe(false);
  });

  it("counts skill-mode misses", () => {
    expect(skillGrid(["a", "b", "c"], "c")).toBe("🟥🟥🟩");
    expect(skillGrid(["c"], "c")).toBe("🟩");
    const fifteen = Array.from({ length: 15 }, (_, i) => `x${i}`);
    expect(skillGrid([...fifteen, "c"], "c")).toBe("🟥×15🟩");
  });

  it("buckets wins by guesses and keeps the streak", () => {
    let s = recordWin(STATS_VIDES, EPOCH, 3);
    s = recordWin(s, EPOCH, 1);
    expect(s.joues).toBe(1);
    s = recordWin(s, decalerJour(EPOCH, 1), 25);
    expect(s.distribution[3]).toBe(1);
    expect(s.distribution[LAST_BUCKET]).toBe(1);
    expect(s.serie).toBe(2);
    expect(averageGuesses(s)).toBeCloseTo(6.5);
    expect(serieCourante(s, decalerJour(EPOCH, 3))).toBe(0);
  });

  it("unlocks skill clues in order", () => {
    expect(unlockedClues(1).size).toBe(0);
    expect([...unlockedClues(4)]).toEqual(["colour", "name"]);
    expect(nextClue(3)).toEqual({ key: "name", remaining: 1 });
    expect(nextClue(8)).toBeNull();
  });
});
