import type { Role } from "@/lib/types";

/**
 * Emblems, talents and battle spells.
 *
 * The wiki exposes no data module for them: this list is written by hand.
 * Names are the game's English ones, which is not an aesthetic choice — they
 * are the key linking each entry to its visual, resolved by the sync
 * (`src/data/game/visuals.json`).
 *
 * The `bestFor` field is analysis: it says who the option is really for,
 * which an effect description never does.
 */
export interface Emblem {
  /** Visual key, and exact in-game name. */
  key: string;
  /** Role this emblem fits. */
  role: Role;
  name: string;
  bonus: string;
  bestFor: string;
}

export const emblems: Emblem[] = [
  { key: "tank-emblem", role: "Tank", name: "Emblème de tank", bonus: "PV et résistances", bestFor: "Tanks d'engagement et tanks de lane d'expérience." },
  { key: "fighter-emblem", role: "Fighter", name: "Emblème de combattant", bonus: "Dégâts d'attaque et vol de vie", bestFor: "Combattants de lane d'expérience qui doivent gagner leur duel." },
  { key: "assassin-emblem", role: "Assassin", name: "Emblème d'assassin", bonus: "Dégâts d'attaque et pénétration physique", bestFor: "Jungleurs physiques et assassins." },
  { key: "mage-emblem", role: "Mage", name: "Emblème de mage", bonus: "Puissance magique et pénétration magique", bestFor: "Mages de la lane du milieu." },
  { key: "marksman-emblem", role: "Marksman", name: "Emblème de tireur", bonus: "Vitesse d'attaque et dégâts d'attaque", bestFor: "Tireurs de la lane d'or." },
  { key: "support-emblem", role: "Support", name: "Emblème de soutien", bonus: "Réduction de recharge et vitesse de déplacement", bestFor: "Soutiens et roamers non tanks." },
];

/** "tank-emblem" becomes "tank": the /emblems/tank address does not repeat the word. */
export const slugEmblem = (e: Emblem) => e.key.replace(/-emblem$/, "");

export interface Talent {
  key: string;
  name: string;
  /** Roles for which this talent is a sound choice. */
  roles: Role[];
  /** Decisive talents are those of the last tier. */
  decisive: boolean;
  description: string;
  bestFor: string;
}

export const talents: Talent[] = [
  // ── Attributes ───────────────────────────────────────────────────────────
  { key: "agility", name: "Agility", decisive: false, description: "Augmente la vitesse de déplacement.", bestFor: "Roamers et héros qui doivent tourner vite sur la carte.", roles: ["Support", "Tank"] },
  { key: "swift", name: "Swift", decisive: false, description: "Augmente la vitesse d'attaque.", bestFor: "Tireurs et combattants à attaques de base.", roles: ["Marksman", "Fighter"] },
  { key: "vitality", name: "Vitality", decisive: false, description: "Augmente les PV maximum.", bestFor: "Tanks et combattants.", roles: ["Tank", "Fighter"] },
  { key: "fatal", name: "Fatal", decisive: false, description: "Augmente le taux de coup critique.", bestFor: "Tireurs et assassins à critique.", roles: ["Marksman", "Assassin"] },
  { key: "firmness", name: "Firmness", decisive: false, description: "Augmente les résistances physique et magique.", bestFor: "Tanks face à des dégâts mixtes.", roles: ["Tank"] },
  { key: "thrill", name: "Thrill", decisive: false, description: "Augmente les dégâts d'attaque et la puissance magique.", bestFor: "Porteurs de dégâts, quel que soit le type.", roles: ["Mage", "Assassin", "Marksman", "Fighter"] },
  { key: "tenacity", name: "Tenacity", decisive: false, description: "Augmente les résistances quand les PV sont bas.", bestFor: "Tanks face à une composition explosive.", roles: ["Tank"] },
  { key: "seasoned-hunter", name: "Seasoned Hunter", decisive: false, description: "Augmente les dégâts infligés aux monstres de jungle.", bestFor: "Jungleurs, pour sécuriser les objectifs.", roles: ["Assassin", "Fighter"] },
  { key: "master-assassin", name: "Master Assassin", decisive: false, description: "Augmente les dégâts contre une cible isolée.", bestFor: "Assassins qui cherchent le duel.", roles: ["Assassin"] },
  { key: "weakness-finder", name: "Weakness Finder", decisive: false, description: "Les attaques de base ralentissent la cible.", bestFor: "Combattants sans contrôle propre.", roles: ["Fighter", "Marksman"] },

  // ── Decisive talents ────────────────────────────────────────────────────
  { key: "impure-rage", name: "Impure Rage", decisive: true, description: "La prochaine compétence inflige des dégâts supplémentaires et restaure de la mana.", bestFor: "Mages à compétences fréquentes.", roles: ["Mage"] },
  { key: "quantum-charge", name: "Quantum Charge", decisive: true, description: "Les dégâts de compétence accélèrent et soignent.", bestFor: "Héros qui doivent rester mobiles en combat.", roles: ["Fighter", "Mage"] },
  { key: "weapon-master", name: "Weapon Master", decisive: true, description: "Augmente tous les bonus d'attaque reçus des objets.", bestFor: "Combattants dont les dégâts viennent des compétences.", roles: ["Fighter"] },
  { key: "lethal-ignition", name: "Lethal Ignition", decisive: true, description: "Inflige des dégâts supplémentaires à une cible fortement blessée.", bestFor: "Porteurs qui doivent conclure vite.", roles: ["Assassin", "Marksman", "Mage"] },
  { key: "concussive-blast", name: "Concussive Blast", decisive: true, description: "Inflige des dégâts de zone basés sur les PV maximum.", bestFor: "Tanks d'engagement : Tigreal, Khufra, Atlas.", roles: ["Tank"] },
  { key: "wilderness-blessing", name: "Wilderness Blessing", decisive: true, description: "Augmente la vitesse de déplacement hors combat et dans l'herbe.", bestFor: "Roamers qui vivent dans les buissons, comme Franco.", roles: ["Support", "Tank"] },
  { key: "focusing-mark", name: "Focusing Mark", decisive: true, description: "Les cibles touchées subissent davantage de dégâts des alliés.", bestFor: "Soutiens et tanks qui jouent pour leur porteur.", roles: ["Support", "Tank"] },
  { key: "brave-smite", name: "Brave Smite", decisive: true, description: "Toucher un ennemi avec une compétence restaure des PV.", bestFor: "Combattants de lane d'expérience.", roles: ["Fighter"] },
  { key: "killing-spree", name: "Killing Spree", decisive: true, description: "Une élimination restaure des PV et accélère.", bestFor: "Assassins qui enchaînent les cibles.", roles: ["Assassin"] },
  { key: "festival-of-blood", name: "Festival of Blood", decisive: true, description: "Les dégâts de compétence appliquent un vol de vie.", bestFor: "Mages de combat prolongé.", roles: ["Mage"] },
  { key: "bargain-hunter", name: "Bargain Hunter", decisive: true, description: "Réduit le prix des objets.", bestFor: "Roamers, dont le revenu est le plus faible de l'équipe.", roles: ["Support", "Tank"] },
  { key: "pull-yourself-together", name: "Pull Yourself Together", decisive: true, description: "Réduit la recharge des sorts de combat et des objets actifs.", bestFor: "Héros dont le Flicker décide des combats.", roles: ["Tank", "Support", "Fighter"] },
];

