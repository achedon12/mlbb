import { describe, expect, it } from "vitest";
import { ajustementsHeros, bilan } from "../../scripts/patch-parser.mjs";

const FORMAT_RECENT = `
==II. Hero Adjustments==
:{{hi|Saber}} {{pci|buff}}
:{{ai|Charge|Skill 2}} {{pci|buff}}
*Mana Cost: 70-45 → 40-60
:{{hi|Ruby}} {{pci|nerf}}
== III. Battlefield Adjustments ==
`;

const FORMAT_TABLEAU = `
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

describe("ajustementsHeros — format recent (listes, fleche →)", () => {
  const heros = ajustementsHeros(FORMAT_RECENT);

  it("extrait les deux heros avec leur type", () => {
    expect(heros.map((h) => [h.name, h.type])).toEqual([
      ["Saber", "amelioration"],
      ["Ruby", "affaiblissement"],
    ]);
  });

  it("coupe le changement en avant / apres", () => {
    const change = heros[0].sections[0].changes[0];
    expect(change).toMatchObject({ label: "Mana Cost", before: "70-45", after: "40-60" });
  });
});

describe("ajustementsHeros — ancien format (tableau, separateur >>)", () => {
  const heros = ajustementsHeros(FORMAT_TABLEAU);

  it("lit le heros malgre le balisage de tableau", () => {
    expect(heros).toHaveLength(1);
    expect(heros[0]).toMatchObject({ name: "Silvanna", type: "amelioration" });
  });

  it("normalise le separateur >> en avant / apres", () => {
    const change = heros[0].sections.at(-1).changes[0];
    expect(change).toMatchObject({ before: "95-145", after: "70-110" });
  });
});

describe("bilan", () => {
  it("compte les types d'ajustement", () => {
    expect(bilan(ajustementsHeros(FORMAT_RECENT))).toEqual({
      amelioration: 1,
      affaiblissement: 1,
      ajustement: 0,
    });
  });
});

describe("ajustementsHeros — absence de section", () => {
  it("rend une liste vide quand il n'y a pas d'ajustements de heros", () => {
    expect(ajustementsHeros("== Battlefield Adjustments ==\ndu texte")).toEqual([]);
  });
});
