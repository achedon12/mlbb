import { describe, expect, it } from "vitest";
import {
  analyzePage,
  balance,
  buildIndex,
  compareVersions,
  infoboxSummary,
  isAdvancePage,
  newHeroFromTitle,
  pickPages,
  readPci,
  releaseDate,
  sectionCategory,
  translateVersion,
  versionFromTitle,
  versionTexts,
} from "../../scripts/advance-server.mjs";
import { isUnderTest, upcomingForHero } from "@/lib/advance-server";

const HEROES = buildIndex([
  { slug: "leomord", name: "Leomord" },
  { slug: "suyou", name: "Suyou" },
  { slug: "phoveus", name: "Phoveus" },
  { slug: "julian", name: "Julian" },
  { slug: "cici", name: "Cici" },
  { slug: "aurora", name: "Aurora" },
  { slug: "popol-and-kupa", name: "Popol and Kupa" },
]);
const ITEMS = buildIndex([{ slug: "windtalker", name: "Windtalker" }]);

const PAGE = `{{Infobox patch note
  | patch = 1.8.92
  | release_date=March 28, 2024 (server time)
  | what's_new= Leomord & Clint Buffs, Suyou Nerfs
  | previous=[[Patch Notes 1.8.90 (Advanced Server)|1.8.90]]
}}

==From the Designers==
We hope to increase {{Marksman|Marksmen}}'s damage. <br> Second paragraph.

==I. Hero Adjustments==
{| class="article-table"
|-
! scope="col" |Hero
! scope="col" |Change
|-
|{{hi|Leomord}} {{pci|buff}}
|{{ai|Phantom Charge|Enhanced Skill 2}} {{pci|buff}}
*Skill Damage: {{scale|base=300-500|total-pa=60}} >> {{scale|base=300-500|total-pa=80}}
|-
|{{hi|Suyou}} {{pci|nerf}}
|Too strong early.
{{ai|name=Transient Immortal|Passive}} {{pci|nerf}}
*CD of all skills: 6s >> 8s
|-
|Revamped {{hi|Phoveus}} {{pci|adjust}}
|Attributes {{pci|buff}}
*Max Mana: 1200 >> 1500
|}

==II. Battlefield & System Adjustments==
===Equipment Adjustments===
{| class="article-table"
|-
|{{ii|Windtalker}} {{pci|buff}}
|Added Attack attributes.
'''Attributes''' {{pci|buff}}
*Added: +20 Physical Attack
'''Unique Passive - Activate''' {{pci|removed}}
|}

===Emblem Adjustments===
{| class="article-table"
|-
|{{ai|Custom Marksman Emblem}} {{pci|buff}}
|Stronger early.
*5% Adaptive Attack >> 16 Adaptive Attack
|}

===Other Adjustments===
#Optimized the {{ai|Retribution}} for some heroes.
#Jungle protection: 15% >> 20%

==III. Events==
===New Events===
#New skin for {{hi|Zilong}}.
===Free Heroes===
:{{hi|Johnson}}, {{hi|Wanwan}}
`;

describe("finding Advance Server pages", () => {
  it("recognises both spellings of the test server", () => {
    expect(isAdvancePage("Patch Notes 1.8.92 (Advanced Server)")).toBe(true);
    expect(isAdvancePage("Patch Notes 1.3.08 (Advance Server)")).toBe(true);
    expect(isAdvancePage("Patch Notes 2.1.88")).toBe(false);
    expect(isAdvancePage("Advanced Server")).toBe(false);
  });

  it("reads three-part version numbers only", () => {
    expect(versionFromTitle("Patch Notes 1.8.92 (Advanced Server)")).toBe("1.8.92");
    expect(versionFromTitle("Patch Notes 1.5.0.2 (Advanced Server)")).toBeNull();
  });

  it("sorts versions numerically", () => {
    expect(compareVersions("1.8.100", "1.8.92")).toBeGreaterThan(0);
    expect(compareVersions("1.9.0", "1.8.92")).toBeGreaterThan(0);
    expect(compareVersions("1.8.92", "1.8.92")).toBe(0);
  });

  it("keeps one page per version, newest first, preferring the current spelling", () => {
    const pages = pickPages([
      { version: "1.3.06", title: "Patch Notes 1.3.06 Advance Server", length: 900 },
      { version: "1.3.06", title: "Patch Notes 1.3.06 (Advanced Server)", length: 800 },
      { version: "1.8.92", title: "Patch Notes 1.8.92 (Advanced Server)", length: 700 },
    ]);
    expect(pages.map((p) => p.title)).toEqual([
      "Patch Notes 1.8.92 (Advanced Server)",
      "Patch Notes 1.3.06 (Advanced Server)",
    ]);
  });
});

