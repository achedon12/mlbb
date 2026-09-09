/**
 * Emblemes et sorts de combat.
 *
 * Le systeme d'emblemes a ete unifie : un seul niveau partage, et des talents
 * choisis en trois etages. On decrit donc les etages plutot que d'anciennes
 * pages d'emblemes separees.
 */
export interface Talent {
  nom: string;
  etage: 1 | 2 | 3;
  description: string;
  /** Pour qui ce talent est reellement le bon choix. */
  pourQui: string;
}

export interface Embleme {
  slug: string;
  nom: string;
  bonus: string;
  pourQui: string;
}

export const emblemes: Embleme[] = [
  { slug: "tank", nom: "Embleme de tank", bonus: "PV et resistances", pourQui: "Tanks d'engagement et tanks de lane d'experience." },
  { slug: "combattant", nom: "Embleme de combattant", bonus: "Degats d'attaque et vol de vie", pourQui: "Combattants de lane d'experience qui doivent gagner leur duel." },
  { slug: "assassin", nom: "Embleme d'assassin", bonus: "Degats d'attaque et penetration physique", pourQui: "Jungleurs physiques et assassins." },
  { slug: "mage", nom: "Embleme de mage", bonus: "Puissance magique et penetration magique", pourQui: "Mages de la lane du milieu." },
  { slug: "tireur", nom: "Embleme de tireur", bonus: "Vitesse d'attaque et degats d'attaque", pourQui: "Tireurs de la lane d'or." },
  { slug: "soutien", nom: "Embleme de soutien", bonus: "Reduction de recharge et vitesse de deplacement", pourQui: "Soutiens et roamers non tanks." },
];

export const talents: Talent[] = [
  { nom: "Agilite", etage: 1, description: "Augmente la vitesse de deplacement.", pourQui: "Roamers et heros qui doivent tourner vite sur la carte." },
  { nom: "Vitalite", etage: 1, description: "Augmente les PV maximum.", pourQui: "Tanks et combattants." },
  { nom: "Cruaute", etage: 1, description: "Augmente les degats d'attaque et la puissance magique.", pourQui: "Porteurs de degats." },
  { nom: "Recuperation", etage: 2, description: "Ameliore la regeneration hors combat.", pourQui: "Lanes solo qui doivent tenir sans rentrer." },
  { nom: "Tenacite", etage: 2, description: "Augmente les resistances quand les PV sont bas.", pourQui: "Tanks face a une composition explosive." },
  { nom: "Colosse", etage: 2, description: "Genere un bouclier apres avoir subi des degats.", pourQui: "Initiateurs." },
  { nom: "Choc", etage: 3, description: "Le premier coup porte inflige des degats supplementaires bases sur les PV.", pourQui: "Tanks d'engagement : Tigreal, Khufra, Atlas." },
  { nom: "Festin", etage: 3, description: "Restaure des PV en infligeant des degats.", pourQui: "Combattants de lane d'experience." },
  { nom: "Chasseur", etage: 3, description: "Augmente les degats contre les monstres et la vitesse de nettoyage.", pourQui: "Jungleurs." },
  { nom: "Feu magique", etage: 3, description: "Les degats magiques brulent la cible sur la duree.", pourQui: "Mages a degats continus." },
  { nom: "Sauveur", etage: 3, description: "Renforce les boucliers et les soins accordes aux allies.", pourQui: "Soutiens et roamers protecteurs." },
];

export interface SortDeCombat {
  slug: string;
  nom: string;
  recharge: number;
  description: string;
  pourQui: string;
}

export const sortsDeCombat: SortDeCombat[] = [
  { slug: "flicker", nom: "Flicker", recharge: 120, description: "Teleporte le heros sur une courte distance.", pourQui: "Presque tout le monde : engagement, fuite, annulation d'animation." },
  { slug: "execution", nom: "Execution", recharge: 60, description: "Inflige des degats bases sur les PV manquants de la cible.", pourQui: "Jungleurs et assassins qui doivent conclure." },
  { slug: "vengeance", nom: "Vengeance", recharge: 75, description: "Renvoie une partie des degats subis pendant la duree.", pourQui: "Combattants de lane d'experience." },
  { slug: "purify", nom: "Purify", recharge: 90, description: "Retire les effets de controle et immunise brievement.", pourQui: "Porteurs vises par un controle unique : contre Chou, Franco, Kaja." },
  { slug: "inspiration", nom: "Inspiration", recharge: 75, description: "Augmente fortement la vitesse d'attaque et ignore une partie de l'armure.", pourQui: "Tireurs a attaques de base." },
  { slug: "sprint", nom: "Sprint", recharge: 100, description: "Augmente la vitesse de deplacement et retire les ralentissements.", pourQui: "Heros sans mobilite qui doivent se repositionner." },
  { slug: "retribution", nom: "Retribution", recharge: 35, description: "Inflige des degats importants a un monstre et renforce le nettoyage de jungle.", pourQui: "Obligatoire sur le jungleur." },
  { slug: "arrivee", nom: "Arrivee", recharge: 90, description: "Teleporte le heros vers une tourelle ou un sbire allie.", pourQui: "Lanes solo qui doivent revenir vite apres un retour a la base." },
  { slug: "petrification", nom: "Petrification", recharge: 60, description: "Ralentit puis immobilise les ennemis proches.", pourQui: "Tanks sans controle fiable." },
];
