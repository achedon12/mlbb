import { LEVEL_MAX, LEVEL_MIN, type BuildCode, type CodeCatalog } from "./build-code";
import type { RangMesure } from "./rangs-mesure";
import type { Lane, Role } from "./types";

/**
 * Build simulator: computed stats of an equipped hero.
 *
 * Pure module with no imported data: the page hands it the prepared catalog
 * (heroes, items, emblems, talents), the tests a hand-made one. It runs in the
 * browser on every click.
 *
 * Nothing is made up. Every rule comes from a wiki page listed in `SOURCES`,
 * or from the item's own text; whatever our data does not say is shown as
 * such:
 *
 * - hero stats only exist at levels 1 and 15: levels in between are linearly
 *   interpolated (`interpolated`);
 * - HP regen is only known at level 1;
 * - base attack speed is not in our data: only the percentage bonus is
 *   computed, and the game's cap (3 attacks per second) cannot be applied;
 * - conditional passives (below 50% HP, after a skill...) change no stat: they
 *   are listed apart (`uncomputed`).
 */

export const SOURCES = {
  equipment: "https://mobilelegends.fandom.com/wiki/Equipment",
  cooldown: "https://mobilelegends.fandom.com/wiki/Cooldown_reduction",
  crit: "https://mobilelegends.fandom.com/wiki/Critical_strike",
  physicalDefense: "https://mobilelegends.fandom.com/wiki/Physical_defense",
  magicDefense: "https://mobilelegends.fandom.com/wiki/Magic_defense",
  penetration: "https://mobilelegends.fandom.com/wiki/Physical_penetration",
  adaptive: "https://mobilelegends.fandom.com/wiki/Adaptive_attributes",
  hybrid: "https://mobilelegends.fandom.com/wiki/Hybrid_attributes",
  resource: "https://mobilelegends.fandom.com/wiki/Resource",
  magicPower: "https://mobilelegends.fandom.com/wiki/Magic_power",
  movementSpeed: "https://mobilelegends.fandom.com/wiki/Movement_speed",
} as const;

/** "cooldown reduction for ability is normally capped at 40%" (Cooldown reduction page). */
export const COOLDOWN_CAP = 40;
/** "A [critical damage] is guaranteed when it is over 100%" (Critical strike page). */
export const CRIT_CAP = 100;
/** "The default crit damage is 200%" (Critical strike page). */
export const BASE_CRIT_DAMAGE = 200;
/** Damage multiplier: 120 / (120 + defense) (Physical defense and Magic defense pages). */
export const DEFENSE_CONSTANT = 120;
/** "the minimum physical and magic defense is now negative 60" (Patch 1.5.88, Physical defense page). */
export const MIN_DEFENSE = -60;

// -- Reading attribute texts ------------------------------------------------

export type Attribute =
  | "hp"
  | "mana"
  | "physicalAttack"
  | "magicPower"
  | "physicalDefense"
  | "magicDefense"
  | "hybridDefense"
  | "attackSpeed"
  | "critChance"
  | "critDamage"
  | "lifesteal"
  | "spellVamp"
  | "hybridLifesteal"
  | "cooldownReduction"
  | "physicalPenetration"
  | "magicPenetration"
  | "adaptivePenetration"
  | "adaptiveAttack"
  | "movementSpeed"
  | "hpRegen"
  | "manaRegen"
  | "hybridRegen";

export interface Bonus {
  attribute: Attribute;
  value: number;
  /** Percentage value ("+10% Magic Penetration") rather than flat ("+10"). */
  percent: boolean;
}

/**
 * Game attribute names, lowercased, and the form they take: a "percent"
 * attribute without a % sign, or a "flat" one with it, is not what it seems -
 * it goes to `others` instead of being miscounted.
 */
const ATTRIBUTES: Record<string, [Attribute, "flat" | "percent" | "both"]> = {
  hp: ["hp", "flat"],
  mana: ["mana", "flat"],
  "physical attack": ["physicalAttack", "flat"],
  "magic power": ["magicPower", "flat"],
  "physical defense": ["physicalDefense", "flat"],
  "magic defense": ["magicDefense", "flat"],
  "hybrid defense": ["hybridDefense", "flat"],
  "attack speed": ["attackSpeed", "percent"],
  "crit chance": ["critChance", "percent"],
  "crit damage": ["critDamage", "percent"],
  lifesteal: ["lifesteal", "percent"],
  "spell vamp": ["spellVamp", "percent"],
  "hybrid lifesteal": ["hybridLifesteal", "percent"],
  "cooldown reduction": ["cooldownReduction", "percent"],
  "physical penetration": ["physicalPenetration", "both"],
  "magic penetration": ["magicPenetration", "both"],
  "adaptive penetration": ["adaptivePenetration", "both"],
  "adaptive attack": ["adaptiveAttack", "flat"],
  "movement speed": ["movementSpeed", "both"],
  "hp regen": ["hpRegen", "flat"],
  "mana regen": ["manaRegen", "flat"],
  "hybrid regen": ["hybridRegen", "flat"],
};

