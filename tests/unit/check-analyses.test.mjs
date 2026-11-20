import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkAll, checkAnalysis } from "../../scripts/check-analyses.mjs";

const skills = JSON.parse(readFileSync("src/data/game/skills/en.json", "utf8"));
const kit = skills.lancelot;

/** A written Lancelot, as the site had him before the check. */
const lancelot = (over = {}) => ({
  slug: "lancelot",
  summary: "Assassin de jungle.",
  analysis: "Lancelot traverse un combat. Sa compétence 2 marque les cibles, sa compétence 1 se recharge en frappant une cible marquée.",
  skills: [
    { type: "Passive", name: "Soul Cutter", description: "Ses dégâts augmentent." },
    { type: "Skill 1", name: "Puncture", description: "Charge et marque le premier ennemi touché." },
    { type: "Skill 2", name: "Thorned Rose", description: "Projette une lame qui marque les ennemis touchés et les ralentit." },
    { type: "Ultimate", name: "Phantom Execution", description: "Frappe en restant invulnérable." },
  ],
  strengths: [],
  weaknesses: [],
  builds: [],
  ...over,
});

describe("Hero analyses against the official skills", () => {
  it("finds every written analysis in line with the kit", async () => {
    const findings = await checkAll();
    expect(findings.map((f) => `${f.slug} [${f.kind}] ${f.message}`)).toEqual([]);
  });

  it("reports an effect told on the wrong skill, in a skill and in the prose", () => {
    const findings = checkAnalysis(lancelot(), kit);
    expect(findings.map((f) => [f.kind, f.detail])).toEqual([
      ["effect", "Thorned Rose|mark"],
      ["effect", "Thorned Rose|mark"],
    ]);
    expect(findings[0].message).toMatch(/the kit gives it to Puncture/);
  });

  it("reports a skill out of its slot, one not in the kit, and figures the sheet does not give", () => {
    const [passive, s1, s2, ult] = lancelot().skills;
    const swapped = lancelot({
      analysis: "",
      skills: [passive, { ...s2, type: "Skill 1" }, { ...s1, type: "Skill 2", cooldown: [2.5] }, { ...ult, name: "Phantom Strike" }],
    });
    const kinds = checkAnalysis(swapped, kit).map((f) => `${f.kind} ${f.detail}`);
    expect(kinds).toContain("name Thorned Rose");
    expect(kinds).toContain("name Puncture");
    expect(kinds).toContain("figures Puncture|cooldown");
    expect(kinds).toContain("name Phantom Strike");
  });

  it("reports another hero's skill cited in an analysis, but not an item of the same name", () => {
    const others = new Map([["Ultimate Snipe", "lesley"], ["Malefic Gun", "layla"]]);
    const text = lancelot({ analysis: "Il craint Ultimate Snipe et Malefic Gun.", skills: lancelot().skills.slice(0, 2) });
    const findings = checkAnalysis(text, kit, others, new Set(["Malefic Gun"])).filter((f) => f.kind === "foreign");
    expect(findings.map((f) => f.detail)).toEqual(["Ultimate Snipe"]);
  });
});
