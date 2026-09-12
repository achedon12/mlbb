import { describe, expect, it } from "vitest";
import type { SkinCatalogue } from "@/lib/catalogue-skins";
import { buildMonths, isMonth, monthOfRelease, monthStatus, neighbours, obtainMode, shiftMonth } from "@/lib/events";
import { attachHeroes, level2Section, nameKey, readGallery, sortEntries } from "../../scripts/events.mjs";

const skin = (o: Partial<SkinCatalogue>): SkinCatalogue => ({
  id: "1",
  nom: "Skin",
  heros: "miya",
  rarete: 3,
  serie: null,
  sortie: "2025-05-01",
  dispo: "Limited",
  prix: {},
  obtention: null,
  image: null,
  ancre: "skin-skin",
  ...o,
});

describe("obtainMode", () => {
  it("recognises StarLight by its label or by its obtain text", () => {
    expect(obtainMode(skin({ serie: "StarLight" }))).toBe("starlight");
    expect(obtainMode(skin({ obtention: "2025/05 StarLight Member" }))).toBe("starlight");
  });
  it("sorts Collector, passes, shop and events", () => {
    expect(obtainMode(skin({ serie: "Collector" }))).toBe("collector");
    expect(obtainMode(skin({ obtention: "M5 Pass" }))).toBe("pass");
    expect(obtainMode(skin({ obtention: "S36 First Recharge", prix: { dm: 50 } }))).toBe("pass");
    expect(obtainMode(skin({ serie: "S37" }))).toBe("pass");
    expect(obtainMode(skin({ prix: { dm: 899 } }))).toBe("shop");
    expect(obtainMode(skin({ serie: "Legend", prix: { mc: 200 } }))).toBe("event");
    expect(obtainMode(skin({ serie: "Naruto" }))).toBe("event");
  });
  it("does not mistake Annual StarLight for the StarLight of the month", () => {
    expect(obtainMode(skin({ serie: "Annual StarLight" }))).toBe("event");
  });
});

describe("months", () => {
  it("validates months and shifts them across years", () => {
    expect(isMonth("2026-09")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-9")).toBe(false);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-09", 0)).toBe("2026-09");
  });
  it("reads the month of a wiki date, not of a bare year", () => {
    expect(monthOfRelease("2025-05-01")).toBe("2025-05");
    expect(monthOfRelease("2025-05")).toBe("2025-05");
    expect(monthOfRelease("2025")).toBeNull();
    expect(monthOfRelease("202X")).toBeNull();
  });
  it("places a month relative to the data date", () => {
    expect(monthStatus("2026-09", "2026-09-11")).toBe("current");
    expect(monthStatus("2026-10", "2026-09-11")).toBe("announced");
    expect(monthStatus("2026-08", "2026-09-11")).toBe("past");
  });
  it("finds neighbouring months in a newest-first list", () => {
    const list = ["2026-08", "2026-07", "2026-05"];
    expect(neighbours(list, "2026-07")).toEqual({ previous: "2026-05", next: "2026-08" });
    expect(neighbours(list, "2026-08")).toEqual({ previous: "2026-07", next: null });
    expect(neighbours(list, "2020-01")).toEqual({ previous: null, next: null });
  });
});

describe("buildMonths", () => {
  const chic = skin({ id: "106011", nom: "Chic Glamour", heros: "hanabi", serie: "StarLight", sortie: "2025-01" });
  const gaara = skin({ id: "2", nom: "Gaara", heros: "vale", serie: "Naruto", sortie: "2025-05-02" });
  const epic = skin({ id: "3", nom: "Epic", heros: "vale", sortie: "2025-05-10", prix: { dm: 899 } });
  const old = skin({ id: "4", nom: "Old", sortie: "2022" });

  const months = buildMonths({
    released: [chic, gaara, epic, old],
    lists: [{ mode: "starlight", month: "2025-09", skin: chic }],
    noCollector: ["2025-09", "2025-06"],
  });

  it("puts a listed skin in the list's month, not the module's", () => {
    expect(months.map((m) => m.month)).toEqual(["2025-09", "2025-05"]);
    expect(months[0].starlight.map((s) => s.nom)).toEqual(["Chic Glamour"]);
  });
  it("groups other releases by mode and counts the total", () => {
    expect(months[1].others.event.map((s) => s.nom)).toEqual(["Gaara"]);
    expect(months[1].others.shop.map((s) => s.nom)).toEqual(["Epic"]);
    expect(months[1].total).toBe(2);
  });
  it("records a month without Collector without creating an empty month", () => {
    expect(months[0].noCollector).toBe(true);
    expect(months.some((m) => m.month === "2025-06")).toBe(false);
  });
});

describe("script: wiki monthly lists", () => {
  const text = [
    "== Rules ==",
    "Hero408-portrait.png|Karrie \"Neon Lightwheel\"<br>{{SL Gems|10}}",
    "==Starlight Member Skins==",
    "===2025===",
    "<gallery>",
    "File:Hero106011-portrait.png|'''Hanabi - Chic Glamour'''<br>September 2025",
    "Hero804-portrait.png|'''Guinevere - Lotus''' <br>September 2019",
    "Hero177-portrait.png|'''[[Fanny]] - Lightborn - Ranger'''<br> October 2019",
    "File:Hero000-portrait.png|'''No Collector Skin Released'''<br>May 2025",
    "</gallery>",
    "== Shop ==",
    "Hero215-portrait.png|'''Hayabusa - Experiment 21'''<br>2018",
  ].join("\n");

  it("isolates the level-2 section and its subsections", () => {
    const body = level2Section(text, "Starlight Member Skins");
    expect(body).toContain("Chic Glamour");
    expect(body).not.toContain("Experiment 21");
    expect(body).not.toContain("Neon Lightwheel");
    expect(level2Section(text, "Missing")).toBeNull();
  });

  it("reads hero, skin, id and month, and months without a release", () => {
    const entries = readGallery(level2Section(text, "Starlight Member Skins") ?? "");
    expect(entries).toEqual([
      { month: "2025-09", heroName: "Hanabi", skin: "Chic Glamour", id: "106011" },
      { month: "2019-09", heroName: "Guinevere", skin: "Lotus", id: "804" },
      { month: "2019-10", heroName: "Fanny", skin: "Lightborn - Ranger", id: "177" },
      { month: "2025-05", none: true },
    ]);
  });

  it("links heroes by name, ignoring case and punctuation, and sorts by month", () => {
    const heroes = [
      { slug: "yi-sun-shin", name: "Yi Sun-shin" },
      { slug: "hanabi", name: "Hanabi" },
    ];
    const linked = attachHeroes(
      [
        { month: "2025-09", heroName: "Hanabi", skin: "Chic Glamour", id: "106011" },
        { month: "2021-05", heroName: "Yi Sun-Shin", skin: "Azure Sentry", id: "306" },
        { month: "2021-06", heroName: "Unknown", skin: "X", id: null },
      ],
      heroes,
    );
    expect(linked.map((e: { hero?: string | null }) => e.hero)).toEqual(["hanabi", "yi-sun-shin", null]);
    expect(sortEntries(linked).map((e: { month: string }) => e.month)).toEqual(["2021-05", "2021-06", "2025-09"]);
    expect(nameKey("Chang'e")).toBe("change");
  });
});