const SEGMENT = /^\+\s*(\d+(?:\.\d+)?)\s*(%?)\s*([A-Za-z][A-Za-z ]*?)\s*$/;

/**
 * Reads a wiki attribute text ("+920 HP, +40 Physical Defense") into numeric
 * bonuses. Whatever is not recognised - unknown attribute ("Slow
 * Reduction"), unexpected form - is returned as is in `others`: shown, never
 * counted.
 */
export function parseBonus(text: string | null | undefined): { bonuses: Bonus[]; others: string[] } {
  const bonuses: Bonus[] = [];
  const others: string[] = [];
  if (!text || text.trim().toLowerCase() === "none") return { bonuses, others };
  for (const raw of text.split(",")) {
    const segment = raw.trim();
    // "+30 Adaptive Attack,": the wiki's trailing comma leaves an empty segment.
    if (!segment) continue;
    const m = SEGMENT.exec(segment);
    const name = m?.[3]
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/^(?:(?:extra|max|total) )+/, "");
    const def = name ? ATTRIBUTES[name] : undefined;
    const percent = m?.[2] === "%";
    if (!m || !def || (def[1] === "flat" && percent) || (def[1] === "percent" && !percent)) {
      others.push(segment);
      continue;
    }
    bonuses.push({ attribute: def[0], value: Number(m[1]), percent });
  }
  return { bonuses, others };
}

export interface Passive {
  /** Passive name ("Armor Buster"); empty when the text carries none. */
  name: string;
  text: string;
}

/** Item passives: the wiki separates them with "@", each as "Name: text". */
export function parsePassives(text: string | null | undefined): Passive[] {
  if (!text) return [];
  return text
    .split("@")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^([^:]{1,40}):\s*([\s\S]*)$/.exec(s);
      return m ? { name: m[1].trim(), text: m[2].trim() } : { name: "", text: s };
    });
}

export type PassiveEffect =
  | { type: "bonus"; bonus: Bonus }
  | { type: "cooldownCap"; value: number }
  | { type: "critToAttackSpeed" };

/**
 * Passives whose effect is permanent and quantified in their own text. The
 * patterns are anchored on the whole sentence: a passive that adds a
 * condition ("When attacking an enemy, gains...") does not match and stays
 * uncomputed.
 */
export function passiveEffect(text: string): PassiveEffect | null {
  // Malefic Gun, Malefic Roar: "Armor Buster: Increase Physical Penetration by 30%."
  const pen = /^Increases? (Physical|Magic) Penetration by (\d+(?:\.\d+)?)%\.?$/i.exec(text);
  if (pen) {
    const attribute = pen[1].toLowerCase() === "physical" ? "physicalPenetration" : "magicPenetration";
    return { type: "bonus", bonus: { attribute, value: Number(pen[2]), percent: true } };
  }
  // Enchanted Talisman: "Magic Mastery: Max Cooldown Reduction is increased by 5%."
  const cap = /^Max Cooldown Reduction is increased by (\d+(?:\.\d+)?)%\.?$/i.exec(text);
  if (cap) return { type: "cooldownCap", value: Number(cap[1]) };
  // Golden Staff: "Swift: Every 1% extra Crit Chance gained is converted into 1% extra Attack Speed."
  if (/^Every 1% extra Crit Chance gained is converted into 1% extra Attack Speed\.?$/i.test(text)) {
    return { type: "critToAttackSpeed" };
  }
  return null;
}

// -- Prepared catalog -------------------------------------------------------

export type Pair = [number, number];
export type Resource = "mana" | "energy" | "none";
export type DamageType = "physical" | "magic" | "mixed";