export interface BattleSpell {
  key: string;
  name: string;
  /** Roles for which this spell is a sound choice. */
  roles: Role[];
  cooldown: number;
  description: string;
  bestFor: string;
}

export const battleSpells: BattleSpell[] = [
  { key: "flicker", name: "Flicker", cooldown: 120, description: "Téléporte le héros sur une courte distance.", bestFor: "Presque tout le monde : engagement, fuite, annulation d'animation.", roles: ["Tank", "Mage", "Support", "Fighter", "Assassin", "Marksman"] },
  { key: "execute", name: "Execute", cooldown: 60, description: "Inflige des dégâts basés sur les PV manquants de la cible.", bestFor: "Jungleurs et assassins qui doivent conclure.", roles: ["Assassin", "Fighter", "Mage"] },
  { key: "retribution", name: "Retribution", cooldown: 35, description: "Inflige des dégâts importants à un monstre et renforce le nettoyage de jungle.", bestFor: "Obligatoire sur le jungleur.", roles: ["Assassin", "Fighter", "Marksman"] },
  { key: "purify", name: "Purify", cooldown: 90, description: "Retire les effets de contrôle et immunise brièvement.", bestFor: "Porteurs visés par un contrôle unique : contre Chou, Franco, Kaja.", roles: ["Marksman", "Mage", "Fighter"] },
  { key: "inspire", name: "Inspire", cooldown: 75, description: "Augmente fortement la vitesse d'attaque et ignore une partie de l'armure.", bestFor: "Tireurs à attaques de base.", roles: ["Marksman"] },
  { key: "sprint", name: "Sprint", cooldown: 100, description: "Augmente la vitesse de déplacement et retire les ralentissements.", bestFor: "Héros sans mobilité qui doivent se repositionner.", roles: ["Marksman", "Mage"] },
  { key: "petrify", name: "Petrify", cooldown: 60, description: "Ralentit puis immobilise les ennemis proches.", bestFor: "Tanks sans contrôle fiable.", roles: ["Tank", "Support"] },
  { key: "arrival", name: "Arrival", cooldown: 90, description: "Téléporte le héros vers une tourelle ou un sbire allié.", bestFor: "Lanes solo qui doivent revenir vite après un retour à la base.", roles: ["Fighter", "Tank"] },
  { key: "vengeance", name: "Vengeance", cooldown: 75, description: "Renvoie une partie des dégâts subis pendant la durée.", bestFor: "Combattants de lane d'expérience.", roles: ["Fighter", "Tank"] },
  { key: "aegis", name: "Aegis", cooldown: 75, description: "Accorde un bouclier à soi-même et aux alliés proches.", bestFor: "Soutiens et tanks protecteurs.", roles: ["Support", "Tank"] },
  { key: "revitalize", name: "Revitalize", cooldown: 60, description: "Crée une zone qui soigne les alliés présents.", bestFor: "Soutiens face à des dégâts étalés dans le temps.", roles: ["Support"] },
];