describe("releaseDate", () => {
  const date = (value) => releaseDate(`{{Infobox patch note\n | release_date=${value}\n}}`);

  it("reads the formats used by the wiki", () => {
    expect(date("7 February 2024")).toBe("2024-02-07");
    expect(date("March 28, 2024 (server time)")).toBe("2024-03-28");
    expect(date("April 1st, 2022, 19:00")).toBe("2022-04-01");
  });

  it("returns null rather than guessing", () => {
    expect(date("February ??th, 2022, 19:00")).toBeNull();
    expect(date("February 30, 2024")).toBeNull();
    expect(date("")).toBeNull();
  });
});

describe("readPci", () => {
  it("separates the direction from the tag", () => {
    expect(readPci("{{pci|nerf}}")).toEqual({ type: "nerf", tag: null });
    expect(readPci("{{pci|removed}}")).toEqual({ type: null, tag: "removed" });
    expect(readPci("{{pci|buff}} {{pci|new}}")).toEqual({ type: "buff", tag: "new" });
  });
});

describe("sectionCategory", () => {
  it("files each block under its category", () => {
    expect(sectionCategory(["Hero Adjustments", "Other Heroes"])).toBe("heroes");
    expect(sectionCategory(["Battlefield Adjustments", "Equipment"])).toBe("items");
    expect(sectionCategory(["Battlefield & System Adjustments", "Battlefield Adjustments", "Emblem Adjustments"])).toBe(
      "emblems",
    );
    expect(sectionCategory(["Balance & System Adjustments", "Spells"])).toBe("spells");
    expect(sectionCategory(["System Adjustments", "Layla's Workshop"])).toBe("system");
    expect(sectionCategory(["From the Designers"])).toBe("designers");
    expect(sectionCategory(["New & Revamped Heroes", "New Hero: Cici, the Buoyant Performer"])).toBe("newHeroes");
  });

  it("leaves out events, skins and free heroes", () => {
    expect(sectionCategory(["Weekly Free Heroes & New Skins", "Other"])).toBeNull();
    expect(sectionCategory(["Events", "New Events"])).toBeNull();
  });
});

describe("analyzePage", () => {
  const page = analyzePage(PAGE, { heroes: HEROES, items: ITEMS });

  it("reads the infobox summary and the designers' notes", () => {
    expect(infoboxSummary(PAGE)).toBe("Leomord & Clint Buffs, Suyou Nerfs");
    expect(page.summary).toBe("Leomord & Clint Buffs, Suyou Nerfs");
    expect(page.designerNotes).toEqual(["We hope to increase Marksmen's damage.", "Second paragraph."]);
  });

  it("extracts every changed hero with its direction and slug", () => {
    expect(page.heroes.map((h) => [h.name, h.slug, h.type])).toEqual([
      ["Leomord", "leomord", "buff"],
      ["Suyou", "suyou", "nerf"],
      ["Phoveus", "phoveus", "adjust"],
    ]);
    expect(page.balance).toEqual({ buff: 1, nerf: 1, adjust: 1 });
  });

  it("keeps skill groups and renders scaled values like the live notes", () => {
    const [group] = page.heroes[0].sections;
    expect(group).toMatchObject({ name: "Phantom Charge", slot: "Enhanced Skill 2", type: "buff", generic: false });
    expect(group.changes).toEqual([{ label: "Skill Damage", before: "300-500 +60 AD", after: "300-500 +80 AD" }]);
  });

  it("normalises the name= parameter and keeps the intro", () => {
    const suyou = page.heroes[1];
    expect(suyou.intro).toBe("Too strong early.");
    expect(suyou.sections[0]).toMatchObject({ name: "Transient Immortal", slot: "Passive" });
  });

  it("reads plain subtitles as generic headings", () => {
    expect(page.heroes[2].sections[0]).toMatchObject({ name: "Attributes", generic: true, type: "buff" });
  });

  it("lists item changes with their slug and tags", () => {
    const items = page.sections.find((s) => s.category === "items");
    expect(items.entries).toHaveLength(1);
    const [windtalker] = items.entries;
    expect(windtalker).toMatchObject({ name: "Windtalker", slug: "windtalker", type: "buff", intro: "Added Attack attributes." });
    expect(windtalker.sections.map((s) => [s.name, s.tag, s.changes.length])).toEqual([
      ["Attributes", null, 1],
      ["Unique Passive - Activate", "removed", 0],
    ]);
  });

  it("gives no heading to changes the source lists without one", () => {
    const emblems = page.sections.find((s) => s.category === "emblems");
    expect(emblems.entries[0].name).toBe("Custom Marksman Emblem");
    expect(emblems.entries[0].sections[0].name).toBeNull();
    expect(emblems.entries[0].sections[0].changes).toEqual([
      { label: null, before: "5% Adaptive Attack", after: "16 Adaptive Attack" },
    ]);
  });

  it("reads free lines as changes when they have an arrow", () => {
    const system = page.sections.find((s) => s.category === "system");
    expect(system.lines).toEqual([
      { text: "Optimized the Retribution for some heroes.", level: 1, type: null },
      { label: "Jungle protection", before: "15%", after: "20%", level: 1, type: null },
    ]);
  });

  it("ignores events and free heroes", () => {
    expect(JSON.stringify(page)).not.toMatch(/Zilong|Johnson/);
  });

  it("follows a hero over the merged rows of older tables", () => {
    const old = analyzePage(
      `==I. Hero Adjustments==
{| class="wikitable"
|-
| rowspan="2" |{{hi|Julian}} {{pci|nerf}}
|Damage reduced.
|-
|Attribute {{pci|nerf}}
*{{pci|nerf}} Base Attack Speed: 109.5% >> 99.5%
|}`,
      { heroes: HEROES },
    );
    expect(old.heroes).toHaveLength(1);
    expect(old.heroes[0]).toMatchObject({ name: "Julian", slug: "julian", type: "nerf", intro: "Damage reduced." });
    expect(old.heroes[0].sections[0].changes).toEqual([{ label: "Base Attack Speed", before: "109.5%", after: "99.5%" }]);
  });
});

