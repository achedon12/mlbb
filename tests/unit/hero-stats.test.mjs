import { describe, expect, it } from "vitest";
import { mergeHeroStats, patchAttributes } from "../../scripts/hero-stats.mjs";
import { heroStatsFromInfobox, infoboxFields, itemFromInfobox, liquipediaInfoboxes } from "../../scripts/liquipedia-game.mjs";

/** Saber in Module:Hero/data, before patch 2.1.88. */
const fandomSaber = {
  hp1: "2440", hp15: "4960", hp_regen1: "7", mana1: "500", mana15: "1900",
  physical_atk1: "118", physical_atk15: "254", physical_def1: "20", physical_def15: "77",
  magic_def1: "15", magic_def15: "50", movement_spd: "260", basic_atk_range: "1.8",
};

const saberInfobox = `{{Heroes Tabs}}
{{Infobox hero
<!---Profile--->
|name=Saber
|caption=''"Kill! All! At! Once"''
|voice1=Roa Kenji|voice1flag=jp
<!---Base Stats--->
|hp=2500
|hpreg=7
|phyatk=118
|phydef=20
|atkspeed=1.08
|mana=500
|magdef=15
|movespeed=260
}}
==Abilities==`;

const patch2188 = {
  "2.1.88": {
    adjustments: [
      { name: "Saber", slug: "saber", sections: [] },
      {
        name: "Saber",
        slug: "saber",
        sections: [
          {
            name: "Attributes",
            category: null,
            changes: [
              { label: "Base HP", before: "2440", after: "2500" },
              { label: "HP Growth", before: "180", after: "195" },
              { label: "Physical Defense Growth", before: "4.1", after: "4.5" },
            ],
          },
          // A skill section is not a base attribute.
          { name: "Orbiting Swords", category: "Skill 1", changes: [{ label: "Movement Speed", before: "10", after: "20" }] },
        ],
      },
    ],
  },
};

describe("Liquipedia infoboxes", () => {
  it("reads the level-1 attributes of {{Infobox hero}} under the site's field names", () => {
    expect(heroStatsFromInfobox(saberInfobox)).toEqual({
      hp1: "2500", hp_regen1: "7", mana1: "500", physical_atk1: "118",
      physical_def1: "20", magic_def1: "15", movement_spd: "260",
    });
  });

  it("does not split a field on the pipes of a nested template or link", () => {
    const f = infoboxFields("{{Infobox item\n|itemcost=1950\n|recipe=\n\t{{Recipe\n\t|item=X\n\t|bottomitem1=[[A|B]]\n\t}}\n|status=Removed\n}}", "Infobox item");
    expect(f.itemcost).toBe("1950");
    expect(f.status).toBe("Removed");
    expect(f.recipe).toContain("bottomitem1=[[A|B]]");
  });

  it("reads an item's price and status", () => {
    expect(itemFromInfobox("{{Infobox item\n|itemcost=2200\n|status=Available\n}}")).toEqual({ price: 2200, status: "available" });
    expect(itemFromInfobox("no infobox")).toBeNull();
  });

  it("reads only the pages whose revision changed since the cached run", async () => {
    const asked = [];
    const client = {
      revisions: async (titles) => new Map(titles.map((t) => [t, t === "Missing" ? null : { title: t, revid: t === "Saber" ? 2 : 1 }])),
      contents: async (titles) => {
        asked.push(...titles);
        return new Map(titles.map((t) => [t, { revid: 2, timestamp: "", text: saberInfobox }]));
      },
    };
    const cache = { version: 1, heroes: { Saber: { revid: 1, data: null }, Alucard: { revid: 1, data: { hp1: "1" } }, Gone: { revid: 1, data: null } } };
    const out = await liquipediaInfoboxes(client, ["Saber", "Alucard", "Missing"], cache, "heroes", heroStatsFromInfobox);
    expect(asked).toEqual(["Saber"]);
    expect(out.get("Saber").data.hp1).toBe("2500");
    expect(out.get("Alucard").data).toEqual({ hp1: "1" });
    expect(out.has("Missing")).toBe(false);
    expect(Object.keys(cache.heroes).sort()).toEqual(["Alucard", "Saber"]);
  });
});

