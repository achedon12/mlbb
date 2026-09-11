/**
 * Chiffres des ensembles d'emblemes et des talents, pour le simulateur de
 * build.
 *
 * Releves sur la page « Emblems » du wiki (`SOURCE_EMBLEMES`) le 11 septembre
 * 2026 et recopies dans la forme du jeu (« +275 HP ») : le lecteur des objets
 * (`lireBonus`) les interprete tels quels, sans seconde table a tenir.
 * `src/data/emblemes.ts` decrit les emblemes pour les pages ; ce fichier ne
 * porte que les chiffres.
 *
 * Etages : le wiki range chaque talent en « standard 1 », « standard 2 » ou
 * « core ». Les builds mesures confirment ce rangement — chaque talent n'y
 * apparait qu'a son etage — et montrent que tous les talents se prennent avec
 * tous les ensembles : l'ensemble ne fixe que ses trois attributs.
 *
 * Un talent sans `attributs` ni `effet` agit sous condition (en combat, contre
 * un monstre, sous un seuil de PV) : il se choisit, mais ne change aucune
 * statistique affichee.
 */
export const SOURCE_EMBLEMES = "https://mobilelegends.fandom.com/wiki/Emblems";

export type CleEnsemble = "common" | "tank" | "assassin" | "mage" | "fighter" | "support" | "marksman";

export const ENSEMBLES_EMBLEMES: { cle: CleEnsemble; attributs: string }[] = [
  { cle: "common", attributs: "+12 Hybrid Regen, +275 HP, +22 Adaptive Attack" },
  { cle: "tank", attributs: "+500 HP, +10 Hybrid Defense, +4 HP Regen" },
  { cle: "assassin", attributs: "+14 Adaptive Penetration, +10 Adaptive Attack, +3% Movement Speed" },
  { cle: "mage", attributs: "+30 Magic Power, +5% Cooldown Reduction, +8 Magic Penetration" },
  { cle: "fighter", attributs: "+10% Hybrid Lifesteal, +16 Adaptive Attack, +8 Hybrid Defense" },
  { cle: "support", attributs: "+12% Healing Effect, +10% Cooldown Reduction, +6% Movement Speed" },
  { cle: "marksman", attributs: "+15% Attack Speed, +16 Adaptive Attack, +10% Adaptive Penetration" },
];

export type EffetTalent =
  /** « Physical Attack and Magic Power gained from equipment, emblem, talents, and skills are increased by 8%. » */
  | { type: "maitreArmes"; pct: number }
  /** « Equipment can be purchased at 95% of their base price. » */
  | { type: "remise"; pct: number };

export interface TalentChiffre {
  cle: string;
  etage: 0 | 1 | 2;
  attributs?: string;
  effet?: EffetTalent;
}

export const TALENTS_CHIFFRES: TalentChiffre[] = [
  // ── Standard 1 ───────────────────────────────────────────────────────────
  { cle: "thrill", etage: 0, attributs: "+16 Adaptive Attack" },
  { cle: "swift", etage: 0, attributs: "+10% Attack Speed" },
  { cle: "vitality", etage: 0, attributs: "+225 HP" },
  { cle: "rupture", etage: 0, attributs: "+5 Adaptive Penetration" },
  { cle: "inspire", etage: 0, attributs: "+5% Cooldown Reduction, +2 Mana Regen" },
  // « Gain 8 extra Physical & Magic Defense » : la defense hybride du jeu.
  { cle: "firmness", etage: 0, attributs: "+8 Hybrid Defense" },
  { cle: "agility", etage: 0, attributs: "+4% Movement Speed" },
  { cle: "fatal", etage: 0, attributs: "+5% Crit Chance, +5% Crit Damage" },

  // ── Standard 2 ───────────────────────────────────────────────────────────
  { cle: "wilderness-blessing", etage: 1 },
  { cle: "seasoned-hunter", etage: 1 },
  { cle: "tenacity", etage: 1 },
  { cle: "master-assassin", etage: 1 },
  { cle: "bargain-hunter", etage: 1, effet: { type: "remise", pct: 5 } },
  // Base de 6 % ; les 0,5 % par elimination dependent de la partie.
  { cle: "festival-of-blood", etage: 1, attributs: "+6% Spell Vamp" },
  { cle: "pull-yourself-together", etage: 1 },
  { cle: "weapon-master", etage: 1, effet: { type: "maitreArmes", pct: 8 } },

  // ── Core ─────────────────────────────────────────────────────────────────
  { cle: "impure-rage", etage: 2 },
  { cle: "quantum-charge", etage: 2 },
  { cle: "war-cry", etage: 2 },
  { cle: "temporal-reign", etage: 2 },
  { cle: "concussive-blast", etage: 2 },
  { cle: "killing-spree", etage: 2 },
  { cle: "lethal-ignition", etage: 2 },
  { cle: "brave-smite", etage: 2 },
  { cle: "focusing-mark", etage: 2 },
  { cle: "weakness-finder", etage: 2 },
];
