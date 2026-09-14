import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/config";
import {
  ABANDON,
  searchOptions,
  compareHeroes,
  cut,
  shiftDay,
  saveMatch,
  isValidDay,
  generateChallenge,
  generateRound,
  rowGrid,
  roundFinished,
  maskName,
  MASK,
  numberChallenge,
  ORDER_CHALLENGE,
  pointsRound,
  pointsMax,
  responsesDuel,
  currentStreak,
  STATS_EMPTY,
  textShare,
  type Challenge,
  type QuizHero,
  type Round,
  type PoolQuiz,
} from "@/lib/quiz";
import { challengeOfDay, poolQuiz } from "@/lib/quiz-data";

const responses = (d: Challenge) => d.manches.flatMap((m) => (m.type === "duel" ? m.paires.flat().map((x) => x.slug) : [m.reponse]));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const includesName = (text: string, name: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, "iu").test(text);

describe("daily challenge", () => {
  const fr = poolQuiz("fr");
  const day = "2026-09-11";

  it("gives the same challenge for the same date", () => {
    expect(generateChallenge(fr, day)).toEqual(generateChallenge(fr, day));
    expect(generateChallenge(poolQuiz("fr"), day)).toEqual(challengeOfDay("fr", day));
  });

  it("sets the same answers in every language", () => {
    const expected = responses(challengeOfDay("fr", day));
    for (const l of LOCALES) expect(responses(challengeOfDay(l, day))).toEqual(expected);
  });

  it("changes from one day to the next", () => {
    const days = Array.from({ length: 30 }, (_, i) => shiftDay(day, i));
    const series = new Set(days.map((j) => responses(generateChallenge(fr, j)).join(",")));
    expect(series.size).toBe(30);
  });

  it("holds one round of each type, in order, with no repeated hero", () => {
    for (let i = 0; i < 60; i++) {
      const d = generateChallenge(fr, shiftDay(day, i));
      expect(d.manches.map((m) => m.type)).toEqual(ORDER_CHALLENGE);
      const heroes = responses(d).filter((s) => fr.heros.some((h) => h.slug === s));
      expect(new Set(heroes).size).toBe(heroes.length);
      expect(pointsMax(d.manches)).toBe(7);
    }
  });

  it("does not change when the pool loses a hero that was not drawn", () => {
    const d = generateChallenge(fr, day);
    const drawn = new Set(responses(d));
    const absent = fr.heros.find((h) => !drawn.has(h.slug))!;
    const reduced: PoolQuiz = { ...fr, heros: fr.heros.filter((h) => h.slug !== absent.slug) };
    expect(responses(generateChallenge(reduced, day))).toEqual(responses(d));
  });

  it("numbers and validates days", () => {
    expect(numberChallenge("2026-09-11")).toBe(1);
    expect(numberChallenge("2026-10-25")).toBe(45);
    expect(numberChallenge("2027-09-11")).toBe(366);
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("2026-9-1")).toBe(false);
    expect(isValidDay("2028-02-29")).toBe(true);
  });
});