describe("hero base stats merge", () => {
  it("reads the attribute changes of the patch notes, not those of skill sections", () => {
    expect(patchAttributes(patch2188)).toEqual({
      saber: {
        hp1: { value: 2500, version: "2.1.88" },
        hp_growth: { value: 195, version: "2.1.88" },
        physical_def_growth: { value: 4.5, version: "2.1.88" },
      },
    });
  });

  it("keeps the most recent patch's value", () => {
    const later = {
      ...patch2188,
      "2.2.16": { adjustments: [{ slug: "saber", sections: [{ name: "Attributes", changes: [{ label: "Base HP", after: "2550" }] }] }] },
    };
    expect(patchAttributes(later).saber.hp1).toEqual({ value: 2550, version: "2.2.16" });
  });

  it("takes level 1 from the patch note, then Liquipedia, then Fandom, and rebuilds level 15 from the growth", () => {
    const { stats, sources } = mergeHeroStats({
      fandom: fandomSaber,
      liquipedia: heroStatsFromInfobox(saberInfobox),
      patch: patchAttributes(patch2188).saber,
    });
    expect(stats.hp1).toBe("2500");
    expect(sources.hp1).toBe("patch 2.1.88");
    // 2500 + 14 × 195, the growth of the same note.
    expect(stats.hp15).toBe("5230");
    // 20 + 14 × 4.5.
    expect(stats.physical_def15).toBe("83");
    // Untouched by the patch: Fandom's own growth, (254 - 118) / 14.
    expect(stats.physical_atk15).toBe("254");
    expect(sources.physical_atk1).toBe("liquipedia");
    expect(stats.basic_atk_range).toBe("1.8");
    expect(Object.keys(stats)[0]).toBe("hp1");
  });

  it("uses Liquipedia over an outdated module, and reports a disagreement with the notes", () => {
    const merged = mergeHeroStats({
      fandom: { ...fandomSaber, hp1: "2440" },
      liquipedia: { hp1: "2600" },
      patch: { hp1: { value: 2500, version: "2.1.88" } },
    });
    expect(merged.stats.hp1).toBe("2500");
    expect(merged.conflicts).toEqual([{ field: "hp1", liquipedia: 2600, patch: 2500, version: "2.1.88" }]);
    expect(mergeHeroStats({ fandom: fandomSaber, liquipedia: { movement_spd: "250" } }).stats.movement_spd).toBe("250");
  });

  it("does not invent a level-15 value from a hole in the module (Zetian's physical attack, 0 and 0)", () => {
    const { stats } = mergeHeroStats({ fandom: { physical_atk1: "0", physical_atk15: "0" }, liquipedia: { physical_atk1: "95" } });
    expect(stats.physical_atk1).toBe("95");
    expect(stats.physical_atk15).toBeUndefined();
  });

  it("reads a value with its unit and a label stored inside the old value", () => {
    const notes = {
      "2.1.88": {
        adjustments: [
          // Marcel: "Base HP Regen: 12.4 per second → 22.4 per second".
          { slug: "marcel", sections: [{ name: "Attributes", changes: [{ label: "Base HP Regen", before: "12.4 per second", after: "22.4 per second" }] }] },
          // Hanzo, as earlier syncs stored "Base HP 2594 → 2440".
          { slug: "hanzo", sections: [{ name: "Attributes", changes: [{ label: null, before: "Base HP 2594", after: "2440" }, { label: null, before: "40%", after: "30%" }] }] },
          // A percentage is not a base value.
          { slug: "argus", sections: [{ name: "Attributes", changes: [{ label: "Extra Attack Speed Bonus", before: "100%", after: "80%" }] }] },
        ],
      },
    };
    const attributes = patchAttributes(notes);
    expect(attributes).toEqual({
      marcel: { hp_regen1: { value: 22.4, version: "2.1.88" } },
      hanzo: { hp1: { value: 2440, version: "2.1.88" } },
    });
    const marcel = mergeHeroStats({ fandom: { hp_regen1: "12.4" }, liquipedia: { hp_regen1: "12.4" }, patch: attributes.marcel });
    expect(marcel.stats.hp_regen1).toBe("22.4");
    expect(marcel.conflicts).toEqual([{ field: "hp_regen1", liquipedia: 12.4, patch: 22.4, version: "2.1.88" }]);
  });

  it("keeps the module's range sentence and has no stats when no source has any", () => {
    expect(mergeHeroStats({ fandom: { basic_atk_range: "1.8  / 2.6 (Flash Strike)" } }).stats).toEqual({ basic_atk_range: "1.8  / 2.6 (Flash Strike)" });
    expect(mergeHeroStats({}).stats).toBeNull();
  });
});
