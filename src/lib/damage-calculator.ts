import {
  DEFENSE_CONSTANT,
  effectiveHp,
  totalDefense,
  type SimCatalog,
  type SimHero,
  type SimResult,
  type SimulatorData,
} from "./build-simulator";

/**
 * Damage calculator: what one hit leaves of an attacker's damage once it
 * meets a defender's defense, and how many such hits the defender takes.
 *
 * Pure module, like the build simulator it builds on: the stats of an
 * equipped hero come from `simulate`, and the defense rules - penetration
 * order, the -60 floor, the 120 / (120 + defense) multiplier - from
 * `totalDefense` and `effectiveHp`, so the two tools can never disagree.
 *
 * Two kinds of hit only, the ones our data can back:
 *
 * - a basic attack, worth 100% of the total physical attack, and its critical
 *   strike, worth the crit damage (200% by default, Critical strike page);
 * - a hit of a given raw damage, physical, magic or true.
 *
 * Skill damage is left out on purpose: the wiki's skill texts give a range
 * across skill levels without saying which level is which, and about one in
 * ten carries a scaling at all - a figure computed from them would be made up.
 */

export type HitKind = "physical" | "magic" | "true";

export interface Penetration {
  flat: number;
  /** In percent: 30 for 30%. */
  percent: number;
}

export interface AttackerStats {
  physicalAttack: number;
  /** In percent, capped at 100 by the simulator. */
  critChance: number;
  /** Damage of a critical strike, in percent of the hit: 200 by default. */
  critDamage: number;
  physicalPen: Penetration;
  magicPen: Penetration;
}

export interface DefenderStats {
  hp: number;
  physicalDefense: number;
  magicDefense: number;
}

export interface HitOutcome {
  kind: HitKind;
  /** Damage before defense. */
  raw: number;
  /** Defense left after penetration; null for true damage, which ignores it. */
  defense: number | null;
  /** Share of the raw damage that goes through: 1 for true damage, up to 2 at -60 defense. */
  multiplier: number;
  damage: number;
  /** Hits of this damage needed to bring the defender's HP to 0; null when the hit deals nothing. */
  hitsToKill: number | null;
  /** Raw damage of this kind needed to kill the defender, penetration included. */
  effectiveHp: number;
}

export interface BasicAttackOutcome {
  normal: HitOutcome;
  /** Null when the attacker has no crit chance. */
  crit: HitOutcome | null;
  /** Damage per basic attack averaged over the crit chance. */
  average: number;
}

const clampPercent = (p: number) => Math.min(100, Math.max(0, p));

/** Attacker figures of a simulated build; null when our data lacks the hero's physical attack. */
export function attackerFrom(r: SimResult): AttackerStats | null {
  const s = r.stats;
  if (s.physicalAttack.value === null) return null;
  return {
    physicalAttack: s.physicalAttack.value,
    critChance: s.critChance.value ?? 0,
    critDamage: s.critDamage.value ?? 0,
    physicalPen: { flat: s.physicalPenFlat.value ?? 0, percent: s.physicalPenPercent.value ?? 0 },
    magicPen: { flat: s.magicPenFlat.value ?? 0, percent: s.magicPenPercent.value ?? 0 },
  };
}

/** Defender figures of a simulated build; null when our data lacks its HP or a defense. */
export function defenderFrom(r: SimResult): DefenderStats | null {
  const { hp, physicalDefense, magicDefense } = r.stats;
  if (hp.value === null || physicalDefense.value === null || magicDefense.value === null) return null;
  return { hp: hp.value, physicalDefense: physicalDefense.value, magicDefense: magicDefense.value };
}

/**
 * Hits needed to bring `hp` to 0. The small margin keeps a division that
 * should be whole (1,000 HP, 100 per hit) from rounding up to one hit too
 * many through floating point.
 */
export function hitsToKill(hp: number, damage: number): number | null {
  if (!(damage > 0) || !Number.isFinite(damage)) return null;
  if (hp <= 0) return 0;
  return Math.max(1, Math.ceil(hp / damage - 1e-9));
}

/** One hit of `raw` damage of a given kind, against the defender, with the attacker's penetration. */
export function hit(raw: number, kind: HitKind, attacker: AttackerStats, defender: DefenderStats): HitOutcome {
  const amount = Math.max(0, raw);
  let defense: number | null = null;
  let multiplier = 1;
  if (kind !== "true") {
    const pen = kind === "physical" ? attacker.physicalPen : attacker.magicPen;
    const base = kind === "physical" ? defender.physicalDefense : defender.magicDefense;
    defense = totalDefense(base, clampPercent(pen.percent), Math.max(0, pen.flat));
    multiplier = DEFENSE_CONSTANT / (DEFENSE_CONSTANT + defense);
  }
  const damage = amount * multiplier;
  return {
    kind,
    raw: amount,
    defense,
    multiplier,
    damage,
    hitsToKill: hitsToKill(defender.hp, damage),
    effectiveHp: defense === null ? defender.hp : effectiveHp(defender.hp, defense),
  };
}

/**
 * A basic attack: physical damage equal to the total physical attack, and the
 * same hit as a critical strike. Heroes whose passive changes their basic
 * attack (extra hits, magic damage, a share of the attack) are not modelled:
 * our data does not quantify those passives.
 */
export function basicAttack(attacker: AttackerStats, defender: DefenderStats): BasicAttackOutcome {
  const normal = hit(attacker.physicalAttack, "physical", attacker, defender);
  const chance = clampPercent(attacker.critChance) / 100;
  const crit = chance > 0 ? hit((attacker.physicalAttack * attacker.critDamage) / 100, "physical", attacker, defender) : null;
  const average = crit ? normal.damage * (1 - chance) + crit.damage * chance : normal.damage;
  return { normal, crit, average };
}

// -- Catalog handed to the browser ------------------------------------------

/**
 * What the calculator page sends: the simulator's heroes, items and emblem
 * sets, without talents and battle spells, which it does not offer.
 */
export type DamageCalculatorData = Pick<SimulatorData, "heroes" | "items" | "categories" | "emblems">;

/** A hero the calculator can use on either side: HP, attack and both defenses known. */
export const isComplete = (h: SimHero) =>
  h.hp !== null && h.physicalAttack !== null && h.physicalDefense !== null && h.magicDefense !== null;

export function damageCatalogFrom(d: DamageCalculatorData): SimCatalog {
  return {
    heroes: new Map(d.heroes.map((h) => [h.slug, h.sim])),
    items: new Map(d.items.map((o) => [o.slug, o])),
    emblems: new Map(d.emblems.map((e) => [e.key, e])),
    talents: new Map(),
  };
}