describe("round generation", () => {
  it("hides the hero's name in skills and stories, in every language", () => {
    const leaks: string[] = [];
    for (const l of LOCALES) {
      const pool = poolQuiz(l);
      for (const h of pool.heros) {
        const texts = [
          ...(pool.histoires[h.slug] ?? []),
          ...(pool.competences[h.slug] ?? []).flatMap((c) => [c.nom, c.extrait ?? ""]),
          ...(pool.skins[h.slug] ?? []).map((s) => s.nom),
        ];
        for (const text of texts) if (includesName(text, h.nom)) leaks.push(`${l}/${h.slug} : ${text.slice(0, 80)}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("draws valid practice rounds, whatever the randomness", () => {
    const pool = poolQuiz("en");
    const slugs = new Set(pool.heros.map((h) => h.slug));
    const items = new Set(pool.objets.map((o) => o.slug));
    for (let i = 0; i < 300; i++) {
      const type = ORDER_CHALLENGE[i % ORDER_CHALLENGE.length];
      const m = generateRound(pool, type, () => Math.random());
      expect(m?.type).toBe(type);
      if (!m) continue;
      if (m.type === "duel") {
        const [[a, b]] = m.paires;
        expect(Math.abs(a.victoire - b.victoire)).toBeGreaterThanOrEqual(0.5);
        expect(responsesDuel(m)[0]).toBe(a.victoire >= b.victoire ? a.slug : b.slug);
      } else if (m.type === "item") {
        expect(items.has(m.reponse)).toBe(true);
        expect(m.bonus).not.toBe("");
      } else {
        expect(slugs.has(m.reponse)).toBe(true);
      }
      if (m.type === "skin") {
        for (const f of m.foyer) expect(f).toBeGreaterThanOrEqual(0.25);
        expect(m.image).toMatch(/^\/visuels\//);
      }
    }
  });

  it("honours exclusions", () => {
    const pool = poolQuiz("fr");
    const excluded = new Set(pool.heros.slice(0, 120).map((h) => h.slug));
    for (let i = 0; i < 50; i++) {
      const m = generateRound(pool, "story", () => Math.random(), { excluded: new Set(excluded) });
      if (m && m.type === "story") expect(excluded.has(m.reponse)).toBe(false);
    }
  });
});

describe("texts", () => {
  it("hides the full name, its parts and elisions without touching common words", () => {
    expect(maskName("Popol and Kupa hunt; Kupa bites.", ["Popol and Kupa"])).toBe(`${MASK} hunt; ${MASK} bites.`);
    expect(maskName("l'arme d'Aamon, AAMON", ["Aamon"])).toBe(`l'arme d'${MASK}, ${MASK}`);
    expect(maskName("Sun rose over the sun.", ["Yi Sun-shin"])).toBe(`${MASK} rose over the sun.`);
    expect(maskName("X.Borg fires", ["X.Borg"])).toBe(`${MASK} fires`);
    expect(maskName("Lunoxia", ["Lunox"])).toBe("Lunoxia");
  });

  it("cuts at the end of a sentence when it falls far enough", () => {
    const text = "Une premiere phrase assez longue pour compter. Une seconde qui depasse largement la limite fixee.";
    expect(cut(text, 60)).toBe("Une premiere phrase assez longue pour compter.");
    expect(cut("mot ".repeat(40), 30).endsWith("…")).toBe(true);
    expect(cut("court", 30)).toBe("court");
  });
});

describe("answers, grid and statistics", () => {
  const skill: Round = { type: "skill", reponse: "aamon", nom: "x", icone: "/i.webp", extrait: null };
  const duel: Round = {
    type: "duel",
    paires: [
      [{ slug: "a", victoire: 51 }, { slug: "b", victoire: 49 }],
      [{ slug: "c", victoire: 48 }, { slug: "d", victoire: 50 }],
    ],
  };

  it("ends a guess that is found, exhausted or given up", () => {
    expect(roundFinished(skill, ["zilong"])).toBe(false);
    expect(roundFinished(skill, ["zilong", "aamon"])).toBe(true);
    expect(roundFinished(skill, ["zilong", ABANDON])).toBe(true);
    expect(roundFinished(skill, ["a", "b", "c", "d", "e"])).toBe(true);
    expect(pointsRound(duel, ["a", "c"])).toBe(1);
  });

  it("builds a grid that reveals nothing about the answers", () => {
    expect(rowGrid(skill, ["zilong", "aamon"])).toBe("✨ 🟥🟩⬛⬛⬛");
    expect(rowGrid(skill, ["zilong", ABANDON])).toBe("✨ 🟥🟥🟥🟥🟥");
    expect(rowGrid(skill, ["zilong"])).toBe("✨ 🟥⬛⬛⬛⬛");
    expect(rowGrid(duel, ["a", "c"])).toBe("⚖️ 🟩🟥");
    const text = textShare({ number: 3, points: 5, max: 7, series: 4, rows: ["✨ 🟩⬛⬛⬛⬛"], url: "https://x/fr/quiz" });
    expect(text).toBe("MLBBDex Quiz #3 · 5/7 🔥4\n✨ 🟩⬛⬛⬛⬛\nhttps://x/fr/quiz");
    expect(text).not.toMatch(/aamon|zilong/i);
  });

  it("counts the streak of played days without counting the same day twice", () => {
    let s = saveMatch(STATS_EMPTY, "2026-09-11", 5);
    s = saveMatch(s, "2026-09-12", 7);
    expect(s).toMatchObject({ joues: 2, serie: 2, meilleure: 2 });
    expect(saveMatch(s, "2026-09-12", 0)).toBe(s);
    expect(currentStreak(s, "2026-09-13")).toBe(2);
    expect(currentStreak(s, "2026-09-14")).toBe(0);
    s = saveMatch(s, "2026-09-15", 3);
    expect(s).toMatchObject({ joues: 3, serie: 1, meilleure: 2 });
    expect(s.distribution).toEqual([0, 0, 0, 1, 0, 1, 0, 1]);
  });

  it("compares a wrong guess with the answer", () => {
    const h = (o: Partial<QuizHero>): QuizHero => ({
      slug: "x", nom: "X", icone: null, roles: ["Mage"], lanes: ["Mid"], annee: 2020, region: "Abyss", ...o,
    });
    expect(compareHeroes(h({ roles: ["Mage", "Support"], annee: 2018 }), h({}))).toEqual({
      roles: "partial", lanes: "yes", year: "higher", region: "yes",
    });
    expect(compareHeroes(h({ lanes: ["Roam"], region: null }), h({ annee: 2016 }))).toMatchObject({
      lanes: "no", year: "lower", region: "no",
    });
  });

  it("suggests names starting with the input first, ignoring accents", () => {
    const options = ["Chang'e", "Chou", "Lunox", "Popol and Kupa", "Richou"].map((name) => ({ slug: name, name }));
    expect(searchOptions(options, "cho", new Set()).map((o) => o.name)).toEqual(["Chou", "Richou"]);
    expect(searchOptions(options, "KUPA", new Set()).map((o) => o.name)).toEqual(["Popol and Kupa"]);
    expect(searchOptions(options, "chang", new Set(["Chang'e"]))).toEqual([]);
    expect(searchOptions(options, "  ", new Set())).toEqual([]);
  });
});
