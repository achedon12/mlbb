import { describe, expect, it } from "vitest";
import type { SkinCatalog } from "@/lib/skin-catalog";
import { buildMonths, isMonth, isProvisionalSkin, monthOfRelease, monthStatus, neighbours, obtainMode, shiftMonth } from "@/lib/events";
import {
  attachHeroes,
  currentMonthWarnings,
  level2Section,
  nameKey,
  readGallery,
  sortEntries,
} from "../../scripts/events.mjs";

const skin = (o: Partial<SkinCatalog>): SkinCatalog => ({
  id: "1",
  name: "Skin",
  hero: "miya",
  rarity: 3,
  series: null,
  release: "2025-05-01",
  availability: "Limited",
  price: {},
  acquisition: null,
  image: null,
  anchor: "skin-skin",
  ...o,
});

describe("obtainMode", () => {
  it("recognises StarLight by its label or by its obtain text", () => {
    expect(obtainMode(skin({ series: "StarLight" }))).toBe("starlight");
    expect(obtainMode(skin({ acquisition: "2025/05 StarLight Member" }))).toBe("starlight");
  });
  it("sorts Collector, passes, shop and events", () => {
    expect(obtainMode(skin({ series: "Collector" }))).toBe("collector");
    expect(obtainMode(skin({ acquisition: "M5 Pass" }))).toBe("pass");
    expect(obtainMode(skin({ acquisition: "S36 First Recharge", price: { dm: 50 } }))).toBe("pass");
    expect(obtainMode(skin({ series: "S37" }))).toBe("pass");
    expect(obtainMode(skin({ price: { dm: 899 } }))).toBe("shop");
    expect(obtainMode(skin({ series: "Legend", price: { mc: 200 } }))).toBe("event");
    expect(obtainMode(skin({ series: "Naruto" }))).toBe("event");
  });
  it("does not mistake Annual StarLight for the StarLight of the month", () => {
    expect(obtainMode(skin({ series: "Annual StarLight" }))).toBe("event");
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
  const fancy = skin({ id: "106011", name: "Chic Glamour", hero: "hanabi", series: "StarLight", release: "2025-01" });
  const gaara = skin({ id: "2", name: "Gaara", hero: "vale", series: "Naruto", release: "2025-05-02" });
  const epic = skin({ id: "3", name: "Epic", hero: "vale", release: "2025-05-10", price: { dm: 899 } });
  const old = skin({ id: "4", name: "Old", release: "2022" });

  const months = buildMonths({
    released: [fancy, gaara, epic, old],
    lists: [{ mode: "starlight", month: "2025-09", skin: fancy }],
    noCollector: ["2025-09", "2025-06"],
  });

  it("puts a listed skin in the list's month, not the module's", () => {
    expect(months.map((m) => m.month)).toEqual(["2025-09", "2025-05"]);
    expect(months[0].starlight.map((s) => s.name)).toEqual(["Chic Glamour"]);
  });
  it("groups other releases by mode and counts the total", () => {
    expect(months[1].others.event.map((s) => s.name)).toEqual(["Gaara"]);
    expect(months[1].others.shop.map((s) => s.name)).toEqual(["Epic"]);
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

  it("reads the month written without <br>, as the wiki does since February 2026", () => {
    const rows = [
      "<gallery>",
      "File:Hero104610-portrait.png|'''Odette - Song of Devotion'''    February 2026  ",
      "File:Hero101210-portrait.png|'''Bruno - The Purifier'''     November 2026",
      "</gallery>",
    ].join("\n");
    expect(readGallery(rows)).toEqual([
      { month: "2026-02", heroName: "Odette", skin: "Song of Devotion", id: "104610" },
      { month: "2026-11", heroName: "Bruno", skin: "The Purifier", id: "101210" },
    ]);
  });

  // Lines of https://mobilelegends.fandom.com/wiki/Collector_Skins, revision 193921
  // (2 November 2026): January 2026 still has the `<br>`, the next months do not.
  const collector2026 = [
    "==Collector Skins List==",
    "=== 2026 ===",
    "<gallery>",
    "File:Hero1156-portrait.png|'''Xavier - Sunborn Monarch'''<br>January 2026",
    "File:Hero104610-portrait.png|'''Odette - Song of Devotion'''    February 2026  ",
    "File:Hero104713-portrait.png|'''Lancelot - Blade of Devotion'''     February 2026  ",
    "File:Hero100610-portrait.png|'''Tigreal - Celestial General'''     March 2026  ",
    "File:Hero100211-portrait.jpg|'''Balmond - Vulcan Lionheart'''     August 2026  ",
    "File:Hero102710-portrait.png|'''Sun - Celestial Rebel'''     October 2026  ",
    "File:Hero101813-portrait.png|'''Layla - Prismatic Rhythm'''     October 2026  ",
    "File:Hero101210-portrait.png|'''Bruno - The Purifier'''     November 2026",
    "</gallery>",
  ].join("\n");

  it("reads every month of the 2026 Collector list, with and without <br>", () => {
    const entries = readGallery(level2Section(collector2026, "Collector Skins List") ?? "");
    expect(entries.map((e: { month: string }) => e.month)).toEqual([
      "2026-01",
      "2026-02",
      "2026-02",
      "2026-03",
      "2026-08",
      "2026-10",
      "2026-10",
      "2026-11",
    ]);
    expect(entries.at(-1)).toEqual({ month: "2026-11", heroName: "Bruno", skin: "The Purifier", id: "101210" });
    expect(entries[4]).toEqual({ month: "2026-08", heroName: "Balmond", skin: "Vulcan Lionheart", id: "100211" });
  });

  it("accepts the other separators the wiki has used, and abbreviated months", () => {
    const rows = [
      "File:Hero1156-portrait.png|'''Xavier - Sunborn Monarch'''<br/>January 2026",
      "File:Hero104610-portrait.png|'''Odette - Song of Devotion'''<br />Feb. 2026",
      "File:Hero100610-portrait.png|'''Tigreal – Celestial General'''&nbsp;March 2026",
      "File:Hero104410-portrait.png|'''Grock - Tremor of the Deep''' (April 2026)",
      "Hero048-portrait.png|Alice - Dreaming Monarch<br>May 2026",
      "File:Hero107110-portrait.png|'''Kimmy - Starbound Sentry''', Sept 2026",
    ].join("\n");
    expect(readGallery(rows)).toEqual([
      { month: "2026-01", heroName: "Xavier", skin: "Sunborn Monarch", id: "1156" },
      { month: "2026-02", heroName: "Odette", skin: "Song of Devotion", id: "104610" },
      { month: "2026-03", heroName: "Tigreal", skin: "Celestial General", id: "100610" },
      { month: "2026-04", heroName: "Grock", skin: "Tremor of the Deep", id: "104410" },
      { month: "2026-05", heroName: "Alice", skin: "Dreaming Monarch", id: "048" },
      { month: "2026-09", heroName: "Kimmy", skin: "Starbound Sentry", id: "107110" },
    ]);
  });

  it("does not take a caption word followed by a year for a month", () => {
    expect(readGallery("File:Hero1-portrait.png|Hero - Summer 2026")).toEqual([]);
    expect(readGallery("Hero215-portrait.png|'''Hayabusa - Experiment 21'''<br>2018")).toEqual([]);
  });

  it("warns when the current month has no StarLight or Collector entry", () => {
    const november = Date.UTC(2026, 10, 19);
    const lists = {
      starlight: [{ month: "2026-11", heroName: "Kalea", skin: "Tideborn Sailor", id: "1284" }],
      collector: [{ month: "2026-10", heroName: "Sun", skin: "Celestial Rebel", id: "102710" }],
    };
    const warnings = currentMonthWarnings(lists, november);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^::warning::Collector Skins: no skin read for 2026-11/);
    // "No Collector Skin Released" is an entry: the month is accounted for.
    expect(currentMonthWarnings({ collector: [{ month: "2026-11", none: true }] }, november)).toEqual([]);
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

describe("isProvisionalSkin", () => {
  it("holds a skin listed for a month to come as provisional", () => {
    expect(isProvisionalSkin({ month: "2026-12", reference: "2026-11-19" })).toBe(true);
    expect(isProvisionalSkin({ month: "2026-11", reference: "2026-11-19" })).toBe(false);
  });

  it("follows its lone artwork otherwise", () => {
    expect(isProvisionalSkin({ month: "2026-11", reference: "2026-11-19", lone: { provisional: true } })).toBe(true);
    expect(isProvisionalSkin({ month: "2021-01", reference: "2026-11-19", lone: { provisional: false } })).toBe(false);
  });
});
