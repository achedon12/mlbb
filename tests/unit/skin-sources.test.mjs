import { describe, expect, it } from "vitest";
import {
  SKIN_CORRECTIONS,
  applyCorrections,
  checkSeason,
  fixTypos,
  liquipediaMonth,
  mergeSkins,
  parseLiquipediaSkins,
  reconcileIds,
} from "../../scripts/skin-sources.mjs";

const NOW = Date.UTC(2026, 10, 19, 12);

const skin = (id, name, extra = {}) => ({
  id,
  name,
  release: "2020-01-01",
  availability: "Available",
  rarity: "Elite",
  label: null,
  price: {},
  ...extra,
});

describe("parseLiquipediaSkins", () => {
  it("reads each {{Skin}} template of a hero gallery", () => {
    const text = `{{box|start}}<!--
-->{{Skin
|name         = Onmyouji Master
|type         = Default
|availability = In-Game Store
}}<!--
-->{{Skin
|name         = Feast of Eternity
|type         = Legend
|image        =
|availability = Limited-time Event
}}<!--
{{box|end}}`;
    expect(parseLiquipediaSkins(text)).toEqual([
      { name: "Onmyouji Master", type: "Default", availability: "In-Game Store" },
      { name: "Feast of Eternity", type: "Legend", availability: "Limited-time Event" },
    ]);
  });
});

describe("mergeSkins", () => {
  const heroes = [
    { slug: "kagura", id: "251" },
    { slug: "kalea", id: "1281" },
    { slug: "helcurt", id: "511" },
  ];
  const moduleSkins = {
    kagura: [skin("251", "Onmyouji Master"), skin("255", "Soryu Maiden")],
    kalea: [skin("1281", "Surging Wave")],
    helcurt: [skin("511", "Shadowbringer"), skin("517", "Cyber Infiltrator", { release: "202X", availability: "Upcoming" })],
  };
  const avatars = {
    // "Dragon Maiden" is the module's "Soryu Maiden" under the same id: not a new skin.
    kagura: [
      { id: "251", name: "Onmyouji Master" },
      { id: "255", name: "Dragon Maiden" },
      { id: "102512", name: "Feast of Eternity" },
      { id: "102513", name: "Leaked Skin" },
    ],
    kalea: [
      { id: "1281", name: "Surging Wave" },
      { id: "1284", name: "Tideborn Sailor" },
      { id: "1285", name: "December StarLight" },
    ],
  };
  const liquipedia = {
    kagura: [
      { name: "Onmyouji Master", type: "Default", availability: "In-Game Store" },
      { name: "Feast of Eternity", type: "Legend", availability: "Limited-time Event" },
    ],
  };
  const events = [
    { hero: "kalea", skin: "Tideborn Sailor", id: "1284", month: "2026-11", series: "StarLight" },
    { hero: "kalea", skin: "December StarLight", id: "1285", month: "2026-12", series: "StarLight" },
  ];

  const result = mergeSkins({ moduleSkins, avatars, liquipedia, events, heroes, now: NOW });
  const names = (slug) => result.skins[slug].map((s) => s.name);

  it("adds the skins of the hero pages confirmed by Liquipedia or dated by StarLight", () => {
    // In id order, as the module is: "102512" sorts before "251".
    expect(names("kagura")).toEqual(["Feast of Eternity", "Onmyouji Master", "Soryu Maiden"]);
    expect(names("kalea")).toEqual(["Surging Wave", "Tideborn Sailor"]);
    expect(result.skins.kalea[1]).toMatchObject({ id: "1284", release: "2026-11", label: "StarLight", released: true });
    expect(result.skins.kagura[0]).toMatchObject({ id: "102512", label: "Legend", availability: "Limited", released: true });
    expect(result.added.map((s) => s.name)).toEqual(["Feast of Eternity", "Tideborn Sailor"]);
  });

  it("leaves out what no source dates or confirms, and the months to come", () => {
    expect(names("helcurt")).toEqual(["Shadowbringer"]);
    expect(result.hidden.map((s) => s.name).sort()).toEqual(["Cyber Infiltrator", "December StarLight", "Leaked Skin"]);
  });

  it("without Liquipedia, falls back on the module's dates", () => {
    const alone = mergeSkins({ moduleSkins, avatars, events, heroes, now: NOW });
    expect(alone.skins.kagura.map((s) => s.name)).toEqual(["Onmyouji Master", "Soryu Maiden"]);
  });
});

