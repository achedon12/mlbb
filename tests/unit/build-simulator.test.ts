import { describe, expect, it } from "vitest";
import itemsJson from "@/data/jeu/objets.json";
import heroesJson from "@/data/jeu/heros.json";
import { EMBLEM_SETS, TALENT_FIGURES } from "@/data/emblem-attributes";
import { EMPTY_BUILD, decodeBuild, encodeBuild, validateBuild, type BuildCode, type CodeCatalog } from "@/lib/build-code";
import {
  closeCores,
  damageShare,
  effectiveHp,
  parseBonus,
  parsePassives,
  passiveEffect,
  prepareEmblem,
  prepareHero,
  prepareItem,
  prepareTalent,
  simulate,
  valueAtLevel,
  type MeasuredCore,
  type SimCatalog,
  type SimHero,
  type SimItem,
} from "@/lib/build-simulator";

/**
 * Build simulator: reading the wiki's attribute texts, computing stats
 * (unique attributes, same-name passives, adaptive attributes, caps) and the
 * build code in the URL. Heroes and items are hand-made so every expectation
 * can be checked by head; one test also sweeps the real catalog so no
 * attribute slips past the reader unnoticed.
 */

type RawItem = { slug: string; nom: string; categorie: string; prix: number | null; bonus: string | null; unique: string | null; passif: string | null };
type RawHero = Parameters<typeof prepareHero>[0];

const item = (o: Partial<RawItem> & { slug: string }): SimItem =>
  prepareItem({ nom: o.slug, categorie: "Attack", prix: 1000, bonus: null, unique: null, passif: null, ...o });

const hero = (h: Partial<SimHero> = {}): SimHero => ({
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
  ...h,
});

function catalog(items: SimItem[], h: SimHero = hero()): SimCatalog {
  return {
    heroes: new Map([[h.slug, h]]),
    items: new Map(items.map((o) => [o.slug, o])),
    emblems: new Map(EMBLEM_SETS.map((e) => [e.key, prepareEmblem(e.key, e.attributes)])),
    talents: new Map(TALENT_FIGURES.map((t) => [t.key, prepareTalent(t)])),
  };
}

const build = (b: Partial<BuildCode>): BuildCode => ({ ...EMPTY_BUILD, hero: "test", talents: [null, null, null], ...b });

