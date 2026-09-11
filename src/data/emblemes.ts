import type { Role } from "@/lib/types";

/**
 * Emblemes, talents et sorts de combat.
 *
 * Le wiki n'expose aucun module de donnees pour eux : cette liste est ecrite a
 * la main. Les noms sont ceux du jeu en anglais, ce qui n'est pas un choix
 * esthetique — c'est la cle qui relie chaque entree a son visuel, resolu par
 * la synchronisation (`src/data/jeu/visuels.json`).
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
  { cle: "tank-emblem", role: "Tank", nom: "Emblème de tank", bonus: "PV et résistances", pourQui: "Tanks d'engagement et tanks de lane d'expérience." },
  { cle: "fighter-emblem", role: "Fighter", nom: "Emblème de combattant", bonus: "Dégâts d'attaque et vol de vie", pourQui: "Combattants de lane d'expérience qui doivent gagner leur duel." },
  { cle: "assassin-emblem", role: "Assassin", nom: "Emblème d'assassin", bonus: "Dégâts d'attaque et pénétration physique", pourQui: "Jungleurs physiques et assassins." },
  { cle: "mage-emblem", role: "Mage", nom: "Emblème de mage", bonus: "Puissance magique et pénétration magique", pourQui: "Mages de la lane du milieu." },
  { cle: "marksman-emblem", role: "Marksman", nom: "Emblème de tireur", bonus: "Vitesse d'attaque et dégâts d'attaque", pourQui: "Tireurs de la lane d'or." },
  { cle: "support-emblem", role: "Support", nom: "Emblème de soutien", bonus: "Réduction de recharge et vitesse de déplacement", pourQui: "Soutiens et roamers non tanks." },
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
  { cle: "agility", nom: "Agility", decisif: false, description: "Augmente la vitesse de déplacement.", pourQui: "Roamers et héros qui doivent tourner vite sur la carte.", roles: ["Support", "Tank"] },
  { cle: "swift", nom: "Swift", decisif: false, description: "Augmente la vitesse d'attaque.", pourQui: "Tireurs et combattants à attaques de base.", roles: ["Marksman", "Fighter"] },
  { cle: "vitality", nom: "Vitality", decisif: false, description: "Augmente les PV maximum.", pourQui: "Tanks et combattants.", roles: ["Tank", "Fighter"] },
  { cle: "fatal", nom: "Fatal", decisif: false, description: "Augmente le taux de coup critique.", pourQui: "Tireurs et assassins à critique.", roles: ["Marksman", "Assassin"] },
  { cle: "firmness", nom: "Firmness", decisif: false, description: "Augmente les résistances physique et magique.", pourQui: "Tanks face à des dégâts mixtes.", roles: ["Tank"] },
  { cle: "thrill", nom: "Thrill", decisif: false, description: "Augmente les dégâts d'attaque et la puissance magique.", pourQui: "Porteurs de dégâts, quel que soit le type.", roles: ["Mage", "Assassin", "Marksman", "Fighter"] },
  { cle: "tenacity", nom: "Tenacity", decisif: false, description: "Augmente les résistances quand les PV sont bas.", pourQui: "Tanks face à une composition explosive.", roles: ["Tank"] },
  { cle: "seasoned-hunter", nom: "Seasoned Hunter", decisif: false, description: "Augmente les dégâts infligés aux monstres de jungle.", pourQui: "Jungleurs, pour sécuriser les objectifs.", roles: ["Assassin", "Fighter"] },
  { cle: "master-assassin", nom: "Master Assassin", decisif: false, description: "Augmente les dégâts contre une cible isolée.", pourQui: "Assassins qui cherchent le duel.", roles: ["Assassin"] },
  { cle: "weakness-finder", nom: "Weakness Finder", decisif: false, description: "Les attaques de base ralentissent la cible.", pourQui: "Combattants sans contrôle propre.", roles: ["Fighter", "Marksman"] },

  // ── Talents decisifs ─────────────────────────────────────────────────────
  { cle: "impure-rage", nom: "Impure Rage", decisif: true, description: "La prochaine compétence inflige des dégâts supplémentaires et restaure de la mana.", pourQui: "Mages à compétences fréquentes.", roles: ["Mage"] },
  { cle: "quantum-charge", nom: "Quantum Charge", decisif: true, description: "Les dégâts de compétence accélèrent et soignent.", pourQui: "Héros qui doivent rester mobiles en combat.", roles: ["Fighter", "Mage"] },
  { cle: "weapon-master", nom: "Weapon Master", decisif: true, description: "Augmente tous les bonus d'attaque reçus des objets.", pourQui: "Combattants dont les dégâts viennent des compétences.", roles: ["Fighter"] },
  { cle: "lethal-ignition", nom: "Lethal Ignition", decisif: true, description: "Inflige des dégâts supplémentaires à une cible fortement blessée.", pourQui: "Porteurs qui doivent conclure vite.", roles: ["Assassin", "Marksman", "Mage"] },
  { cle: "concussive-blast", nom: "Concussive Blast", decisif: true, description: "Inflige des dégâts de zone basés sur les PV maximum.", pourQui: "Tanks d'engagement : Tigreal, Khufra, Atlas.", roles: ["Tank"] },
  { cle: "wilderness-blessing", nom: "Wilderness Blessing", decisif: true, description: "Augmente la vitesse de déplacement hors combat et dans l'herbe.", pourQui: "Roamers qui vivent dans les buissons, comme Franco.", roles: ["Support", "Tank"] },
  { cle: "focusing-mark", nom: "Focusing Mark", decisif: true, description: "Les cibles touchées subissent davantage de dégâts des alliés.", pourQui: "Soutiens et tanks qui jouent pour leur porteur.", roles: ["Support", "Tank"] },
  { cle: "brave-smite", nom: "Brave Smite", decisif: true, description: "Toucher un ennemi avec une compétence restaure des PV.", pourQui: "Combattants de lane d'expérience.", roles: ["Fighter"] },
  { cle: "killing-spree", nom: "Killing Spree", decisif: true, description: "Une élimination restaure des PV et accélère.", pourQui: "Assassins qui enchaînent les cibles.", roles: ["Assassin"] },
  { cle: "festival-of-blood", nom: "Festival of Blood", decisif: true, description: "Les dégâts de compétence appliquent un vol de vie.", pourQui: "Mages de combat prolongé.", roles: ["Mage"] },
  { cle: "bargain-hunter", nom: "Bargain Hunter", decisif: true, description: "Réduit le prix des objets.", pourQui: "Roamers, dont le revenu est le plus faible de l'équipe.", roles: ["Support", "Tank"] },
  { cle: "pull-yourself-together", nom: "Pull Yourself Together", decisif: true, description: "Réduit la recharge des sorts de combat et des objets actifs.", pourQui: "Héros dont le Flicker décide des combats.", roles: ["Tank", "Support", "Fighter"] },
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
  { cle: "flicker", nom: "Flicker", recharge: 120, description: "Téléporte le héros sur une courte distance.", pourQui: "Presque tout le monde : engagement, fuite, annulation d'animation.", roles: ["Tank", "Mage", "Support", "Fighter", "Assassin", "Marksman"] },
  { cle: "execute", nom: "Execute", recharge: 60, description: "Inflige des dégâts basés sur les PV manquants de la cible.", pourQui: "Jungleurs et assassins qui doivent conclure.", roles: ["Assassin", "Fighter", "Mage"] },
  { cle: "retribution", nom: "Retribution", recharge: 35, description: "Inflige des dégâts importants à un monstre et renforce le nettoyage de jungle.", pourQui: "Obligatoire sur le jungleur.", roles: ["Assassin", "Fighter", "Marksman"] },
  { cle: "purify", nom: "Purify", recharge: 90, description: "Retire les effets de contrôle et immunise brièvement.", pourQui: "Porteurs visés par un contrôle unique : contre Chou, Franco, Kaja.", roles: ["Marksman", "Mage", "Fighter"] },
  { cle: "inspire", nom: "Inspire", recharge: 75, description: "Augmente fortement la vitesse d'attaque et ignore une partie de l'armure.", pourQui: "Tireurs à attaques de base.", roles: ["Marksman"] },
  { cle: "sprint", nom: "Sprint", recharge: 100, description: "Augmente la vitesse de déplacement et retire les ralentissements.", pourQui: "Héros sans mobilité qui doivent se repositionner.", roles: ["Marksman", "Mage"] },
  { cle: "petrify", nom: "Petrify", recharge: 60, description: "Ralentit puis immobilise les ennemis proches.", pourQui: "Tanks sans contrôle fiable.", roles: ["Tank", "Support"] },
  { cle: "arrival", nom: "Arrival", recharge: 90, description: "Téléporte le héros vers une tourelle ou un sbire allié.", pourQui: "Lanes solo qui doivent revenir vite après un retour à la base.", roles: ["Fighter", "Tank"] },
  { cle: "vengeance", nom: "Vengeance", recharge: 75, description: "Renvoie une partie des dégâts subis pendant la durée.", pourQui: "Combattants de lane d'expérience.", roles: ["Fighter", "Tank"] },
  { cle: "aegis", nom: "Aegis", recharge: 75, description: "Accorde un bouclier à soi-même et aux alliés proches.", pourQui: "Soutiens et tanks protecteurs.", roles: ["Support", "Tank"] },
  { cle: "revitalize", nom: "Revitalize", recharge: 60, description: "Crée une zone qui soigne les alliés présents.", pourQui: "Soutiens face à des dégâts étalés dans le temps.", roles: ["Support"] },
];