export interface SimHero {
  slug: string;
  name: string;
  damageType: DamageType;
  resource: Resource;
  /** Values at levels 1 and 15; null when the wiki does not give them. */
  hp: Pair | null;
  mana: Pair | null;
  physicalAttack: Pair | null;
  physicalDefense: Pair | null;
  magicDefense: Pair | null;
  /** Level 1 only: our data has no growth for it. */
  hpRegen: number | null;
  movementSpeed: number | null;
}

const toNumber = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
};

const pair = (a: unknown, b: unknown): Pair | null => {
  const x = toNumber(a);
  const y = toNumber(b);
  return x === null || y === null ? null : [x, y];
};

/** Wiki hero record (`heros.json`, French field names of the shared data) to the simulator shape. */
export function prepareHero(h: {
  slug: string;
  nom: string;
  typeDegats: string | null;
  ressource: string | null;
  stats?: Record<string, string> | null;
}): SimHero {
  const s = h.stats ?? {};
  const mana = pair(s.mana1, s.mana15);
  const usesMana = h.ressource === "Mana" || (mana !== null && mana[1] > 0 && h.ressource !== "Energy");
  const damage = h.typeDegats ?? "";
  return {
    slug: h.slug,
    name: h.nom,
    // "Phyiscal": a wiki typo, read as physical.
    damageType: /^mag/i.test(damage) ? "magic" : /^mix/i.test(damage) ? "mixed" : "physical",
    resource: usesMana ? "mana" : h.ressource === "Energy" ? "energy" : "none",
    hp: pair(s.hp1, s.hp15),
    mana: usesMana ? mana : null,
    physicalAttack: pair(s.physical_atk1, s.physical_atk15),
    physicalDefense: pair(s.physical_def1, s.physical_def15),
    magicDefense: pair(s.magic_def1, s.magic_def15),
    hpRegen: toNumber(s.hp_regen1),
    movementSpeed: toNumber(s.movement_spd),
  };
}

export interface SimItem {
  slug: string;
  name: string;
  category: string;
  price: number | null;
  bonuses: Bonus[];
  /** Unique attributes: counted once per item, even when bought twice. */
  unique: Bonus[];
  /** Attributes read but not computed ("+35% Slow Reduction"). */
  others: string[];
  passives: Passive[];
}

/** Wiki item record (`objets.json`, French field names of the shared data) to the simulator shape. */
export function prepareItem(o: {
  slug: string;
  nom: string;
  categorie: string;
  prix: number | null;
  bonus: string | null;
  unique: string | null;
  passif: string | null;
}): SimItem {
  const bonus = parseBonus(o.bonus);
  const unique = parseBonus(o.unique);
  return {
    slug: o.slug,
    name: o.nom,
    category: o.categorie,
    price: o.prix,
    bonuses: bonus.bonuses,
    unique: unique.bonuses,
    others: [...bonus.others, ...unique.others],
    passives: parsePassives(o.passif),
  };
}

export interface SimEmblem {
  key: string;
  bonuses: Bonus[];
  others: string[];
}

export function prepareEmblem(key: string, attributes: string): SimEmblem {
  return { key, ...parseBonus(attributes) };
}

export type SimTalentEffect = { type: "weaponMaster"; percent: number } | { type: "discount"; percent: number };

export interface SimTalent {
  key: string;
  tier: 0 | 1 | 2;
  bonuses: Bonus[];
  effect: SimTalentEffect | null;
}

export function prepareTalent(t: { key: string; tier: 0 | 1 | 2; attributes?: string; effect?: SimTalentEffect }): SimTalent {
  return { key: t.key, tier: t.tier, bonuses: parseBonus(t.attributes).bonuses, effect: t.effect ?? null };
}

export interface SimCatalog {
  heroes: ReadonlyMap<string, SimHero>;
  items: ReadonlyMap<string, SimItem>;
  emblems: ReadonlyMap<string, SimEmblem>;
  talents: ReadonlyMap<string, SimTalent>;
}

// -- Computation ------------------------------------------------------------

export type StatKey =
  | "hp"
  | "mana"
  | "physicalAttack"
  | "magicPower"
  | "physicalDefense"
  | "magicDefense"
  | "attackSpeed"
  | "critChance"
  | "critDamage"
  | "lifesteal"
  | "spellVamp"
  | "cooldownReduction"
  | "physicalPenFlat"
  | "physicalPenPercent"
  | "magicPenFlat"
  | "magicPenPercent"
  | "movementSpeed"
  | "movementSpeedPercent"
  | "hpRegen"
  | "manaRegen";