describe("attribute reading", () => {
  it("reads flat and percentage attributes", () => {
    expect(parseBonus("+920 HP, +40 Physical Defense, +4 HP Regen").bonuses).toEqual([
      { attribute: "hp", value: 920, percent: false },
      { attribute: "physicalDefense", value: 40, percent: false },
      { attribute: "hpRegen", value: 4, percent: false },
    ]);
    expect(parseBonus("+40% Magic Penetration").bonuses).toEqual([{ attribute: "magicPenetration", value: 40, percent: true }]);
    expect(parseBonus("+10 Magic Penetration").bonuses).toEqual([{ attribute: "magicPenetration", value: 10, percent: false }]);
    expect(parseBonus("+5% Movement Speed, +40 Movement Speed").bonuses).toEqual([
      { attribute: "movementSpeed", value: 5, percent: true },
      { attribute: "movementSpeed", value: 40, percent: false },
    ]);
  });

  it("ignores the trailing comma and the Extra / Max prefixes", () => {
    expect(parseBonus("+30 Adaptive Attack,").bonuses).toEqual([{ attribute: "adaptiveAttack", value: 30, percent: false }]);
    expect(parseBonus("+300 Extra Max HP").bonuses).toEqual([{ attribute: "hp", value: 300, percent: false }]);
  });

  it("sets aside what it cannot count, without guessing", () => {
    expect(parseBonus("+55 Movement Speed, +35% Slow Reduction")).toEqual({
      bonuses: [{ attribute: "movementSpeed", value: 55, percent: false }],
      others: ["+35% Slow Reduction"],
    });
    // A flat attribute written as a percentage is not the same attribute.
    expect(parseBonus("+5% Adaptive Attack")).toEqual({ bonuses: [], others: ["+5% Adaptive Attack"] });
    expect(parseBonus("+15 Crit Chance").others).toEqual(["+15 Crit Chance"]);
    expect(parseBonus("None")).toEqual({ bonuses: [], others: [] });
    expect(parseBonus(null)).toEqual({ bonuses: [], others: [] });
  });

  it("recognises the whole real catalog, but for a short list of uncomputed attributes", () => {
    const uncomputed = new Set<string>();
    for (const o of itemsJson as RawItem[]) {
      for (const text of [o.bonus, o.unique]) {
        for (const other of parseBonus(text).others) uncomputed.add(other.replace(/^\+[\d.]+%?\s*/, ""));
      }
    }
    // Healing, slow reduction or crit damage taken: nothing to compute in a
    // stat sheet. "Magic Lifesteal" no longer exists since patch 1.7.94
    // (Magic lifesteal page): reading it as lifesteal would be a guess. The
    // percentage adaptive attack is Floryn's item.
    expect([...uncomputed].sort()).toEqual(
      ["Adaptive Attack", "Crit Damage Reduction", "Healing Effect", "Magic Lifesteal", "Slow Reduction"].sort(),
    );
  });

  it("splits passives and recognises only permanent quantified effects", () => {
    expect(parsePassives("Armor Buster: Increase Physical Penetration by 30%.@ Breaker: When attacking...")).toEqual([
      { name: "Armor Buster", text: "Increase Physical Penetration by 30%." },
      { name: "Breaker", text: "When attacking..." },
    ]);
    expect(passiveEffect("Increase Physical Penetration by 30%.")).toEqual({
      type: "bonus",
      bonus: { attribute: "physicalPenetration", value: 30, percent: true },
    });
    expect(passiveEffect("Max Cooldown Reduction is increased by 5%.")).toEqual({ type: "cooldownCap", value: 5 });
    expect(passiveEffect("Every 1% extra Crit Chance gained is converted into 1% extra Attack Speed.")).toEqual({
      type: "critToAttackSpeed",
    });
    // A condition in the sentence: not a permanent effect.
    expect(
      passiveEffect(
        "When attacking an enemy, gains 0.1% extra Physical Penetration for each point of the enemy's Physical Defense, capped at 30%.",
      ),
    ).toBeNull();
  });
});

describe("heroes", () => {
  it("reads the wiki record and its resource", () => {
    const aamon = prepareHero((heroesJson as RawHero[]).find((h) => h.slug === "aamon")!);
    expect(aamon).toMatchObject({ resource: "mana", damageType: "magic", hp: [2614, 4742], hpRegen: 8, movementSpeed: 250 });
    const fanny = prepareHero((heroesJson as RawHero[]).find((h) => h.slug === "fanny")!);
    expect(fanny).toMatchObject({ resource: "energy", mana: null });
    expect(prepareHero({ slug: "dori", nom: "Dori", typeDegats: "Magic", ressource: "Mana", stats: {} }).hp).toBeNull();
    expect(
      prepareHero({ slug: "x", nom: "X", typeDegats: "Phyiscal", ressource: "None", stats: { mana1: "0", mana15: "0" } }),
    ).toMatchObject({ damageType: "physical", resource: "none" });
  });

  it("interpolates between levels 1 and 15", () => {
    expect(valueAtLevel([100, 240], 1)).toBe(100);
    expect(valueAtLevel([100, 240], 15)).toBe(240);
    expect(valueAtLevel([100, 240], 8)).toBe(170);
    expect(valueAtLevel([100, 240], 99)).toBe(240);
  });
});

