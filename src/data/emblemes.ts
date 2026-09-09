import type { Role } from "@/lib/types";

/**
 * Emblemes, talents et sorts de combat.
 *
 * Le wiki n'expose aucun module de donnees pour eux : cette liste est ecrite a
 * la main. Les noms sont ceux du jeu en anglais, ce qui n'est pas un choix
 * esthetique — c'est la cle qui relie chaque entree a son visuel, resolu par
 * la synchronisation (`src/data/genere/visuels-*.json`).
 *
 * Le champ `pourQui` est de l'analyse : il dit a qui l'option s'adresse
 * reellement, ce qu'une description d'effet ne dit jamais.
 */
export interface Embleme {
  /** Cle du visuel, et nom exact dans le jeu. */
  cle: string;
  /** Role auquel cet embleme correspond. */
  role: Role;
  nom: string;
  bonus: string;
  pourQui: string;
}

export const emblemes: Embleme[] = [
  { cle: "tank-emblem", role: "Tank", nom: "Embleme de tank", bonus: "PV et resistances", pourQui: "Tanks d'engagement et tanks de lane d'experience." },
  { cle: "fighter-emblem", role: "Fighter", nom: "Embleme de combattant", bonus: "Degats d'attaque et vol de vie", pourQui: "Combattants de lane d'experience qui doivent gagner leur duel." },
  { cle: "assassin-emblem", role: "Assassin", nom: "Embleme d'assassin", bonus: "Degats d'attaque et penetration physique", pourQui: "Jungleurs physiques et assassins." },
  { cle: "mage-emblem", role: "Mage", nom: "Embleme de mage", bonus: "Puissance magique et penetration magique", pourQui: "Mages de la lane du milieu." },
  { cle: "marksman-emblem", role: "Marksman", nom: "Embleme de tireur", bonus: "Vitesse d'attaque et degats d'attaque", pourQui: "Tireurs de la lane d'or." },
  { cle: "support-emblem", role: "Support", nom: "Embleme de soutien", bonus: "Reduction de recharge et vitesse de deplacement", pourQui: "Soutiens et roamers non tanks." },
];

export interface Talent {
  cle: string;
  nom: string;
  /** Roles pour lesquels ce talent est un choix defendable. */
  roles: Role[];
  /** Les talents decisifs sont ceux du dernier etage. */
  decisif: boolean;
  description: string;
  pourQui: string;
}

export const talents: Talent[] = [
  // ── Attributs ────────────────────────────────────────────────────────────
  { cle: "agility", nom: "Agility", decisif: false, description: "Augmente la vitesse de deplacement.", pourQui: "Roamers et heros qui doivent tourner vite sur la carte.", roles: ["Support", "Tank"] },
  { cle: "swift", nom: "Swift", decisif: false, description: "Augmente la vitesse d'attaque.", pourQui: "Tireurs et combattants a attaques de base.", roles: ["Marksman", "Fighter"] },
  { cle: "vitality", nom: "Vitality", decisif: false, description: "Augmente les PV maximum.", pourQui: "Tanks et combattants.", roles: ["Tank", "Fighter"] },
  { cle: "fatal", nom: "Fatal", decisif: false, description: "Augmente le taux de coup critique.", pourQui: "Tireurs et assassins a critique.", roles: ["Marksman", "Assassin"] },
  { cle: "firmness", nom: "Firmness", decisif: false, description: "Augmente les resistances physique et magique.", pourQui: "Tanks face a des degats mixtes.", roles: ["Tank"] },
  { cle: "thrill", nom: "Thrill", decisif: false, description: "Augmente les degats d'attaque et la puissance magique.", pourQui: "Porteurs de degats, quel que soit le type.", roles: ["Mage", "Assassin", "Marksman", "Fighter"] },
  { cle: "tenacity", nom: "Tenacity", decisif: false, description: "Augmente les resistances quand les PV sont bas.", pourQui: "Tanks face a une composition explosive.", roles: ["Tank"] },
  { cle: "seasoned-hunter", nom: "Seasoned Hunter", decisif: false, description: "Augmente les degats infliges aux monstres de jungle.", pourQui: "Jungleurs, pour securiser les objectifs.", roles: ["Assassin", "Fighter"] },
  { cle: "master-assassin", nom: "Master Assassin", decisif: false, description: "Augmente les degats contre une cible isolee.", pourQui: "Assassins qui cherchent le duel.", roles: ["Assassin"] },
  { cle: "weakness-finder", nom: "Weakness Finder", decisif: false, description: "Les attaques de base ralentissent la cible.", pourQui: "Combattants sans controle propre.", roles: ["Fighter", "Marksman"] },

  // ── Talents decisifs ─────────────────────────────────────────────────────
  { cle: "impure-rage", nom: "Impure Rage", decisif: true, description: "La prochaine competence inflige des degats supplementaires et restaure de la mana.", pourQui: "Mages a competences frequentes.", roles: ["Mage"] },
  { cle: "quantum-charge", nom: "Quantum Charge", decisif: true, description: "Les degats de competence accelerent et soignent.", pourQui: "Heros qui doivent rester mobiles en combat.", roles: ["Fighter", "Mage"] },
  { cle: "weapon-master", nom: "Weapon Master", decisif: true, description: "Augmente tous les bonus d'attaque recus des objets.", pourQui: "Combattants dont les degats viennent des competences.", roles: ["Fighter"] },
  { cle: "lethal-ignition", nom: "Lethal Ignition", decisif: true, description: "Inflige des degats supplementaires a une cible fortement blessee.", pourQui: "Porteurs qui doivent conclure vite.", roles: ["Assassin", "Marksman", "Mage"] },
  { cle: "concussive-blast", nom: "Concussive Blast", decisif: true, description: "Inflige des degats de zone bases sur les PV maximum.", pourQui: "Tanks d'engagement : Tigreal, Khufra, Atlas.", roles: ["Tank"] },
  { cle: "wilderness-blessing", nom: "Wilderness Blessing", decisif: true, description: "Augmente la vitesse de deplacement hors combat et dans l'herbe.", pourQui: "Roamers qui vivent dans les buissons, comme Franco.", roles: ["Support", "Tank"] },
  { cle: "focusing-mark", nom: "Focusing Mark", decisif: true, description: "Les cibles touchees subissent davantage de degats des allies.", pourQui: "Soutiens et tanks qui jouent pour leur porteur.", roles: ["Support", "Tank"] },
  { cle: "brave-smite", nom: "Brave Smite", decisif: true, description: "Toucher un ennemi avec une competence restaure des PV.", pourQui: "Combattants de lane d'experience.", roles: ["Fighter"] },
  { cle: "killing-spree", nom: "Killing Spree", decisif: true, description: "Une elimination restaure des PV et accelere.", pourQui: "Assassins qui enchainent les cibles.", roles: ["Assassin"] },
  { cle: "festival-of-blood", nom: "Festival of Blood", decisif: true, description: "Les degats de competence appliquent un vol de vie.", pourQui: "Mages de combat prolonge.", roles: ["Mage"] },
  { cle: "bargain-hunter", nom: "Bargain Hunter", decisif: true, description: "Reduit le prix des objets.", pourQui: "Roamers, dont le revenu est le plus faible de l'equipe.", roles: ["Support", "Tank"] },
  { cle: "pull-yourself-together", nom: "Pull Yourself Together", decisif: true, description: "Reduit la recharge des sorts de combat et des objets actifs.", pourQui: "Heros dont le Flicker decide des combats.", roles: ["Tank", "Support", "Fighter"] },
];