export const STAT_ORDER: readonly StatKey[] = [
  "hp",
  "mana",
  "physicalAttack",
  "magicPower",
  "physicalDefense",
  "magicDefense",
  "attackSpeed",
  "critChance",
  "critDamage",
  "lifesteal",
  "spellVamp",
  "cooldownReduction",
  "physicalPenFlat",
  "physicalPenPercent",
  "magicPenFlat",
  "magicPenPercent",
  "movementSpeed",
  "movementSpeedPercent",
  "hpRegen",
  "manaRegen",
];

export const PERCENT_STATS: ReadonlySet<StatKey> = new Set<StatKey>([
  "attackSpeed",
  "critChance",
  "critDamage",
  "lifesteal",
  "spellVamp",
  "cooldownReduction",
  "physicalPenPercent",
  "magicPenPercent",
  "movementSpeedPercent",
]);

/** Stats with no base value in our data: only the bonus is shown. */
export const BONUS_ONLY_STATS: ReadonlySet<StatKey> = new Set<StatKey>(["attackSpeed", "manaRegen"]);

export type SourceOrigin = "item" | "passive" | "emblem" | "talent" | "conversion";

export interface Source {
  origin: SourceOrigin;
  /** Item slug, emblem set key or talent key. */
  key: string;
  value: number;
  /** Contribution of an adaptive attribute, resolved to physical or magic. */
  adaptive?: boolean;
}

export interface ComputedStat {
  key: StatKey;
  /** Displayed value, cap applied; null when the base is missing. */
  value: number | null;
  /** Value before the cap. */
  raw: number | null;
  cap: number | null;
  /** The bare hero's value at the chosen level; null when our data lacks it. */
  base: number | null;
  sources: Source[];
}

export type Conflict =
  /** Same passive on several items (or one item bought twice): only one works. */
  | { type: "passive"; name: string; items: string[] }
  /** Item bought twice: its unique attributes only count once. */
  | { type: "unique"; item: string }
  /** Two pairs of boots: "Unique passives cannot stack, along with boots" (Equipment page). */
  | { type: "boots"; items: string[] };

export interface SimResult {
  level: number;
  /** Level other than 1 and 15: interpolated base stats. */
  interpolated: boolean;
  stats: Record<StatKey, ComputedStat>;
  /** Total item cost, in gold. */
  gold: number;
  /** Cost with a talent's discount (Bargain Hunter), rounded; null without it. */
  discountedGold: number | null;
  /** Raw physical or magic damage needed to kill the hero. */
  effectiveHp: { physical: number | null; magic: number | null };
  /** Where adaptive attributes go; null when the build has none. */
  adaptive: "physical" | "magic" | null;
  conflicts: Conflict[];
  /** Passives present whose conditional effect does not enter the stats. */
  uncomputed: { item: string; passive: string }[];
  /** Attributes read but not computed (healing, slow reduction...). */
  others: { origin: "item" | "emblem"; key: string; text: string }[];
  /** Item mana or mana regen dropped: the hero does not use mana. */
  resourceIgnored: boolean;
  /** Golden Staff: crit chance is converted into attack speed. */
  critToAttackSpeed: boolean;
}

/** Linear interpolation between levels 1 and 15, the only two the wiki publishes. */
export function valueAtLevel(p: Pair, level: number): number {
  const n = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, level));
  return p[0] + ((p[1] - p[0]) * (n - LEVEL_MIN)) / (LEVEL_MAX - LEVEL_MIN);
}

/**
 * Share of damage that goes through a defense, after penetration:
 * total defense = defense x (1 - percent penetration) - flat penetration,
 * never below -60 (Physical penetration and Physical defense pages), then the
 * 120 / (120 + total defense) multiplier.
 */
export function damageShare(targetDefense: number, penPercent: number, penFlat: number): number {
  const total = Math.max(MIN_DEFENSE, targetDefense * (1 - penPercent / 100) - penFlat);
  return DEFENSE_CONSTANT / (DEFENSE_CONSTANT + total);
}

/** Effective HP: HP divided by the defense's damage multiplier. */
export function effectiveHp(hp: number, defense: number): number {
  return (hp * (DEFENSE_CONSTANT + Math.max(MIN_DEFENSE, defense))) / DEFENSE_CONSTANT;
}

interface Contribution {
  origin: SourceOrigin;
  key: string;
  bonus: Bonus;
}