describe("module checks", () => {
  it("fixes the module's known misspellings and leaves other values alone", () => {
    expect(fixTypos("Avaliable via the Bang Bang Card")).toBe("Available via the Bang Bang Card");
    expect(fixTypos("Annual Starlight")).toBe("Annual StarLight");
    expect(fixTypos("Obtain via the MLBB & HUNTER×HUNTER collab event")).toBe(
      "Obtained via the MLBB & HUNTER×HUNTER collab event",
    );
    expect(fixTypos("2025/11 StarLight Member")).toBe("2025/11 StarLight Member");
    expect(fixTypos(null)).toBeNull();
  });

  it("applies a correction only while the module holds the wrong value", () => {
    const azure = skin("1312", "Azure Cloud", { release: "2026-12-18" });
    expect(applyCorrections("sora", azure).skin.release).toBe("2025-12-18");
    const fixedOnWiki = skin("1312", "Azure Cloud", { release: "2025-12-19" });
    expect(applyCorrections("sora", fixedOnWiki)).toEqual({ skin: fixedOnWiki, applied: [] });
    expect(applyCorrections("miya", azure).applied).toEqual([]);
    for (const c of SKIN_CORRECTIONS) {
      expect(c).toMatchObject({ hero: expect.any(String), id: expect.any(String), field: expect.any(String) });
    }
  });

  it("gives back the gallery's id to a module skin listed under another skin's id (Obsidia)", () => {
    const fromModule = [
      skin("1301", "Sovereign of Dark's End"),
      skin("1302", "Undying Remnants"),
      skin("1303", "Imperatrix Arashi", { release: "2026-10-09", label: "The Aspirants" }),
    ];
    // Rows of the "Avatar icons" gallery of https://mobilelegends.fandom.com/wiki/Obsidia
    const gallery = [
      { id: "1301", name: "Sovereign of Dark's End" },
      { id: "1302", name: "Undying Remnants" },
      { id: "1303", name: "Magitech Wraith" },
      { id: "1304", name: "Imperatrix Arashi" },
    ];
    const { skins, changes } = reconcileIds(fromModule, gallery);
    expect(skins.map((s) => s.id)).toEqual(["1301", "1302", "1304"]);
    expect(changes).toEqual([{ name: "Imperatrix Arashi", from: "1303", to: "1304" }]);
    // A gallery that only spells the name differently changes nothing (Kagura's "Dragon Maiden").
    expect(reconcileIds([skin("255", "Soryu Maiden")], [{ id: "255", name: "Dragon Maiden" }]).changes).toEqual([]);
  });

  it("settles a season label against the acquisition text with Liquipedia", () => {
    const ironhide = skin("100210", "Ironhide Berserker", { label: "S39", price: { other: "Season 31" } });
    expect(checkSeason(ironhide, "Season 39").skin).toMatchObject({ label: "S39", price: { other: "Season 39" } });
    expect(checkSeason(ironhide, "Season 31").skin).toMatchObject({ label: "S31", price: { other: "Season 31" } });
    const alone = checkSeason(ironhide, null);
    expect(alone.skin.label).toBe("S39");
    expect(alone.skin.price).toEqual({});
    expect(alone.change).toContain("dropped");
    const agree = skin("x", "Y", { label: "S37", price: { other: "Season 37" } });
    expect(checkSeason(agree, null)).toEqual({ skin: agree, change: null });
  });

  it("reads the month of Liquipedia's StarLight availability", () => {
    expect(liquipediaMonth("2026/05 Starlight Member")).toBe("2026-05");
    expect(liquipediaMonth("Season 39")).toBeNull();
    expect(liquipediaMonth(null)).toBeNull();
  });
});