export interface SortDeCombat {
  cle: string;
  nom: string;
  /** Roles pour lesquels ce sort est un choix defendable. */
  roles: Role[];
  recharge: number;
  description: string;
  pourQui: string;
}

export const sortsDeCombat: SortDeCombat[] = [
  { cle: "flicker", nom: "Flicker", recharge: 120, description: "Teleporte le heros sur une courte distance.", pourQui: "Presque tout le monde : engagement, fuite, annulation d'animation.", roles: ["Tank", "Mage", "Support", "Fighter", "Assassin", "Marksman"] },
  { cle: "execute", nom: "Execute", recharge: 60, description: "Inflige des degats bases sur les PV manquants de la cible.", pourQui: "Jungleurs et assassins qui doivent conclure.", roles: ["Assassin", "Fighter", "Mage"] },
  { cle: "retribution", nom: "Retribution", recharge: 35, description: "Inflige des degats importants a un monstre et renforce le nettoyage de jungle.", pourQui: "Obligatoire sur le jungleur.", roles: ["Assassin", "Fighter", "Marksman"] },
  { cle: "purify", nom: "Purify", recharge: 90, description: "Retire les effets de controle et immunise brievement.", pourQui: "Porteurs vises par un controle unique : contre Chou, Franco, Kaja.", roles: ["Marksman", "Mage", "Fighter"] },
  { cle: "inspire", nom: "Inspire", recharge: 75, description: "Augmente fortement la vitesse d'attaque et ignore une partie de l'armure.", pourQui: "Tireurs a attaques de base.", roles: ["Marksman"] },
  { cle: "sprint", nom: "Sprint", recharge: 100, description: "Augmente la vitesse de deplacement et retire les ralentissements.", pourQui: "Heros sans mobilite qui doivent se repositionner.", roles: ["Marksman", "Mage"] },
  { cle: "petrify", nom: "Petrify", recharge: 60, description: "Ralentit puis immobilise les ennemis proches.", pourQui: "Tanks sans controle fiable.", roles: ["Tank", "Support"] },
  { cle: "arrival", nom: "Arrival", recharge: 90, description: "Teleporte le heros vers une tourelle ou un sbire allie.", pourQui: "Lanes solo qui doivent revenir vite apres un retour a la base.", roles: ["Fighter", "Tank"] },
  { cle: "vengeance", nom: "Vengeance", recharge: 75, description: "Renvoie une partie des degats subis pendant la duree.", pourQui: "Combattants de lane d'experience.", roles: ["Fighter", "Tank"] },
  { cle: "aegis", nom: "Aegis", recharge: 75, description: "Accorde un bouclier a soi-meme et aux allies proches.", pourQui: "Soutiens et tanks protecteurs.", roles: ["Support", "Tank"] },
  { cle: "revitalize", nom: "Revitalize", recharge: 60, description: "Cree une zone qui soigne les allies presents.", pourQui: "Soutiens face a des degats etales dans le temps.", roles: ["Support"] },
];
