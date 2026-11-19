import { describe, expect, it } from "vitest";
import { cleanOfficialText, levelValues, matchOfficial, mergeSkills, officialSkills, officialTextDefective, parseCooldownCost } from "../../scripts/skills.mjs";
import { renderScale } from "../../scripts/scale.mjs";
import { cleanDescription } from "../../scripts/wikitext.mjs";

describe("{{scale}} rendering", () => {
  it("writes the numbers out the way the game does", () => {
    expect(renderScale("base=300-400|total-pa=50|pd")).toBe("300-400 (+50% Total Physical Attack) Physical Damage");
    expect(renderScale("base=80|extra-pa=100|level=8|td")).toBe("80 (+100% Extra Physical Attack) (+8*Hero Level) True Damage");
    expect(renderScale("base=25|total-hp=5|shield")).toBe("25 (+5% Max HP) Shield");
  });

  it("keeps the owner of a percentage and leaves unknown terms out", () => {
    expect(renderScale("base=25|total-mp=15|lost-hp=Aamon's 3|hp")).toBe("25 (+15% Total Magic Power) (+3% of Aamon's Lost HP) HP");
    expect(renderScale("total-pa=150|lifesteal=200")).toBe("(+150% Total Physical Attack)");
    expect(renderScale("cpd")).toBe("");
  });

  it("no longer drops the damage from a wiki description", () => {
    expect(cleanDescription("Fanny spins, dealing {{scale|base=275|total-pa=85|pd}} to nearby enemies.")).toBe(
      "Fanny spins, dealing 275 (+85% Total Physical Attack) Physical Damage to nearby enemies.",
    );
  });
});

const fannySheet = {
  heroskilllist: [
    {
      skilllist: [
        { skillid: 1740, skillname: "Air Superiority", "skillcd&cost": "", skilldesc: "While flying, Fanny deals 10%-20% extra damage." },
        {
          skillid: 1710,
          skillname: "Tornado Strike",
          "skillcd&cost": "CD: 3.5   Energy Cost: 12",
          skilldesc: 'Fanny whirls her blades, dealing 275<font color="fba51f"> (+85% Total Physical Attack)</font> <font color="fb1f1f">Physical Damage</font> to nearby enemies.',
        },
        { skillid: 1720, skillname: "Steel Cable", "skillcd&cost": "CD: 0   Energy Cost: 19", skilldesc: "Fanny shoots a cable." },
        { skillid: 1730, skillname: "Cut Throat", "skillcd&cost": "CD: 35   Energy Cost: 12", skilldesc: "Fanny leaps." },
      ],
    },
  ],
};

describe("official skill sheets", () => {
  it("reads cooldown and cost", () => {
    expect(parseCooldownCost("CD: 3.5   Energy Cost: 12")).toEqual({ cooldown: [3.5], cost: [12] });
    expect(parseCooldownCost("CD: 12")).toEqual({ cooldown: [12] });
    expect(parseCooldownCost("")).toEqual({});
    expect(levelValues("9.0 / 8.5 / 8.0")).toEqual([9, 8.5, 8]);
    expect(levelValues("Passive")).toBeNull();
  });

  it("cleans the official text and expands the attribute placeholders it can read", () => {
    const [, tornado] = officialSkills(fannySheet);
    expect(tornado).toMatchObject({ id: 1710, group: 0, name: "Tornado Strike", cooldown: [3.5], cost: [12] });
    expect(tornado.description).toBe("Fanny whirls her blades, dealing 275 (+85% Total Physical Attack) Physical Damage to nearby enemies.");
    expect(cleanOfficialText('dealing 250 (+ 8% target\'s <font color="26e407"><1005></font>)')).toBe("dealing 250 (+ 8% target's HP)");
    expect(officialTextDefective("recovering 80 (+ 8% of her <1998>)")).toBe(true);
    expect(officialTextDefective('dealing <font color="fba51f"> (+100% Total Physical Attack)</font>')).toBe(true);
    expect(officialTextDefective(fannySheet.heroskilllist[0].skilllist[1].skilldesc)).toBe(false);
  });
});