describe("mergeSkins: module checks", () => {
  const heroes = [
    { slug: "obsidia", id: "1301", release: "17 September 2025" },
    { slug: "sora", id: "1311", release: "18 December 2025" },
    { slug: "balmond", id: "021", release: "2016" },
    { slug: "fredrinn", id: "1171", release: "12 August 2022" },
    { slug: "mathilda", id: "1021", release: "12 December 2020" },
  ];
  const moduleSkins = {
    obsidia: [
      skin("1301", "Sovereign of Dark's End"),
      skin("1303", "Imperatrix Arashi", { release: "2026-10-09", availability: "Limited", label: "The Aspirants" }),
    ],
    sora: [
      skin("1311", "Shifting Cloud", { release: "2025-12-18" }),
      skin("1312", "Azure Cloud", { release: "2026-12-18", price: { dm: "269" } }),
    ],
    balmond: [
      skin("021", "Bloodthirst"),
      skin("100210", "Ironhide Berserker", {
        release: "2026-12-18",
        availability: "Limited",
        label: "S39",
        price: { other: "Season 31" },
      }),
    ],
    fredrinn: [
      skin("1176", "Royal Marshal", {
        release: "2025-11-01",
        availability: "Limited",
        label: "StarLight",
        price: { other: "2025/11 StarLight Member" },
      }),
    ],
    mathilda: [
      skin("1025", "Arcane Verdict", {
        release: "2026-09-19",
        label: "Special",
        price: { other: "Avaliable via the Bang Bang Card" },
      }),
    ],
  };
  const avatars = {
    obsidia: [
      { id: "1301", name: "Sovereign of Dark's End" },
      { id: "1303", name: "Magitech Wraith" },
      { id: "1304", name: "Imperatrix Arashi" },
    ],
  };
  const liquipedia = {
    sora: [{ name: "Azure Cloud", type: "Basic", availability: "In-Game Store" }],
    balmond: [{ name: "Ironhide Berserker", type: "Seasonal", availability: "Season 39" }],
    obsidia: [{ name: "Magitech Wraith", type: "Starlight", availability: "2026/05 Starlight Member" }],
  };
  // As readGallery reads https://mobilelegends.fandom.com/wiki/StarLight.
  const events = [
    { hero: "obsidia", heroName: "Obsidia", skin: "Magitech Wraith", id: "1303", month: "2026-05", series: "StarLight" },
    { hero: "fredrinn", heroName: "Fredrinn", skin: "Royal Marshal", id: "1176", month: "2025-12", series: "StarLight" },
  ];
  const result = mergeSkins({ moduleSkins, avatars, liquipedia, events, heroes, now: NOW });
  const find = (slug, name) => result.skins[slug].find((s) => s.name === name);

  it("lists Obsidia's 1303 as Magitech Wraith, and Imperatrix Arashi under 1304 with its own date", () => {
    expect(find("obsidia", "Magitech Wraith")).toMatchObject({ id: "1303", release: "2026-05", label: "StarLight" });
    expect(find("obsidia", "Imperatrix Arashi")).toMatchObject({ id: "1304", release: "2026-10-09" });
  });

  it("dates Sora's Azure Cloud on Sora's release, not a year later", () => {
    expect(find("sora", "Azure Cloud").release).toBe("2025-12-18");
    // The rule on dates to come gets there without the corrections table (another id).
    const other = { sora: [skin("1313", "Azure Cloud", { release: "2026-12-18" })] };
    const rule = mergeSkins({ moduleSkins: other, liquipedia, heroes, now: NOW });
    expect(rule.skins.sora[0]).toMatchObject({ release: "2025-12-18", released: true });
    expect(rule.fixes[0].fix).toContain("year typo");
  });

  it("gives Balmond's Ironhide Berserker no wrong date and one season", () => {
    expect(find("balmond", "Ironhide Berserker")).toMatchObject({
      release: null,
      label: "S39",
      price: { other: "Season 39" },
    });
  });

  it("moves Fredrinn's Royal Marshal to its StarLight month, acquisition text included", () => {
    expect(find("fredrinn", "Royal Marshal")).toMatchObject({
      release: "2025-12",
      price: { other: "2025/12 StarLight Member" },
    });
  });

  it("fixes the misspelling of Mathilda's Arcane Verdict", () => {
    expect(find("mathilda", "Arcane Verdict").price.other).toBe("Available via the Bang Bang Card");
  });

  it("reports each change for the sync's log", () => {
    const fixed = result.fixes.map((f) => `${f.hero}:${f.id}`);
    expect(fixed).toEqual(
      expect.arrayContaining(["obsidia:1304", "sora:1312", "balmond:100210", "fredrinn:1176", "mathilda:1025"]),
    );
  });
});
