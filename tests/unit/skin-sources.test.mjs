import { describe, expect, it } from "vitest";
import { mergeSkins, parseLiquipediaSkins } from "../../scripts/skin-sources.mjs";

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
