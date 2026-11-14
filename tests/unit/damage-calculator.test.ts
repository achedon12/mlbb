import { describe, expect, it } from "vitest";
import { EMPTY_BUILD, type BuildCode } from "@/lib/build-code";
import { prepareItem, simulate, totalDefense, type SimCatalog, type SimHero } from "@/lib/build-simulator";
import {
  attackerFrom,
  basicAttack,
  defenderFrom,
  hit,
  hitsToKill,
  isComplete,
  type AttackerStats,
  type DefenderStats,
} from "@/lib/damage-calculator";

/**
 * Damage calculator: the defense multiplier, the order in which penetration
 * applies, the -60 floor, hits to kill and effective HP. Figures are chosen to
 * be checked by head.
 */

const attacker = (a: Partial<AttackerStats> = {}): AttackerStats => ({
  physicalAttack: 200,
  critChance: 0,
  critDamage: 200,
  physicalPen: { flat: 0, percent: 0 },
  magicPen: { flat: 0, percent: 0 },
  ...a,
});

const defender = (d: Partial<DefenderStats> = {}): DefenderStats => ({
  hp: 3000,
  physicalDefense: 120,
  magicDefense: 60,
  ...d,
});

describe("defense multiplier", () => {
  it("lets half the damage through 120 defense", () => {
    const r = hit(400, "physical", attacker(), defender());
    expect(r.defense).toBe(120);
    expect(r.multiplier).toBe(0.5);
    expect(r.damage).toBe(200);
  });

  it("reads the defense of the hit's kind", () => {
    // 60 magic defense: 120 / 180.
    expect(hit(300, "magic", attacker(), defender()).damage).toBeCloseTo(200, 10);
  });

  it("ignores defense and penetration for true damage", () => {
    const r = hit(300, "true", attacker({ physicalPen: { flat: 50, percent: 50 } }), defender());
    expect(r.defense).toBeNull();
    expect(r.multiplier).toBe(1);
    expect(r.damage).toBe(300);
    expect(r.effectiveHp).toBe(3000);
  });

  it("deals nothing for a negative raw damage", () => {
    const r = hit(-50, "physical", attacker(), defender());
    expect(r.damage).toBe(0);
    expect(r.hitsToKill).toBeNull();
  });
});

describe("penetration", () => {
  it("applies the percentage before the flat value", () => {
    // 100 x (1 - 40%) - 20 = 40; the other order would give (100 - 20) x 60% = 48.
    expect(totalDefense(100, 40, 20)).toBe(40);
    const r = hit(160, "physical", attacker({ physicalPen: { flat: 20, percent: 40 } }), defender({ physicalDefense: 100 }));
    expect(r.defense).toBe(40);
    expect(r.damage).toBeCloseTo(120, 10);
  });

  it("uses the penetration of the hit's kind only", () => {
    const a = attacker({ physicalPen: { flat: 0, percent: 0 }, magicPen: { flat: 60, percent: 0 } });
    expect(hit(100, "physical", a, defender()).defense).toBe(120);
    expect(hit(100, "magic", a, defender()).defense).toBe(0);
  });

  it("goes below 0 defense down to -60, never further", () => {
    // 20 - 50 = -30: 120 / 90 of the damage.
    expect(hit(90, "physical", attacker({ physicalPen: { flat: 50, percent: 0 } }), defender({ physicalDefense: 20 })).damage).toBeCloseTo(120, 10);
    // 20 - 500 stops at -60: twice the damage.
    const r = hit(100, "physical", attacker({ physicalPen: { flat: 500, percent: 0 } }), defender({ physicalDefense: 20 }));
    expect(r.defense).toBe(-60);
    expect(r.damage).toBe(200);
  });

  it("keeps percentage penetration between 0 and 100%", () => {
    expect(hit(100, "physical", attacker({ physicalPen: { flat: 0, percent: 150 } }), defender()).defense).toBe(0);
    expect(hit(100, "physical", attacker({ physicalPen: { flat: 0, percent: -20 } }), defender()).defense).toBe(120);
  });
});