describe("stat computation", () => {
  const blade = item({ slug: "blade", bonus: "+60 Physical Attack, +10% Cooldown Reduction", prix: 2000 });
  const helmet = item({ slug: "helmet", categorie: "Defense", bonus: "+1200 HP, +20 Magic Defense", prix: 1900 });

  it("adds the base at the level and the items, with the breakdown", () => {
    const r = simulate(build({ level: 15, items: ["blade", "helmet"] }), catalog([blade, helmet]))!;
    expect(r.interpolated).toBe(false);
    expect(r.stats.hp).toMatchObject({ base: 4800, value: 6000 });
    expect(r.stats.physicalAttack.value).toBe(300);
    expect(r.stats.physicalAttack.sources).toEqual([{ origin: "item", key: "blade", value: 60 }]);
    expect(r.stats.magicDefense.value).toBe(70);
    expect(r.stats.cooldownReduction.value).toBe(10);
    expect(r.stats.magicPower.value).toBe(0);
    expect(r.stats.critDamage.value).toBe(200);
    expect(r.gold).toBe(3900);
    expect(simulate(build({ level: 8 }), catalog([]))!.interpolated).toBe(true);
  });

  it("returns null without a known hero", () => {
    expect(simulate(build({ hero: null }), catalog([]))).toBeNull();
    expect(simulate(build({ hero: "unknown" }), catalog([]))).toBeNull();
  });

  it("caps cooldown reduction at 40%, 45% with Magic Mastery", () => {
    const book = item({ slug: "book", bonus: "+15% Cooldown Reduction" });
    const four = ["book", "book", "book", "book"];
    const r = simulate(build({ items: four }), catalog([book]))!;
    expect(r.stats.cooldownReduction).toMatchObject({ raw: 60, value: 40, cap: 40 });

    const talisman = item({
      slug: "talisman",
      bonus: "+15% Cooldown Reduction",
      passif: "Mana Spring: Regenerates 15% of Max Mana every 10 seconds.@ Magic Mastery: Max Cooldown Reduction is increased by 5%.",
    });
    const r2 = simulate(build({ items: [...four, "talisman"] }), catalog([book, talisman]))!;
    expect(r2.stats.cooldownReduction).toMatchObject({ raw: 75, value: 45, cap: 45 });
    expect(r2.uncomputed).toEqual([{ item: "talisman", passive: "Mana Spring" }]);
  });

  it("caps crit chance at 100% and starts crit damage at 200%", () => {
    const fury = item({ slug: "fury", bonus: "+25% Crit Chance", unique: "+30% Crit Damage" });
    const r = simulate(build({ items: Array(5).fill("fury") }), catalog([fury]))!;
    expect(r.stats.critChance).toMatchObject({ raw: 125, value: 100 });
    // Unique attribute: once, even with five copies.
    expect(r.stats.critDamage.value).toBe(230);
    expect(r.conflicts).toContainEqual({ type: "unique", item: "fury" });
  });

  it("does not stack two passives with the same name and flags the conflict", () => {
    const gun = item({ slug: "gun", passif: "Armor Buster: Increase Physical Penetration by 30%.@ Malefic Energy: Increases range." });
    const roar = item({ slug: "roar", passif: "Armor Buster: Increase Physical Penetration by 30%." });
    const r = simulate(build({ items: ["gun", "roar"] }), catalog([gun, roar]))!;
    expect(r.stats.physicalPenPercent.value).toBe(30);
    expect(r.conflicts).toContainEqual({ type: "passive", name: "Armor Buster", items: ["gun", "roar"] });
    expect(r.uncomputed).toEqual([{ item: "gun", passive: "Malefic Energy" }]);
  });

  it("flags two pairs of boots", () => {
    const b1 = item({ slug: "b1", categorie: "Movement", bonus: "+40 Movement Speed" });
    const b2 = item({ slug: "b2", categorie: "Movement", bonus: "+40 Movement Speed" });
    const r = simulate(build({ items: ["b1", "b2"] }), catalog([b1, b2]))!;
    expect(r.conflicts).toContainEqual({ type: "boots", items: ["b1", "b2"] });
    expect(r.stats.movementSpeed.value).toBe(330);
  });

  it("sends adaptive attack to the dominant attribute, the damage type on a tie", () => {
    const gloves = item({ slug: "gloves", bonus: "+30 Adaptive Attack" });
    const wand = item({ slug: "wand", bonus: "+45 Magic Power" });
    const r = simulate(build({ items: ["gloves", "wand"] }), catalog([gloves, wand]))!;
    expect(r.adaptive).toBe("magic");
    expect(r.stats.magicPower.value).toBe(75);

    // Tie (nothing else): a physical hero gets physical attack...
    const alone = simulate(build({ items: ["gloves"] }), catalog([gloves]))!;
    expect(alone.adaptive).toBe("physical");
    expect(alone.stats.physicalAttack.value).toBe(270);
    // ... a magic hero gets magic power.
    const mage = simulate(build({ items: ["gloves"] }), catalog([gloves], hero({ damageType: "magic" })))!;
    expect(mage.stats.magicPower.value).toBe(30);
  });

  it("applies the emblem, the talents and Weapon Master on gains only", () => {
    const sword = item({ slug: "sword", bonus: "+100 Physical Attack" });
    const r = simulate(
      build({ items: ["sword"], emblem: "marksman", talents: ["fatal", "weapon-master", null] }),
      catalog([sword]),
    )!;
    // 100 (item) + 16 (emblem, adaptive) = 116 gained, +8% = 9.28.
    expect(r.stats.physicalAttack.value).toBeCloseTo(240 + 116 * 1.08, 6);
    expect(r.stats.attackSpeed.value).toBe(15);
    expect(r.stats.physicalPenPercent.value).toBe(10);
    expect(r.stats.critChance.value).toBe(5);
    expect(r.stats.critDamage.value).toBe(205);
  });

  it("spreads hybrid attributes over both stats", () => {
    const r = simulate(build({ emblem: "fighter", talents: ["firmness", "festival-of-blood", null] }), catalog([]))!;
    expect(r.stats.lifesteal.value).toBe(10);
    expect(r.stats.spellVamp.value).toBe(16);
    expect(r.stats.physicalDefense.value).toBe(90 + 16);
    expect(r.stats.magicDefense.value).toBe(50 + 16);
  });

  it("drops item mana for a hero without mana", () => {
    const gem = item({ slug: "gem", bonus: "+300 HP, +380 Mana, +5 Mana Regen" });
    const r = simulate(build({ items: ["gem"] }), catalog([gem], hero({ resource: "energy", mana: null })))!;
    expect(r.resourceIgnored).toBe(true);
    expect(r.stats.mana.value).toBeNull();
    expect(r.stats.manaRegen.value).toBe(0);
    expect(r.stats.hp.value).toBe(5100);
  });

  it("converts crit chance into attack speed with Golden Staff", () => {
    const staff = item({
      slug: "staff",
      bonus: "+55 Physical Attack, +15% Attack Speed",
      passif: "Swift: Every 1% extra Crit Chance gained is converted into 1% extra Attack Speed.",
    });
    const javelin = item({ slug: "javelin", bonus: "+8% Crit Chance" });
    const r = simulate(build({ items: ["staff", "javelin"] }), catalog([staff, javelin]))!;
    expect(r.critToAttackSpeed).toBe(true);
    expect(r.stats.critChance.value).toBe(0);
    expect(r.stats.attackSpeed.value).toBe(23);
  });

  it("applies Bargain Hunter's discount to gold", () => {
    const strike = item({ slug: "strike", prix: 2010 });
    const r = simulate(build({ items: ["strike"], talents: [null, "bargain-hunter", null] }), catalog([strike]))!;
    expect(r.gold).toBe(2010);
    expect(r.discountedGold).toBe(1910);
  });

  it("computes effective HP and the damage share after penetration", () => {
    // 120 defense: half the damage goes through (Physical and Magic defense pages).
    expect(damageShare(120, 0, 0)).toBe(0.5);
    expect(effectiveHp(3000, 120)).toBe(6000);
    // 100 defense, 40%: 60; then 10 flat: 50.
    expect(damageShare(100, 40, 10)).toBeCloseTo(120 / 170, 10);
    // Never below -60: 120 / 60.
    expect(damageShare(0, 0, 500)).toBe(2);
    const r = simulate(build({}), catalog([]))!;
    expect(r.effectiveHp.physical).toBeCloseTo((4800 * (120 + 90)) / 120, 6);
  });
});

