import { describe, expect, it } from "vitest";
import { heroAdjustments, IMPLICIT_SUBSECTION } from "../../scripts/patch-parser.mjs";
import { patchesRebuild, sectionName } from "../../scripts/patch-translation.mjs";

// Changes listed under the hero line, before any skill heading: the parser
// opens the implicit subsection for them.
const WIKITEXT = `
==II. Hero Adjustments==
:{{hi|Saber}} {{pci|buff}}
*Base HP: 2440 → 2500
:{{ai|Orbiting Swords|Skill 1}} {{pci|adjust}}
*Orbiting Sword Damage: 75 → 80
== III. Battlefield Adjustments ==
`;

const patch = (adjustments) => ({
  "2.1.88": { version: "2.1.88", toc: [], sections: [], newHeroes: [], adjustments },
});

/** Translator that records what it is asked and tags what it returns. */
function recorder() {
  const asked = [];
  const t = (x) => {
    if (x) asked.push(x);
    return x ? `fr:${x}` : x;
  };
  return { asked, t };
}

describe("sectionName", () => {
  it("sends the implicit subsection under the parser's current label", () => {
    expect(sectionName({ name: IMPLICIT_SUBSECTION, category: null })).toBe("Attributes");
  });

  it("maps the label of an older parser back to the English source", () => {
    expect(sectionName({ name: "Attributs", category: null })).toBe("Attributes");
  });

  it("leaves other subsections untouched", () => {
    expect(sectionName({ name: "Orbiting Swords", category: "Skill 1" })).toBe("Orbiting Swords");
    expect(sectionName({ name: "Attributs", category: "Skill 1" })).toBe("Attributs");
    expect(sectionName({ name: "Passive", category: null })).toBe("Passive");
  });
});

describe("patchesRebuild — implicit subsection", () => {
  it("translates the implicit subsection the current parser writes", () => {
    const heroes = heroAdjustments(WIKITEXT);
    expect(heroes[0].sections.map((s) => [s.name, s.category])).toEqual([
      ["Attributes", null],
      ["Orbiting Swords", "Skill 1"],
    ]);
    const { asked, t } = recorder();
    const out = patchesRebuild(patch(heroes), t);
    const [implicit, skill] = out["2.1.88"].adjustments[0].sections;
    expect(implicit.name).toBe("fr:Attributes");
    expect(skill.name).toBe("Orbiting Swords");
    expect(asked).toContain("Attributes");
    expect(asked).not.toContain("Orbiting Swords");
  });

  it("translates a legacy French label from the English source term", () => {
    const { asked, t } = recorder();
    const out = patchesRebuild(
      patch([{ name: "Saber", intro: "", sections: [{ name: "Attributs", category: null, changes: [] }] }]),
      t,
    );
    expect(out["2.1.88"].adjustments[0].sections[0].name).toBe("fr:Attributes");
    expect(asked).not.toContain("Attributs");
  });
});