/** Stats touched by an attribute; hybrid ones touch both. */
function targets(b: Bonus, towardsPhysical: boolean): StatKey[] {
  switch (b.attribute) {
    case "hybridDefense":
      return ["physicalDefense", "magicDefense"];
    case "hybridLifesteal":
      return ["lifesteal", "spellVamp"];
    case "hybridRegen":
      return ["hpRegen", "manaRegen"];
    case "adaptiveAttack":
      return [towardsPhysical ? "physicalAttack" : "magicPower"];
    case "adaptivePenetration":
      return [
        towardsPhysical
          ? b.percent
            ? "physicalPenPercent"
            : "physicalPenFlat"
          : b.percent
            ? "magicPenPercent"
            : "magicPenFlat",
      ];
    case "physicalPenetration":
      return [b.percent ? "physicalPenPercent" : "physicalPenFlat"];
    case "magicPenetration":
      return [b.percent ? "magicPenPercent" : "magicPenFlat"];
    case "movementSpeed":
      return [b.percent ? "movementSpeedPercent" : "movementSpeed"];
    default:
      return [b.attribute];
  }
}

const total = (sources: Source[]) => sources.reduce((s, x) => s + x.value, 0);

/**
 * Stats of the build at the chosen level, or null without a known hero.
 *
 * Order: item attributes (unique ones once per item, same-name passives only
 * once), emblem set and talents; adaptive attributes resolved; Weapon Master
 * bonus; Golden Staff conversion; caps.
 */