describe("skill merge", () => {
  const wikiFanny = [
    { name: "Air Superiority", description: "old" },
    { name: "Tornado Strike", description: "Fanny spins her blades, dealing damage.", cooldown: [3, 3], cost: [12] },
    { name: "Steel Cable", description: "old" },
    { name: "Cut Throat", description: "old" },
  ];

  it("prefers the official text, cooldown and cost", () => {
    const [passive, s1] = mergeSkills({ wiki: wikiFanny, official: officialSkills(fannySheet) });
    expect(passive).toEqual({ name: "Air Superiority", description: "While flying, Fanny deals 10%-20% extra damage." });
    expect(s1).toEqual({
      name: "Tornado Strike",
      description: "Fanny whirls her blades, dealing 275 (+85% Total Physical Attack) Physical Damage to nearby enemies.",
      cooldown: [3.5],
      cost: [12],
    });
  });

  it("takes a revamped kit's official names by position, without the old kit's figures", () => {
    const official = officialSkills({
      heroskilllist: [{ skilllist: ["Primal Pact", "Feral Swipe", "Claw Strike", "Savage Maul"].map((n, i) => ({ skillid: i, skillname: n, skilldesc: `${n} text`, "skillcd&cost": i ? "CD: 8" : "" })) }],
    });
    const wiki = [
      { name: "Wilderness Power", description: "old passive", cooldown: [5] },
      { name: "Feral Swipe", description: "old swipe" },
      { name: "Life Recovery", description: "old", cooldown: [20] },
      { name: "Savage Maul", description: "old maul" },
    ];
    const merged = mergeSkills({ wiki, official });
    expect(merged.map((c) => c.name)).toEqual(["Primal Pact", "Feral Swipe", "Claw Strike", "Savage Maul"]);
    expect(merged[0]).toEqual({ name: "Primal Pact", description: "Primal Pact text" });
    expect(merged[2]).toEqual({ name: "Claw Strike", description: "Claw Strike text", cooldown: [8] });
  });

  it("matches by name when the sheet has a fifth skill, and keeps the wiki where nothing matches", () => {
    const official = officialSkills({
      heroskilllist: [{ skilllist: ["Cursing Touch", "Dragon Tail", "Soul Grip", "Furious Dive", "Black Dragon Form"].map((n, i) => ({ skillid: i, skillname: n, skilldesc: `${n} official` })) }],
    });
    expect(matchOfficial([{ name: "Cursing Touch" }, { name: "Dragon Tail" }, { name: "Unknown" }, { name: "Black Dragon Form" }], official).map((s) => s?.name ?? null)).toEqual([
      "Cursing Touch", "Dragon Tail", null, "Black Dragon Form",
    ]);
    const merged = mergeSkills({ wiki: [{ name: "Cursing Touch" }, { name: "Dragon Tail" }, { name: "Unknown", description: "wiki" }, { name: "Black Dragon Form" }], official });
    expect(merged[2]).toEqual({ name: "Unknown", description: "wiki" });
    expect(merged[3].description).toBe("Black Dragon Form official");
  });

  it("falls back on the wiki's text when the official one is defective, and on the previous run last", () => {
    const official = officialSkills({ heroskilllist: [{ skilllist: [{ skillname: "Sea Ink", skilldesc: "recovering 5% of his <1998>" }] }] });
    expect(mergeSkills({ wiki: [{ name: "Sea Ink", description: "wiki text" }], official })[0].description).toBe("wiki text");
    expect(mergeSkills({ previous: [{ name: "A", description: "kept" }] })[0]).toEqual({ name: "A", description: "kept" });
    expect(mergeSkills({})).toEqual([]);
  });
});