describe("hits to kill and effective HP", () => {
  it("rounds up to whole hits", () => {
    expect(hitsToKill(1000, 300)).toBe(4);
    expect(hitsToKill(1000, 1000)).toBe(1);
    expect(hitsToKill(1000, 5000)).toBe(1);
  });

  it("does not add a hit through floating point", () => {
    // 0.1 x 3 is 0.30000000000000004: 0.3 HP still dies in 3 hits of 0.1.
    expect(hitsToKill(0.3, 0.1)).toBe(3);
    expect(hitsToKill(1000, 100)).toBe(10);
  });

  it("has no answer for a hit that deals nothing", () => {
    expect(hitsToKill(1000, 0)).toBeNull();
    expect(hitsToKill(1000, Number.NaN)).toBeNull();
    expect(hitsToKill(0, 100)).toBe(0);
  });

  it("counts effective HP with the attacker's penetration", () => {
    expect(hit(100, "physical", attacker(), defender()).effectiveHp).toBe(6000);
    // 120 x 50% = 60 defense left: 3000 x 180 / 120.
    expect(hit(100, "physical", attacker({ physicalPen: { flat: 0, percent: 50 } }), defender()).effectiveHp).toBe(4500);
    // At -60, half the HP is enough.
    expect(hit(100, "magic", attacker({ magicPen: { flat: 200, percent: 0 } }), defender()).effectiveHp).toBe(1500);
  });

  it("agrees with the hit count: effective HP / raw damage", () => {
    const r = hit(700, "physical", attacker({ physicalPen: { flat: 15, percent: 30 } }), defender({ hp: 5321, physicalDefense: 87 }));
    expect(r.hitsToKill).toBe(Math.ceil(r.effectiveHp / 700));
  });
});

describe("basic attack", () => {
  it("hits for the total physical attack, without crit", () => {
    const r = basicAttack(attacker(), defender());
    expect(r.normal.damage).toBe(100);
    expect(r.normal.hitsToKill).toBe(30);
    expect(r.crit).toBeNull();
    expect(r.average).toBe(100);
  });

  it("adds the critical strike and its average", () => {
    const r = basicAttack(attacker({ critChance: 25, critDamage: 200 }), defender());
    expect(r.crit!.raw).toBe(400);
    expect(r.crit!.damage).toBe(200);
    expect(r.crit!.hitsToKill).toBe(15);
    // 75% x 100 + 25% x 200.
    expect(r.average).toBe(125);
  });

  it("caps the crit chance at 100%", () => {
    const r = basicAttack(attacker({ critChance: 140, critDamage: 250 }), defender());
    expect(r.average).toBe(r.crit!.damage);
  });
});

describe("stats from the build simulator", () => {
  const hero: SimHero = {
    slug: "test",
    name: "Test",
    damageType: "physical",
    resource: "mana",
    hp: [2000, 4800],
    mana: [400, 1800],
    physicalAttack: [100, 240],
    physicalDefense: [20, 90],
    magicDefense: [15, 50],
    hpRegen: 8,
    movementSpeed: 250,
  };
  const cat: SimCatalog = {
    heroes: new Map([["test", hero]]),
    items: new Map([
      [
        "gun",
        prepareItem({
          slug: "gun",
          name: "Gun",
          category: "Attack",
          price: 2000,
          bonus: "+35 Physical Attack, +20 Physical Penetration",
          unique: null,
          passive: "Armor Buster: Increase Physical Penetration by 30%.",
        }),
      ],
    ]),
    emblems: new Map(),
    talents: new Map(),
  };
  const build = (b: Partial<BuildCode>): BuildCode => ({ ...EMPTY_BUILD, hero: "test", talents: [null, null, null], ...b });

  it("reads the attacker's attack, crit and penetration", () => {
    const a = attackerFrom(simulate(build({ items: ["gun"] }), cat)!)!;
    expect(a.physicalAttack).toBe(275);
    expect(a.physicalPen).toEqual({ flat: 20, percent: 30 });
    expect(a.critDamage).toBe(200);
    expect(a.critChance).toBe(0);
  });

  it("reads the defender's HP and defenses at the chosen level", () => {
    expect(defenderFrom(simulate(build({ level: 1 }), cat)!)).toEqual({ hp: 2000, physicalDefense: 20, magicDefense: 15 });
  });

  it("has no figures for a hero whose stats our data lacks", () => {
    const bare: SimHero = { ...hero, slug: "bare", hp: null, physicalAttack: null };
    const r = simulate(build({ hero: "bare" }), { ...cat, heroes: new Map([["bare", bare]]) })!;
    expect(attackerFrom(r)).toBeNull();
    expect(defenderFrom(r)).toBeNull();
    expect(isComplete(bare)).toBe(false);
    expect(isComplete(hero)).toBe(true);
  });
});
