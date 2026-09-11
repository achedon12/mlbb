import type { AnalyseHeros } from "@/lib/types";

/** Analyses des assassins. Donnees factuelles : voir la synchronisation. */
export const assassins: AnalyseHeros[] = [
  {
    slug: "lancelot",
    resume:
      "Assassin de jungle bati sur l'enchainement de dashs, avec une fenetre d'invulnerabilite pendant l'ultime.",
    analyse:
      "Lancelot traverse un combat plutot qu'il n'y entre. Sa competence 2 marque les cibles, sa competence 1 se recharge en frappant une cible marquee : bien enchaine, il peut dasher presque sans interruption tant qu'il touche quelque chose.\n\nSon ultime le rend invulnerable pendant l'animation, ce qui en fait aussi un outil defensif pour esquiver un controle ou une execution. Le heros est puni par tout ce qui bloque le deplacement — Khufra en tete — et par les zones qui l'empechent d'enchainer.",
    competences: [
      {
        type: "Passif",
        nom: "Sourire du soleil",
        description:
          "Ses degats augmentent brievement apres avoir esquive ou traverse un ennemi.",
      },
      {
        type: "Competence 1",
        nom: "Puncture",
        description:
          "Se deplace dans une direction en frappant les ennemis traverses. La recharge est reduite en touchant une cible marquee.",
        recharge: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5],
        cout: [40, 45, 50, 55, 60, 65],
      },
      {
        type: "Competence 2",
        nom: "Fente",
        description:
          "Projette une lame qui marque les ennemis touches et les ralentit.",
        recharge: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cout: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultime",
        nom: "Phantom Execution",
        description:
          "Enchaine une serie de frappes dans une zone en restant invulnerable pendant l'animation.",
        recharge: [40, 35, 30],
        cout: [120, 140, 160],
      },
    ],
    forces: [
      "Mobilite quasi continue en combat",
      "Invulnerabilite exploitable de facon defensive",
      "Nettoyage de jungle rapide",
    ],
    faiblesses: [
      "Totalement neutralise par le blocage de deplacement",
      "Fragile si l'enchainement s'interrompt",
      "Courbe d'apprentissage longue",
    ],
    fortContre: ["layla", "pharsa", "cecilion", "estes", "gord"],
    faibleContre: ["khufra", "franco", "phoveus", "minsitthar"],
    builds: [
      {
        nom: "Jungle standard",
        contexte:
          "Le build de reference : penetration puis un objet de survie pour tenir la deuxieme rotation.",
        objets: [
          "Swift Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Malefic Roar",
          "Blade of Despair",
          "Immortality",
        ],
        embleme: "Embleme d'assassin",
        talent: "Seasoned Hunter",
        sort: "Execution",
      },
    ],
  },
  {
    slug: "gusion",
    resume:
      "Assassin magique a combo : il pose ses dagues, se teleporte dessus, et les recupere pour infliger tous ses degats d'un coup.",
    analyse:
      "Gusion est le heros de combo le plus exigeant du jeu apres Fanny. Toutes ses competences peuvent etre relancees, et l'ordre comme le timing des relances determinent entierement ses degats. Le combo standard consiste a poser les dagues, se rapprocher par l'ultime, puis declencher la recuperation pour que tout arrive simultanement.\n\nUn Gusion maitrise supprime n'importe quelle cible fragile en moins d'une seconde, souvent avant que l'ecran adverse n'ait affiche quoi que ce soit. Un Gusion approximatif fait un tiers des degats et meurt sur place. Peu de heros ont un ecart aussi grand entre les deux.",
    competences: [
      {
        type: "Passif",
        nom: "Lame de dague",
        description:
          "Apres une competence, sa prochaine attaque de base inflige des degats supplementaires proportionnels a la vie manquante de la cible.",
      },
      {
        type: "Competence 1",
        nom: "Dagues de l'ombre",
        description:
          "Lance des dagues en eventail. Relancer la competence rappelle les dagues plantees, infligeant a nouveau des degats.",
        recharge: [11, 10.2, 9.4, 8.6, 7.8, 7],
        cout: [90, 95, 100, 105, 110, 115],
      },
      {
        type: "Competence 2",
        nom: "Frappe spectrale",
        description:
          "Projette une dague unique. Relancer la competence teleporte Gusion vers la dague.",
        recharge: [10, 9.4, 8.8, 8.2, 7.6, 7],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultime",
        nom: "Incandescence",
        description:
          "Recharge les deux competences et permet de se propulser vers une zone. Le point de depart de tout combo.",
        recharge: [45, 40, 35],
      },
    ],
    forces: [
      "Un des plus hauts pics de degats du jeu",
      "Mobilite extreme entre les dagues",
      "Impose une pression permanente sur la lane du milieu",
    ],
    faiblesses: [
      "Execution parmi les plus difficiles du roster",
      "Consommation de mana tres elevee",
      "Sans son ultime, ses degats s'effondrent",
    ],
    fortContre: ["layla", "lesley", "gord", "cecilion", "estes"],
    faibleContre: ["khufra", "franco", "belerick", "esmeralda"],
    builds: [
      {
        nom: "Jungle magique",
        contexte:
          "Penetration magique en priorite : Gusion vise les cibles fragiles, pas les tanks.",
        objets: [
          "Arcane Boots",
          "Enchanted Talisman",
          "Glowing Wand",
          "Concentrated Energy",
          "Winter Crown",
          "Divine Glaive",
        ],
        embleme: "Embleme d'assassin",
        talent: "Seasoned Hunter",
        sort: "Execution",
      },
    ],
  },
  {
    slug: "ling",
    resume:
      "Assassin qui se deplace sur les murs, hors de portee, et choisit son moment pour tomber sur une cible.",
    analyse:
      "Ling change la geometrie de la carte. Tant qu'il est sur un mur, il est intouchable par la plupart des competences au sol, ce qui lui permet d'attendre indefiniment l'ouverture. Il n'utilise pas de mana mais une ressource d'energie, ce qui limite le nombre de sauts consecutifs.\n\nSon ultime le rend insensible aux controles pendant le bond et inflige des degats critiques. Le heros est excellent en escarmouche mobile et faible face a une equipe groupee qui garde ses controles pour lui. Khufra reste sa reponse la plus nette.",
    competences: [
      {
        type: "Passif",
        nom: "Danse des nuages",
        description:
          "Ling peut grimper sur les murs et s'y deplacer rapidement, en regenerant son energie.",
      },
      {
        type: "Competence 1",
        nom: "Bond de l'ombre",
        description:
          "Saute vers un point, y compris sur un mur. Cout en energie, sans recharge tant que l'energie tient.",
        cout: [30, 30, 30, 30, 30, 30],
      },
      {
        type: "Competence 2",
        nom: "Epee de l'ombre",
        description:
          "Frappe les ennemis autour de lui et augmente sa vitesse d'attaque.",
        recharge: [8.5, 8, 7.5, 7, 6.5, 6],
        cout: [40, 40, 40, 40, 40, 40],
      },
      {
        type: "Ultime",
        nom: "Tourbillon de lames",
        description:
          "Bondit dans une zone en infligeant des degats critiques, insensible aux controles pendant le saut.",
        recharge: [45, 40, 35],
      },
    ],
    forces: [
      "Deplacement sur les murs, hors de portee au sol",
      "Choisit librement le moment de l'engagement",
      "Excellent en escarmouche et en vol d'objectif",
    ],
    faiblesses: [
      "Depend entierement de son energie",
      "Debut de partie lent avant deux objets",
      "Punie severement par les blocages de deplacement",
    ],
    fortContre: ["pharsa", "cecilion", "layla", "estes", "kimmy"],
    faibleContre: ["khufra", "franco", "minsitthar", "phoveus"],
    builds: [
      {
        nom: "Jungle critique",
        contexte:
          "Son ultime inflige des degats critiques : le taux de critique vaut plus que la penetration brute.",
        objets: [
          "Swift Boots",
          "Bloodlust Axe",
          "Berserker's Fury",
          "Windtalker",
          "Demon Hunter Sword",
          "Immortality",
        ],
        embleme: "Embleme d'assassin",
        talent: "Seasoned Hunter",
        sort: "Execution",
      },
    ],
  },
];
