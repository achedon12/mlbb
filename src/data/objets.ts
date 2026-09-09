import type { Objet } from "@/lib/types";

/**
 * Objets de la boutique.
 *
 * Les prix et les valeurs changent a chaque patch : ils sont donnes a titre
 * indicatif et le champ `usage` explique surtout *quand* prendre l'objet, ce
 * qui vieillit beaucoup mieux qu'un chiffre.
 */
export const objets: Objet[] = [
  // ── Attaque ──────────────────────────────────────────────────────────────
  {
    slug: "hache-sanglante",
    nom: "Hache sanglante",
    categorie: "Attaque",
    prix: 2020,
    statistiques: { "Degats d'attaque": "+70", "Vol de vie": "+20%", "PV": "+500" },
    passif: {
      nom: "Soif de sang",
      description:
        "Tuer un ennemi restaure une part importante des points de vie manquants et augmente la vitesse de deplacement.",
    },
    usage:
      "Le premier objet par defaut de presque tous les combattants et assassins : il resout le probleme de survie sans sacrifier les degats.",
  },
  {
    slug: "lame-ailee",
    nom: "Lame ailee",
    categorie: "Attaque",
    prix: 2050,
    statistiques: { "Degats d'attaque": "+30", "PV": "+900", "Vol de vie": "+10%" },
    passif: {
      nom: "Survivant",
      description:
        "Sous un certain seuil de vie, reduit fortement la duree des effets de controle subis.",
    },
    usage:
      "A prendre des que l'equipe adverse aligne deux sources de controle ou plus. C'est l'objet qui permet a un porteur de survivre a l'engagement.",
  },
  {
    slug: "malefice",
    nom: "Malefice",
    categorie: "Attaque",
    prix: 1990,
    statistiques: { "Degats d'attaque": "+60", "Penetration physique": "+40" },
    passif: {
      nom: "Perforation",
      description: "Ignore une partie de l'armure de la cible, proportionnellement a son armure totale.",
    },
    usage:
      "Contre les compositions avec deux tanks ou plus. Inutile face a une equipe fragile, ou la penetration plate est plus rentable.",
  },
  {
    slug: "faucheuse",
    nom: "Faucheuse",
    categorie: "Attaque",
    prix: 2270,
    statistiques: { "Degats d'attaque": "+80", "Chance de critique": "+25%" },
    passif: {
      nom: "Execution",
      description: "Les coups critiques infligent des degats supplementaires bases sur les PV manquants de la cible.",
    },
    usage:
      "Objet de finition pour les tireurs et assassins a critique. Ne se prend jamais en premier objet.",
  },
  {
    slug: "lame-du-berserker",
    nom: "Lame du berserker",
    categorie: "Attaque",
    prix: 2200,
    statistiques: { "Degats d'attaque": "+65", "Chance de critique": "+25%" },
    passif: {
      nom: "Furie",
      description: "Un coup critique augmente les degats d'attaque et la vitesse de deplacement pendant quelques secondes.",
    },
    usage:
      "Le socle des tireurs a critique. Se prend tot pour enclencher la montee en puissance.",
  },
  {
    slug: "danseuse-des-vents",
    nom: "Danseuse des vents",
    categorie: "Attaque",
    prix: 1900,
    statistiques: { "Degats d'attaque": "+30", "Vitesse d'attaque": "+30%", "Chance de critique": "+20%" },
    usage:
      "Complete la Lame du berserker. Pris ensemble, les deux objets fixent le rythme d'un tireur classique.",
  },
  {
    slug: "griffe-endiablee",
    nom: "Griffe endiablee",
    categorie: "Attaque",
    prix: 2050,
    statistiques: { "Vitesse d'attaque": "+45%", "Vol de vie": "+15%" },
    passif: {
      nom: "Deferlante",
      description: "Les attaques de base ignorent une partie de l'armure de la cible.",
    },
    usage:
      "Pour les tireurs dont les degats passent par les attaques de base plutot que par les competences.",
  },

  // ── Magie ────────────────────────────────────────────────────────────────
  {
    slug: "baton-divin",
    nom: "Baton divin",
    categorie: "Magie",
    prix: 2120,
    statistiques: { "Puissance magique": "+70" },
    passif: {
      nom: "Devastation",
      description: "Les degats magiques infliges augmentent en fonction des PV maximum de la cible.",
    },
    usage:
      "L'objet de mage contre les tanks. Contre une equipe fragile, un objet de penetration rapporte davantage.",
  },
  {
    slug: "talisman-de-glace",
    nom: "Talisman de glace",
    categorie: "Magie",
    prix: 2180,
    statistiques: { "Puissance magique": "+60", "PV": "+400", "Reduction de recharge": "+10%" },
    passif: {
      nom: "Gel",
      description: "Les degats magiques ralentissent la cible et reduisent sa vitesse d'attaque.",
    },
    usage:
      "Presque systematique sur les mages : le ralentissement transforme des degats de zone en controle de zone.",
  },
  {
    slug: "sceptre-sanglant",
    nom: "Sceptre sanglant",
    categorie: "Magie",
    prix: 2280,
    statistiques: { "Puissance magique": "+70", "PV": "+800", "Vol de vie magique": "+20%" },
    usage:
      "Pour les mages qui restent en combat plutot que de frapper de loin : Cecilion, Esmeralda, Alice.",
  },
  {
    slug: "anneau-de-flamme-sacree",
    nom: "Anneau de flamme sacree",
    categorie: "Magie",
    prix: 2150,
    statistiques: { "Puissance magique": "+75", "Penetration magique": "+40" },
    usage:
      "L'equivalent magique du Malefice. Se prend des que l'adversaire achete de la resistance magique.",
  },
  {
    slug: "sablier-de-kadita",
    nom: "Sablier de Kadita",
    categorie: "Magie",
    prix: 2050,
    statistiques: { "Puissance magique": "+60", "Reduction de recharge": "+10%", "Mana": "+100" },
    passif: {
      nom: "Suspension",
      description: "Rend brievement invulnerable et immobile, en annulant les degats subis pendant l'effet.",
    },
    usage:
      "L'objet de survie des mages fragiles. Permet d'absorber une execution ou d'attendre l'arrivee de l'equipe.",
  },

  // ── Defense ──────────────────────────────────────────────────────────────
  {
    slug: "trepas-immortel",
    nom: "Trepas immortel",
    categorie: "Defense",
    prix: 2120,
    statistiques: { "PV": "+800", "Armure": "+40" },
    passif: {
      nom: "Immortel",
      description: "A la mort, ressuscite avec une partie de ses PV et un bouclier temporaire.",
    },
    usage:
      "Le meilleur rapport survie/prix du jeu pour un initiateur. Se prend tot sur les tanks d'engagement.",
  },
  {
    slug: "bouclier-d-athena",
    nom: "Bouclier d'Athena",
    categorie: "Defense",
    prix: 2170,
    statistiques: { "PV": "+900", "Resistance magique": "+52", "Regeneration de PV": "+10" },
    passif: {
      nom: "Bouclier",
      description: "Genere periodiquement un bouclier qui absorbe des degats magiques.",
    },
    usage: "Reponse standard a un mage adverse qui prend l'ascendant.",
  },
  {
    slug: "armure-antique",
    nom: "Armure antique",
    categorie: "Defense",
    prix: 1920,
    statistiques: { "PV": "+900", "Armure": "+52" },
    passif: {
      nom: "Endurcissement",
      description: "Reduit les degats subis par les attaques consecutives d'une meme source.",
    },
    usage:
      "Contre les tireurs et les combattants a attaques rapides. Faible contre les degats en un coup.",
  },
  {
    slug: "blade-armor",
    nom: "Armure de lames",
    categorie: "Defense",
    prix: 1910,
    statistiques: { "Armure": "+70" },
    passif: {
      nom: "Renvoi",
      description: "Renvoie une partie des degats physiques d'attaque de base a l'attaquant.",
    },
    usage:
      "Se prend specifiquement contre un tireur ou un assassin physique qui domine la partie.",
  },
  {
    slug: "cape-de-radiance",
    nom: "Cape de Radiance",
    categorie: "Defense",
    prix: 1850,
    statistiques: { "Resistance magique": "+56", "Vitesse de deplacement": "+6%" },
    passif: {
      nom: "Absorption",
      description: "Reduit les degats magiques continus subis.",
    },
    usage: "Contre les mages a degats etales dans le temps plutot qu'a explosion.",
  },
  {
    slug: "guardian-helmet",
    nom: "Casque du gardien",
    categorie: "Defense",
    prix: 2000,
    statistiques: { "PV": "+1550", "Regeneration de PV": "+20" },
    passif: {
      nom: "Recuperation",
      description: "Regenere une part des PV maximum par seconde hors combat.",
    },
    usage:
      "Permet a un tank de rester sur la carte sans rentrer a la base. Tres fort en phase de rotation.",
  },
  {
    slug: "oracle",
    nom: "Oracle",
    categorie: "Defense",
    prix: 2000,
    statistiques: { "PV": "+900", "Resistance magique": "+36", "Reduction de recharge": "+10%" },
    passif: {
      nom: "Purification",
      description: "Augmente l'efficacite des boucliers et des soins recus.",
    },
    usage: "Sur les heros qui generent leurs propres boucliers, ou aux cotes d'un Estes.",
  },
  {
    slug: "ceinture-du-guerrier",
    nom: "Ceinture du guerrier",
    categorie: "Defense",
    prix: 900,
    statistiques: { "PV": "+250", "Armure": "+30" },
    usage:
      "Objet intermediaire bon marche, souvent conserve tel quel jusqu'a la fin de partie sur un combattant.",
  },

  // ── Mouvement ────────────────────────────────────────────────────────────
  {
    slug: "bottes-de-guerre",
    nom: "Bottes de guerre",
    categorie: "Mouvement",
    prix: 710,
    statistiques: { "Vitesse de deplacement": "+40", "Armure": "+22" },
    usage: "Bottes par defaut des tanks contre une equipe a dominante physique.",
  },
  {
    slug: "bottes-en-cuir",
    nom: "Bottes en cuir",
    categorie: "Mouvement",
    prix: 710,
    statistiques: { "Vitesse de deplacement": "+40", "Resistance magique": "+22" },
    usage: "Bottes par defaut contre une equipe a dominante magique.",
  },
  {
    slug: "bottes-de-chasse",
    nom: "Bottes de chasse",
    categorie: "Mouvement",
    prix: 710,
    statistiques: { "Vitesse de deplacement": "+40", "Penetration physique": "+15" },
    usage: "Bottes des tireurs, assassins et combattants physiques.",
  },
  {
    slug: "bottes-magiques",
    nom: "Bottes magiques",
    categorie: "Mouvement",
    prix: 710,
    statistiques: { "Vitesse de deplacement": "+40", "Penetration magique": "+15" },
    usage: "Bottes de tous les mages, sauf besoin defensif specifique.",
  },
  {
    slug: "bottes-oracles",
    nom: "Bottes oracles",
    categorie: "Mouvement",
    prix: 710,
    statistiques: { "Vitesse de deplacement": "+40", "Reduction de recharge": "+10%" },
    usage:
      "Pour les soutiens et les mages a competences frequentes : plus d'ultimes lances sur la duree.",
  },
];

export const objetsParSlug = new Map(objets.map((o) => [o.slug, o]));
