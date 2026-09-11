/**
 * Emblem set and talent figures for the build simulator.
 *
 * Taken from the wiki "Emblems" page (`SOURCE_EMBLEMS`) on 11 September 2026
 * and copied in the game's own wording ("+275 HP"): the item attribute
 * reader (`parseBonus`) reads them as they are, with no second table to
 * maintain. `src/data/emblemes.ts` describes emblems for the pages; this file
 * only carries the numbers.
 *
 * Tiers: the wiki files each talent under "standard 1", "standard 2" or
 * "core". Our measured builds confirm that split - each talent only ever
 * shows up on its own tier - and show every talent being taken with every
 * set: the set only fixes its three attributes.
 *
 * A talent with neither `attributes` nor `effect` works under a condition (in
 * combat, against a creep, below an HP threshold): it can be picked, but it
 * changes no displayed stat.
 */
export const SOURCE_EMBLEMS = "https://mobilelegends.fandom.com/wiki/Emblems";

export type EmblemSetKey = "common" | "tank" | "assassin" | "mage" | "fighter" | "support" | "marksman";

export const EMBLEM_SETS: { key: EmblemSetKey; attributes: string }[] = [
  { key: "common", attributes: "+12 Hybrid Regen, +275 HP, +22 Adaptive Attack" },
  { key: "tank", attributes: "+500 HP, +10 Hybrid Defense, +4 HP Regen" },
  { key: "assassin", attributes: "+14 Adaptive Penetration, +10 Adaptive Attack, +3% Movement Speed" },
  { key: "mage", attributes: "+30 Magic Power, +5% Cooldown Reduction, +8 Magic Penetration" },
  { key: "fighter", attributes: "+10% Hybrid Lifesteal, +16 Adaptive Attack, +8 Hybrid Defense" },
  { key: "support", attributes: "+12% Healing Effect, +10% Cooldown Reduction, +6% Movement Speed" },
  { key: "marksman", attributes: "+15% Attack Speed, +16 Adaptive Attack, +10% Adaptive Penetration" },
];

export type TalentEffect =
  /** "Physical Attack and Magic Power gained from equipment, emblem, talents, and skills are increased by 8%." */
  | { type: "weaponMaster"; percent: number }
  /** "Equipment can be purchased at 95% of their base price." */
  | { type: "discount"; percent: number };

export interface TalentFigures {
  key: string;
  tier: 0 | 1 | 2;
  attributes?: string;
  effect?: TalentEffect;
}

export const TALENT_FIGURES: TalentFigures[] = [
  // Standard 1
  { key: "thrill", tier: 0, attributes: "+16 Adaptive Attack" },
  { key: "swift", tier: 0, attributes: "+10% Attack Speed" },
  { key: "vitality", tier: 0, attributes: "+225 HP" },
  { key: "rupture", tier: 0, attributes: "+5 Adaptive Penetration" },
  { key: "inspire", tier: 0, attributes: "+5% Cooldown Reduction, +2 Mana Regen" },
  // "Gain 8 extra Physical & Magic Defense": the game's hybrid defense.
  { key: "firmness", tier: 0, attributes: "+8 Hybrid Defense" },
  { key: "agility", tier: 0, attributes: "+4% Movement Speed" },
  { key: "fatal", tier: 0, attributes: "+5% Crit Chance, +5% Crit Damage" },

  // Standard 2
  { key: "wilderness-blessing", tier: 1 },
  { key: "seasoned-hunter", tier: 1 },
  { key: "tenacity", tier: 1 },
  { key: "master-assassin", tier: 1 },
  { key: "bargain-hunter", tier: 1, effect: { type: "discount", percent: 5 } },
  // 6% base; the extra 0.5% per takedown depends on the match.
  { key: "festival-of-blood", tier: 1, attributes: "+6% Spell Vamp" },
  { key: "pull-yourself-together", tier: 1 },
  { key: "weapon-master", tier: 1, effect: { type: "weaponMaster", percent: 8 } },

  // Core
  { key: "impure-rage", tier: 2 },
  { key: "quantum-charge", tier: 2 },
  { key: "war-cry", tier: 2 },
  { key: "temporal-reign", tier: 2 },
  { key: "concussive-blast", tier: 2 },
  { key: "killing-spree", tier: 2 },
  { key: "lethal-ignition", tier: 2 },
  { key: "brave-smite", tier: 2 },
  { key: "focusing-mark", tier: 2 },
  { key: "weakness-finder", tier: 2 },
];