describe("newHeroFromTitle", () => {
  it("finds the hero named by a new or revamped hero heading", () => {
    expect(newHeroFromTitle("New Hero: Cici, the Buoyant Performer", HEROES)).toMatchObject({ slug: "cici", kind: "new" });
    expect(newHeroFromTitle("Revamped Hero: Frost Oracle - Aurora", HEROES)).toMatchObject({ slug: "aurora", kind: "revamp" });
    expect(newHeroFromTitle("Revamped Heroes: Popol and Kupa return", HEROES).slug).toBe("popol-and-kupa");
    expect(newHeroFromTitle("New Hero: Someone Unknown", HEROES).slug).toBeNull();
  });
});

describe("balance", () => {
  it("counts a hero with no marker as an adjustment", () => {
    expect(balance([{ type: "buff" }, { type: null }, { type: "nerf" }, { type: "buff" }])).toEqual({
      buff: 2,
      nerf: 1,
      adjust: 1,
    });
  });
});

describe("translateVersion", () => {
  const page = analyzePage(PAGE, { heroes: HEROES, items: ITEMS });
  const version = { version: "1.8.92", title: "Patch Notes 1.8.92 (Advanced Server)", url: "u", date: null, dateSource: null, ...page };

  it("translates sentences and generic headings, not game names or values", () => {
    const upper = translateVersion(version, (x) => x.toUpperCase());
    expect(upper.heroes[1].intro).toBe("TOO STRONG EARLY.");
    expect(upper.heroes[1].name).toBe("Suyou");
    expect(upper.heroes[1].sections[0].name).toBe("Transient Immortal");
    expect(upper.heroes[2].sections[0].name).toBe("ATTRIBUTES");
    expect(upper.heroes[0].sections[0].changes[0]).toEqual({
      label: "SKILL DAMAGE",
      before: "300-500 +60 AD",
      after: "300-500 +80 AD",
    });
    expect(upper.sections[0].entries[0].name).toBe("Windtalker");
  });

  it("lists exactly the texts the translation needs", () => {
    const texts = versionTexts(version);
    expect(texts).toContain("Too strong early.");
    expect(texts).toContain("Optimized the Retribution for some heroes.");
    expect(texts).not.toContain("Transient Immortal");
    expect(texts).not.toContain("300-500 +60 AD");
  });
});

describe("versions under test", () => {
  const entry = (slug) => ({ name: slug, slug, type: "buff", tag: null, intro: "", sections: [] });
  const version = (v, heroes, newHeroes = []) => ({
    version: v,
    title: `Patch Notes ${v} (Advanced Server)`,
    url: `https://example.org/${v}`,
    date: null,
    dateSource: null,
    summary: null,
    designerNotes: [],
    newHeroes,
    heroes,
    sections: [],
    balance: { buff: heroes.length, nerf: 0, adjust: 0 },
  });

  it("only counts builds newer than the live patch", () => {
    expect(isUnderTest("2.1.90", "2.1.88")).toBe(true);
    expect(isUnderTest("2.1.88", "2.1.88")).toBe(false);
    expect(isUnderTest("1.8.92", "2.1.88")).toBe(false);
  });

  it("collects a hero's upcoming changes, newest first", () => {
    const versions = [
      version("2.1.92", [entry("aamon"), entry("layla")]),
      version("2.1.90", [], [{ title: "Revamped Hero: Aamon", slug: "aamon", kind: "revamp" }]),
      version("2.1.89", [entry("layla")]),
      version("1.8.92", [entry("aamon")]),
    ];
    const upcoming = upcomingForHero(versions, "aamon", "2.1.88");
    expect(upcoming.map((u) => [u.version, u.changes.length, u.announcements.length])).toEqual([
      ["2.1.92", 1, 0],
      ["2.1.90", 0, 1],
    ]);
    expect(upcomingForHero(versions, "aamon", "2.1.95")).toEqual([]);
  });
});
