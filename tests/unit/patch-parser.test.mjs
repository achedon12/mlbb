import { describe, expect, it } from "vitest";
import { heroAdjustments, splitChange, splitUnlabelled, summary } from "../../scripts/patch-parser.mjs";

const FORMAT_RECENT = `
==II. Hero Adjustments==
:{{hi|Saber}} {{pci|buff}}
:{{ai|Charge|Skill 2}} {{pci|buff}}
*Mana Cost: 70-45 → 40-60
:{{hi|Ruby}} {{pci|nerf}}
== III. Battlefield Adjustments ==
`;

const FORMAT_TABLE = `
==I. Hero Adjustments ==
{| class="article-table"
|-
!Hero
!Change
|-
|{{hi|Silvanna}} {{pci|buff}}
|Reduced the mana cost.
{{ai|Cometic Lance 2|Skill 1}} {{pci|buff}}
*Mana Cost: 95-145 >> 70-110
|-
|}
== II. Battlefield Adjustments ==
`;

describe("heroAdjustments — recent format (lists, → arrow)", () => {
  const heroes = heroAdjustments(FORMAT_RECENT);

  it("extracts both heroes with their type", () => {
    expect(heroes.map((h) => [h.name, h.type])).toEqual([
      ["Saber", "buff"],
      ["Ruby", "nerf"],
    ]);
  });

  it("splits the change into before / after", () => {
    const change = heroes[0].sections[0].changes[0];
    expect(change).toMatchObject({ label: "Mana Cost", before: "70-45", after: "40-60" });
  });
});

describe("heroAdjustments — old format (table, >> separator)", () => {
  const heroes = heroAdjustments(FORMAT_TABLE);

  it("reads the hero despite the table markup", () => {
    expect(heroes).toHaveLength(1);
    expect(heroes[0]).toMatchObject({ name: "Silvanna", type: "buff" });
  });

  it("normalizes the >> separator into before / after", () => {
    const change = heroes[0].sections.at(-1).changes[0];
    expect(change).toMatchObject({ before: "95-145", after: "70-110" });
  });
});

describe("change lines", () => {
  it("reads a label written without its colon (Hanzo, 2.1.88)", () => {
    const [hanzo] = heroAdjustments(`
==II. Hero Adjustments==
:{{hi|Hanzo}} {{pci|nerf}}
*Base HP 2594 → 2440
*Attack Speed Growth: 2% → 1%
== III. Battlefield Adjustments ==
`);
    expect(hanzo.sections[0].changes).toEqual([
      { label: "Base HP", before: "2594", after: "2440" },
      { label: "Attack Speed Growth", before: "2%", after: "1%" },
    ]);
  });

  it("splits only words followed by one value", () => {
    expect(splitUnlabelled("Base HP Regen 12.4 per second")).toEqual({ label: "Base HP Regen", before: "12.4 per second" });
    expect(splitUnlabelled("Cooldown 10s")).toEqual({ label: "Cooldown", before: "10s" });
    expect(splitUnlabelled("40%")).toEqual({ label: null, before: "40%" });
    expect(splitUnlabelled("Level 1 damage 200")).toEqual({ label: null, before: "Level 1 damage 200" });
    expect(splitChange("no arrow")).toBeNull();
  });
});

describe("summary", () => {
  it("counts adjustment types", () => {
    expect(summary(heroAdjustments(FORMAT_RECENT))).toEqual({
      buff: 1,
      nerf: 1,
      adjust: 0,
    });
  });
});

describe("heroAdjustments — missing section", () => {
  it("returns an empty list when there are no hero adjustments", () => {
    expect(heroAdjustments("== Battlefield Adjustments ==\ndu texte")).toEqual([]);
  });
});
