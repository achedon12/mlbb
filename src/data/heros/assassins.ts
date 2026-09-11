import type { AnalyseHeros } from "@/lib/types";

/** Analyses des assassins. Donnees factuelles : voir la synchronisation. */
export const assassins: AnalyseHeros[] = [
  {
    slug: "lancelot",
    resume:
      "Assassin de jungle bâti sur l'enchaînement de dashs, avec une fenêtre d'invulnérabilité pendant l'ultime.",
    analyse:
      "Lancelot traverse un combat plutôt qu'il n'y entre. Sa compétence 2 marque les cibles, sa compétence 1 se recharge en frappant une cible marquée : bien enchaîné, il peut dasher presque sans interruption tant qu'il touche quelque chose.\n\nSon ultime le rend invulnérable pendant l'animation, ce qui en fait aussi un outil défensif pour esquiver un contrôle ou une exécution. Le héros est puni par tout ce qui bloque le déplacement — Khufra en tête — et par les zones qui l'empêchent d'enchaîner.",
    competences: [
      {
        type: "Passif",
        nom: "Sourire du soleil",
        description:
          "Ses dégâts augmentent brièvement après avoir esquivé ou traversé un ennemi.",
      },
      {
        type: "Competence 1",
        nom: "Puncture",
        description:
          "Se déplace dans une direction en frappant les ennemis traversés. La recharge est réduite en touchant une cible marquée.",
        recharge: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5],
        cout: [40, 45, 50, 55, 60, 65],
      },
      {
        type: "Competence 2",
        nom: "Fente",
        description:
          "Projette une lame qui marque les ennemis touchés et les ralentit.",
        recharge: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cout: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultime",
        nom: "Phantom Execution",
        description:
          "Enchaîne une série de frappes dans une zone en restant invulnérable pendant l'animation.",
        recharge: [40, 35, 30],
        cout: [120, 140, 160],
      },
    ],
    forces: [
      "Mobilité quasi continue en combat",
      "Invulnérabilité exploitable de façon défensive",
      "Nettoyage de jungle rapide",
    ],
    faiblesses: [
      "Totalement neutralisé par le blocage de déplacement",
      "Fragile si l'enchaînement s'interrompt",
      "Courbe d'apprentissage longue",
    ],
    fortContre: ["layla", "pharsa", "cecilion", "estes", "gord"],
    faibleContre: ["khufra", "franco", "phoveus", "minsitthar"],
    builds: [
      {
        nom: "Jungle standard",
        contexte:
          "Le build de référence : pénétration puis un objet de survie pour tenir la deuxième rotation.",
        objets: [
          "Swift Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Malefic Roar",
          "Blade of Despair",
          "Immortality",
        ],
        embleme: "Emblème d'assassin",
        talent: "Seasoned Hunter",
        sort: "Execution",
      },
    ],
  },
  {
    slug: "gusion",
    resume:
      "Assassin magique à combo : il pose ses dagues, se téléporte dessus, et les récupère pour infliger tous ses dégâts d'un coup.",
    analyse:
      "Gusion est le héros de combo le plus exigeant du jeu après Fanny. Toutes ses compétences peuvent être relancées, et l'ordre comme le timing des relances déterminent entièrement ses dégâts. Le combo standard consiste à poser les dagues, se rapprocher par l'ultime, puis déclencher la récupération pour que tout arrive simultanément.\n\nUn Gusion maîtrisé supprime n'importe quelle cible fragile en moins d'une seconde, souvent avant que l'écran adverse n'ait affiché quoi que ce soit. Un Gusion approximatif fait un tiers des dégâts et meurt sur place. Peu de héros ont un écart aussi grand entre les deux.",
    competences: [
      {
        type: "Passif",
        nom: "Lame de dague",
        description:
          "Après une compétence, sa prochaine attaque de base inflige des dégâts supplémentaires proportionnels à la vie manquante de la cible.",
      },
      {
        type: "Competence 1",
        nom: "Dagues de l'ombre",
        description:
          "Lance des dagues en éventail. Relancer la compétence rappelle les dagues plantées, infligeant à nouveau des dégâts.",
        recharge: [11, 10.2, 9.4, 8.6, 7.8, 7],
        cout: [90, 95, 100, 105, 110, 115],
      },
      {
        type: "Competence 2",
        nom: "Frappe spectrale",
        description:
          "Projette une dague unique. Relancer la compétence téléporte Gusion vers la dague.",
        recharge: [10, 9.4, 8.8, 8.2, 7.6, 7],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultime",
        nom: "Incandescence",
        description:
          "Recharge les deux compétences et permet de se propulser vers une zone. Le point de départ de tout combo.",
        recharge: [45, 40, 35],
      },
    ],
    forces: [
      "Un des plus hauts pics de dégâts du jeu",
      "Mobilité extrême entre les dagues",
      "Impose une pression permanente sur la lane du milieu",
    ],
    faiblesses: [
      "Exécution parmi les plus difficiles du roster",
      "Consommation de mana très élevée",
      "Sans son ultime, ses dégâts s'effondrent",
    ],
    fortContre: ["layla", "lesley", "gord", "cecilion", "estes"],
    faibleContre: ["khufra", "franco", "belerick", "esmeralda"],
    builds: [
      {
        nom: "Jungle magique",
        contexte:
          "Pénétration magique en priorité : Gusion vise les cibles fragiles, pas les tanks.",
        objets: [
          "Arcane Boots",
          "Enchanted Talisman",
          "Glowing Wand",
          "Concentrated Energy",
          "Winter Crown",
          "Divine Glaive",
        ],
        embleme: "Emblème d'assassin",
        talent: "Seasoned Hunter",
        sort: "Execution",
      },
    ],
  },
  {
    slug: "ling",
    resume:
      "Assassin qui se déplace sur les murs, hors de portée, et choisit son moment pour tomber sur une cible.",
    analyse:
      "Ling change la géométrie de la carte. Tant qu'il est sur un mur, il est intouchable par la plupart des compétences au sol, ce qui lui permet d'attendre indéfiniment l'ouverture. Il n'utilise pas de mana mais une ressource d'énergie, ce qui limite le nombre de sauts consécutifs.\n\nSon ultime le rend insensible aux contrôles pendant le bond et inflige des dégâts critiques. Le héros est excellent en escarmouche mobile et faible face à une équipe groupée qui garde ses contrôles pour lui. Khufra reste sa réponse la plus nette.",
    competences: [
      {
        type: "Passif",
        nom: "Danse des nuages",
        description:
          "Ling peut grimper sur les murs et s'y déplacer rapidement, en régénérant son énergie.",
      },
      {
        type: "Competence 1",
        nom: "Bond de l'ombre",
        description:
          "Saute vers un point, y compris sur un mur. Coût en énergie, sans recharge tant que l'énergie tient.",
        cout: [30, 30, 30, 30, 30, 30],
      },
      {
        type: "Competence 2",
        nom: "Épée de l'ombre",
        description:
          "Frappe les ennemis autour de lui et augmente sa vitesse d'attaque.",
        recharge: [8.5, 8, 7.5, 7, 6.5, 6],
        cout: [40, 40, 40, 40, 40, 40],
      },
      {
        type: "Ultime",
        nom: "Tourbillon de lames",
        description:
          "Bondit dans une zone en infligeant des dégâts critiques, insensible aux contrôles pendant le saut.",
        recharge: [45, 40, 35],
      },
    ],
    forces: [
      "Déplacement sur les murs, hors de portée au sol",
      "Choisit librement le moment de l'engagement",
      "Excellent en escarmouche et en vol d'objectif",
    ],
    faiblesses: [
      "Dépend entièrement de son énergie",
      "Début de partie lent avant deux objets",
      "Punie sévèrement par les blocages de déplacement",
    ],
    fortContre: ["pharsa", "cecilion", "layla", "estes", "kimmy"],
    faibleContre: ["khufra", "franco", "minsitthar", "phoveus"],
    builds: [
      {
        nom: "Jungle critique",
        contexte:
          "Son ultime inflige des dégâts critiques : le taux de critique vaut plus que la pénétration brute.",
        objets: [
          "Swift Boots",
          "Bloodlust Axe",
          "Berserker's Fury",
          "Windtalker",
          "Demon Hunter Sword",
          "Immortality",
        ],
        embleme: "Emblème d'assassin",
        talent: "Seasoned Hunter",
        sort: "Execution",
      },
    ],
  },
];