export function simulate(build: BuildCode, cat: SimCatalog): SimResult | null {
  const h = build.hero ? cat.heroes.get(build.hero) : undefined;
  if (!h) return null;
  const level = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(build.level)));

  const contributions: Contribution[] = [];
  const conflicts: Conflict[] = [];
  const uncomputed: SimResult["uncomputed"] = [];
  const others: SimResult["others"] = [];
  let cooldownCap = COOLDOWN_CAP;
  let conversion: string | null = null;

  // Items
  const items = build.items.flatMap((s) => cat.items.get(s) ?? []);
  const seen = new Set<string>();
  const passivesSeen = new Map<string, string[]>();
  for (const o of items) {
    for (const bonus of o.bonuses) contributions.push({ origin: "item", key: o.slug, bonus });
    if (!seen.has(o.slug)) {
      for (const bonus of o.unique) contributions.push({ origin: "item", key: o.slug, bonus });
      for (const text of o.others) others.push({ origin: "item", key: o.slug, text });
    } else if (o.unique.length && !conflicts.some((c) => c.type === "unique" && c.item === o.slug)) {
      conflicts.push({ type: "unique", item: o.slug });
    }
    seen.add(o.slug);

    for (const p of o.passives) {
      if (!p.name) continue;
      const holders = passivesSeen.get(p.name);
      if (holders) {
        holders.push(o.slug);
        continue;
      }
      passivesSeen.set(p.name, [o.slug]);
      const effect = passiveEffect(p.text);
      if (!effect) uncomputed.push({ item: o.slug, passive: p.name });
      else if (effect.type === "bonus") contributions.push({ origin: "passive", key: o.slug, bonus: effect.bonus });
      else if (effect.type === "cooldownCap") cooldownCap = Math.max(cooldownCap, COOLDOWN_CAP + effect.value);
      else conversion = o.slug;
    }
  }
  for (const [name, holders] of passivesSeen) {
    if (holders.length > 1) conflicts.push({ type: "passive", name, items: holders });
  }
  const boots = items.filter((o) => o.category === "Movement");
  if (boots.length > 1) conflicts.push({ type: "boots", items: boots.map((o) => o.slug) });

  // Emblem and talents
  const emblem = build.emblem ? cat.emblems.get(build.emblem) : undefined;
  if (emblem) {
    for (const bonus of emblem.bonuses) contributions.push({ origin: "emblem", key: emblem.key, bonus });
    for (const text of emblem.others) others.push({ origin: "emblem", key: emblem.key, text });
  }
  let weaponMaster: { key: string; percent: number } | null = null;
  let discount = 0;
  for (const key of build.talents) {
    const talent = key ? cat.talents.get(key) : undefined;
    if (!talent) continue;
    for (const bonus of talent.bonuses) contributions.push({ origin: "talent", key: talent.key, bonus });
    if (talent.effect?.type === "weaponMaster") weaponMaster = { key: talent.key, percent: talent.effect.percent };
    if (talent.effect?.type === "discount") discount = talent.effect.percent;
  }

  // Adaptive attributes. "Increases Physical Attack ... if the hero has more
  // extra Physical Attack than extra Magic Power ... (Determined by a hero's
  // damage type if the 2 attributes are equal)" (Adaptive attributes page). A
  // mixed hero on a tie counts as physical: the wiki says nothing about it.
  const extra = (a: Attribute) =>
    contributions.filter((x) => x.bonus.attribute === a).reduce((s, x) => s + x.bonus.value, 0);
  const extraPhysical = extra("physicalAttack");
  const extraMagic = extra("magicPower");
  const towardsPhysical = extraPhysical === extraMagic ? h.damageType !== "magic" : extraPhysical > extraMagic;
  const hasAdaptive = contributions.some(
    (x) => x.bonus.attribute === "adaptiveAttack" || x.bonus.attribute === "adaptivePenetration",
  );

  const sources = Object.fromEntries(STAT_ORDER.map((k) => [k, [] as Source[]])) as Record<StatKey, Source[]>;
  let resourceIgnored = false;
  for (const c of contributions) {
    const adaptive = c.bonus.attribute === "adaptiveAttack" || c.bonus.attribute === "adaptivePenetration";
    for (const key of targets(c.bonus, towardsPhysical)) {
      // "A resource-less hero does not gain any mana and mana regen from any
      // source"; energy cannot be increased either (Resource page).
      if ((key === "mana" || key === "manaRegen") && h.resource !== "mana") {
        resourceIgnored = true;
        continue;
      }
      sources[key].push({ origin: c.origin, key: c.key, value: c.bonus.value, ...(adaptive ? { adaptive } : {}) });
    }
  }

  // Weapon Master: +8% of the physical attack and magic power gained, not of
  // the hero's base.
  if (weaponMaster) {
    for (const key of ["physicalAttack", "magicPower"] as const) {
      const gained = total(sources[key]);
      if (gained > 0) {
        sources[key].push({ origin: "talent", key: weaponMaster.key, value: (gained * weaponMaster.percent) / 100 });
      }
    }
  }

  // Golden Staff: all crit chance becomes attack speed.
  if (conversion) {
    const crit = total(sources.critChance);
    if (crit > 0) {
      sources.attackSpeed.push({ origin: "conversion", key: conversion, value: crit });
      sources.critChance.push({ origin: "conversion", key: conversion, value: -crit });
    }
  }

  const atLevel = (p: Pair | null) => (p ? valueAtLevel(p, level) : null);
  const bases: Record<StatKey, number | null> = {
    hp: atLevel(h.hp),
    mana: h.resource === "mana" ? atLevel(h.mana) : null,
    physicalAttack: atLevel(h.physicalAttack),
    // "All units have no base and extra magic power" (Magic power page).
    magicPower: 0,
    physicalDefense: atLevel(h.physicalDefense),
    magicDefense: atLevel(h.magicDefense),
    attackSpeed: null,
    // "The default critical chance is 0%" (Critical strike page).
    critChance: 0,
    critDamage: BASE_CRIT_DAMAGE,
    lifesteal: 0,
    spellVamp: 0,
    // "All heroes start with a default 0% cooldown reduction" (Cooldown reduction page).
    cooldownReduction: 0,
    physicalPenFlat: 0,
    physicalPenPercent: 0,
    magicPenFlat: 0,
    magicPenPercent: 0,
    movementSpeed: h.movementSpeed,
    movementSpeedPercent: 0,
    hpRegen: h.hpRegen,
    manaRegen: null,
  };
  const caps: Partial<Record<StatKey, number>> = { cooldownReduction: cooldownCap, critChance: CRIT_CAP };

  const stats = Object.fromEntries(
    STAT_ORDER.map((key) => {
      const base = bases[key];
      const added = total(sources[key]);
      const raw = base !== null ? base + added : BONUS_ONLY_STATS.has(key) ? added : null;
      const cap = caps[key] ?? null;
      const value = raw === null ? null : cap === null ? raw : Math.min(raw, cap);
      return [key, { key, value, raw, cap, base, sources: sources[key] } satisfies ComputedStat];
    }),
  ) as Record<StatKey, ComputedStat>;

  const gold = items.reduce((s, o) => s + (o.price ?? 0), 0);
  const hp = stats.hp.value;
  const pd = stats.physicalDefense.value;
  const md = stats.magicDefense.value;

  return {
    level,
    interpolated: level !== LEVEL_MIN && level !== LEVEL_MAX,
    stats,
    gold,
    discountedGold: discount > 0 ? Math.round((gold * (100 - discount)) / 100) : null,
    effectiveHp: {
      physical: hp !== null && pd !== null ? effectiveHp(hp, pd) : null,
      magic: hp !== null && md !== null ? effectiveHp(hp, md) : null,
    },
    adaptive: hasAdaptive ? (towardsPhysical ? "physical" : "magic") : null,
    conflicts,
    uncomputed,
    others,
    resourceIgnored,
    critToAttackSpeed: conversion !== null,
  };
}

