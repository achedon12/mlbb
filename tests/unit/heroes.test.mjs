import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { normalizeHeroes, officialLanes, slugify, withOfficialLanes } from "../../scripts/heroes.mjs";
import { analyzeTableLua } from "../../scripts/lua.mjs";

const fixture = (name) =>
  analyzeTableLua(readFileSync(new URL(`../fixtures/wiki/${name}`, import.meta.url), "utf8"));

/** Module:Hero/data as it reads normally. */
const healthy = () => fixture("hero-data.lua");
/** The same module while an edit had blanked Argus's entry (id kept, every field emptied). */
const blanked = () => fixture("hero-data-argus-blanked.lua");

const slugs = (heroes) => heroes.map((h) => h.slug);

describe("normalizeHeroes", () => {
  it("reads Argus from the module and leaves the template entry out", () => {
    const heroes = normalizeHeroes(healthy(), [], () => {});
    expect(slugs(heroes)).toEqual(["argus", "grock"]);
    expect(heroes[0]).toMatchObject({
      slug: "argus",
      name: "Argus",
      id: "451",
      roles: ["Fighter"],
      lanes: ["Exp"],
      stats: { hp1: "2600", movement_spd: "240" },
    });
  });

  it("keeps a released hero whose module entry was blanked, from the previous catalogue", () => {
    const previous = normalizeHeroes(healthy(), [], () => {});
    const warn = vi.fn();
    const heroes = normalizeHeroes(blanked(), previous, warn);

    expect(slugs(heroes)).toEqual(["argus", "grock"]);
    expect(heroes.find((h) => h.slug === "argus")).toEqual(previous.find((h) => h.slug === "argus"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("451"));
  });

  it("keeps a released hero whose entry disappeared from the module", () => {
    const previous = normalizeHeroes(healthy(), [], () => {});
    const raw = healthy();
    delete raw.Argus;
    const warn = vi.fn();

    expect(slugs(normalizeHeroes(raw, previous, warn))).toEqual(["argus", "grock"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Argus"));
  });

  it("warns when a blanked entry has no previous record to fall back on", () => {
    const warn = vi.fn();
    const heroes = normalizeHeroes(blanked(), [], warn);

    // Nothing to show for it: an entry without a name is not listed.
    expect(slugs(heroes)).toEqual(["grock"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("451"));
  });

  it("prefers the module over the previous catalogue as soon as the entry is filled in again", () => {
    const previous = normalizeHeroes(blanked(), [], () => {});
    const stale = previous.map((h) => ({ ...h, title: "Old title" }));
    const heroes = normalizeHeroes(healthy(), stale, () => {});

    expect(heroes.map((h) => h.title)).toEqual(["Dark Angel", "Fortress Titan"]);
  });

  it("does not keep a previous hero twice when the module renamed it", () => {
    const previous = normalizeHeroes(healthy(), [], () => {}).map((h) =>
      h.id === "441" ? { ...h, name: "Grok", slug: "grok" } : h,
    );
    const heroes = normalizeHeroes(healthy(), previous, () => {});

    expect(slugs(heroes)).toEqual(["argus", "grock"]);
  });
});

describe("slugify", () => {
  it("separates words on apostrophes and dots", () => {
    expect(slugify("Chang'e")).toBe("chang-e");
    expect(slugify("X.Borg")).toBe("x-borg");
    expect(slugify("Lapu-Lapu")).toBe("lapu-lapu");
  });
});

describe("official lanes", () => {
  const road = (id, title) => ({ data: { road_sort_id: id, road_sort_title: title } });

  it("reads the lanes of an official sheet in the game's order", () => {
    // Popol and Kupa's sheet, November 2026: Jungle first, then Gold Lane.
    expect(officialLanes({ roadsort: [road("4", "Jungle"), road("5", "Gold Lane")] })).toEqual(["Jungle", "Gold"]);
    expect(officialLanes({ roadsort: [road("1", "Exp Lane"), road("3", "")] })).toEqual(["Exp", "Roam"]);
    // A missing id falls back on the title; an empty slot is skipped.
    expect(officialLanes({ roadsort: [road(undefined, "Roaming"), ""] })).toEqual(["Roam"]);
    expect(officialLanes({ roadsort: [] })).toBeNull();
    expect(officialLanes(null)).toBeNull();
  });

  it("puts the official lanes over the wiki's, and keeps the wiki's when the sheet is missing", () => {
    const heroes = [
      { slug: "kimmy", name: "Kimmy", lanes: ["Gold", "Mid"] },
      { slug: "layla", name: "Layla", lanes: ["Gold"] },
      { slug: "sun", name: "Sun", lanes: ["Exp", "Jungle"] },
    ];
    const changed = withOfficialLanes(heroes, { kimmy: ["Mid", "Gold"], layla: ["Gold"], sun: [] });
    expect(heroes.map((h) => h.lanes)).toEqual([["Mid", "Gold"], ["Gold"], ["Exp", "Jungle"]]);
    expect(changed).toEqual([{ name: "Kimmy", wiki: ["Gold", "Mid"], official: ["Mid", "Gold"] }]);
    expect(withOfficialLanes(heroes, undefined)).toEqual([]);
  });
});