describe("measured cores", () => {
  const cores: MeasuredCore[] = [
    { lane: "Jungle", rank: "all", items: ["a", "b", "c"], winRate: 55, pickRate: 4 },
    { lane: "Jungle", rank: "all", items: ["a", "b", "d"], winRate: 52, pickRate: 9 },
    { lane: "Jungle", rank: "all", items: ["a", "e", "f"], winRate: 50, pickRate: 20 },
    { lane: "Jungle", rank: "mythic", items: ["a", "b", "c"], winRate: 58, pickRate: 3 },
  ];

  it("keeps complete cores first, then those with two items in common", () => {
    const r = closeCores(cores, ["c", "b", "a", "x"], "all");
    expect(r.map((c) => [c.items.join(""), c.common, c.complete])).toEqual([
      ["abc", 3, true],
      ["abd", 2, false],
    ]);
    expect(closeCores(cores, ["a", "b", "c"], "mythic")).toHaveLength(1);
    expect(closeCores(cores, ["a"], "all")).toEqual([]);
  });
});

describe("build code", () => {
  const cat: CodeCatalog = {
    heroes: new Set(["aamon", "layla"]),
    items: new Set(["genius-wand", "holy-crystal", "boots"]),
    emblems: new Set(["mage", "common"]),
    tiers: [new Set(["rupture", "thrill"]), new Set(["weapon-master"]), new Set(["killing-spree"])],
    spells: new Set(["flicker", "retribution"]),
  };
  const full: BuildCode = {
    hero: "aamon",
    level: 12,
    items: ["genius-wand", "holy-crystal", "holy-crystal"],
    emblem: "mage",
    talents: ["rupture", null, "killing-spree"],
    spell: "retribution",
  };

  it("round-trips", () => {
    const code = encodeBuild(full);
    expect(code).toBe("h=aamon&l=12&i=genius-wand,holy-crystal,holy-crystal&e=mage&t=rupture,,killing-spree&s=retribution");
    expect(decodeBuild(code, cat)).toEqual({ build: full, ignored: [] });
    expect(decodeBuild(`?${code}`, cat).build).toEqual(full);
    expect(decodeBuild(new URLSearchParams(code), cat).build).toEqual(full);
    expect(decodeBuild({ h: "aamon", i: ["boots"] }, cat).build.items).toEqual(["boots"]);
  });

  it("leaves out level 15 and empty parts", () => {
    expect(encodeBuild({ ...EMPTY_BUILD, hero: "layla" })).toBe("h=layla");
    expect(encodeBuild(EMPTY_BUILD)).toBe("");
  });

  it("drops what it does not recognise, and says so", () => {
    const { build: b, ignored } = decodeBuild(
      "h=aamon&l=40&i=genius-wand,<script>,unknown&e=tank&t=killing-spree,weapon-master&s=javascript:alert(1)",
      cat,
    );
    expect(b).toEqual({ ...EMPTY_BUILD, hero: "aamon", items: ["genius-wand"], talents: [null, "weapon-master", null] });
    expect(ignored.sort()).toEqual(["emblem", "items", "level", "spell", "talents"]);
    expect(decodeBuild("i=boots,boots,boots,boots,boots,boots,boots", cat).build.items).toHaveLength(6);
    // An oversized URL is not read.
    expect(decodeBuild(`h=aamon&x=${"a".repeat(900)}`, cat).build.hero).toBeNull();
  });

  it("strictly validates a JSON body", () => {
    const body = { ...full };
    expect(validateBuild(body, cat)).toEqual(full);
    expect(validateBuild({ ...body, items: [] }, cat)).toBeNull();
    expect(validateBuild({ ...body, items: Array(7).fill("boots") }, cat)).toBeNull();
    expect(validateBuild({ ...body, level: 16 }, cat)).toBeNull();
    expect(validateBuild({ ...body, level: 1.5 }, cat)).toBeNull();
    expect(validateBuild({ ...body, hero: "unknown" }, cat)).toBeNull();
    expect(validateBuild({ ...body, talents: ["killing-spree", null, null] }, cat)).toBeNull();
    expect(validateBuild({ ...body, talents: [null, null] }, cat)).toBeNull();
    expect(validateBuild({ ...body, emblem: "tank" }, cat)).toBeNull();
    expect(validateBuild({ ...body, spell: "Flicker" }, cat)).toBeNull();
    expect(validateBuild({ ...body, extra: 1 }, cat)).toBeNull();
    expect(validateBuild({ ...body, emblem: null, spell: null, talents: [null, null, null] }, cat)).toMatchObject({
      emblem: null,
      spell: null,
    });
    expect(validateBuild("h=aamon", cat)).toBeNull();
    expect(validateBuild([full], cat)).toBeNull();
  });
});