// -- Measured builds --------------------------------------------------------

/** Three core items of a build actually played, with its rates (in %). */
export interface MeasuredCore {
  lane: string;
  rank: RangMesure;
  items: string[];
  winRate: number | null;
  pickRate: number | null;
}

export interface CloseCore extends MeasuredCore {
  /** Core items present in the simulated build. */
  common: number;
  /** The whole core is in the build. */
  complete: boolean;
}

/**
 * Measured cores at the chosen rank that overlap the build: the whole core,
 * or at least `minimum` of its items. Closest first, then most played.
 */
export function closeCores(
  cores: readonly MeasuredCore[],
  items: readonly string[],
  rank: RangMesure,
  minimum = 2,
): CloseCore[] {
  const chosen = new Set(items);
  return cores
    .filter((c) => c.rank === rank)
    .flatMap((c) => {
      const distinct = [...new Set(c.items)];
      if (distinct.length === 0) return [];
      const common = distinct.filter((o) => chosen.has(o)).length;
      const complete = common === distinct.length;
      return complete || common >= minimum ? [{ ...c, common, complete }] : [];
    })
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) || b.common - a.common || (b.pickRate ?? 0) - (a.pickRate ?? 0),
    );
}

// -- Display data -----------------------------------------------------------

/**
 * Catalog as the page hands it to the browser: the computation shapes, plus
 * names in the page's language and images.
 */
export interface HeroOption {
  slug: string;
  name: string;
  lanes: Lane[];
  roles: Role[];
  icon: string | null;
  sim: SimHero;
}

export interface ItemOption extends SimItem {
  image: string | null;
  /** Attributes in the page's language, for the picker. */
  text: string | null;
}

export interface EmblemOption extends SimEmblem {
  name: string;
  image: string | null;
}

export interface TalentOption extends SimTalent {
  name: string;
  image: string | null;
}

export interface SpellOption {
  key: string;
  name: string;
  image: string | null;
}

export interface SimulatorData {
  heroes: HeroOption[];
  items: ItemOption[];
  /** Item categories, in catalog order. */
  categories: string[];
  emblems: EmblemOption[];
  talents: TalentOption[];
  spells: SpellOption[];
}

/** Display names for every key of a result (stat breakdown, conflicts). */
export interface BuildNames {
  items: Record<string, string>;
  emblems: Record<string, string>;
  talents: Record<string, string>;
}

export function catalogFrom(d: SimulatorData): SimCatalog {
  return {
    heroes: new Map(d.heroes.map((h) => [h.slug, h.sim])),
    items: new Map(d.items.map((o) => [o.slug, o])),
    emblems: new Map(d.emblems.map((e) => [e.key, e])),
    talents: new Map(d.talents.map((t) => [t.key, t])),
  };
}

export function codeCatalogFrom(d: SimulatorData): CodeCatalog {
  const tier = (n: number) => new Set(d.talents.filter((t) => t.tier === n).map((t) => t.key));
  return {
    heroes: new Set(d.heroes.map((h) => h.slug)),
    items: new Set(d.items.map((o) => o.slug)),
    emblems: new Set(d.emblems.map((e) => e.key)),
    tiers: [tier(0), tier(1), tier(2)],
    spells: new Set(d.spells.map((s) => s.key)),
  };
}

export function namesFrom(d: {
  items: { slug: string; name: string }[];
  emblems: { key: string; name: string }[];
  talents: { key: string; name: string }[];
}): BuildNames {
  return {
    items: Object.fromEntries(d.items.map((o) => [o.slug, o.name])),
    emblems: Object.fromEntries(d.emblems.map((e) => [e.key, e.name])),
    talents: Object.fromEntries(d.talents.map((t) => [t.key, t.name])),
  };
}
