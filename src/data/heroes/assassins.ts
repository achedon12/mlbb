import type { HeroAnalysis } from "@/lib/types";

/** Analyses of the assassins. Factual data: see the sync. */
export const assassins: HeroAnalysis[] = [
  {
    slug: "lancelot",
    summary:
      "Assassin de jungle bâti sur l'enchaînement de dashs, avec une fenêtre d'invulnérabilité pendant l'ultime.",
    analysis:
      "Lancelot traverse un combat plutôt qu'il n'y entre. Sa compétence 2 marque les cibles, sa compétence 1 se recharge en frappant une cible marquée : bien enchaîné, il peut dasher presque sans interruption tant qu'il touche quelque chose.\n\nSon ultime le rend invulnérable pendant l'animation, ce qui en fait aussi un outil défensif pour esquiver un contrôle ou une exécution. Le héros est puni par tout ce qui bloque le déplacement — Khufra en tête — et par les zones qui l'empêchent d'enchaîner.",
    skills: [
      {
        type: "Passive",
        name: "Sourire du soleil",
        description:
          "Ses dégâts augmentent brièvement après avoir esquivé ou traversé un ennemi.",
      },
      {
        type: "Skill 1",
        name: "Puncture",
        description:
          "Se déplace dans une direction en frappant les ennemis traversés. La recharge est réduite en touchant une cible marquée.",
        cooldown: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5],
        cost: [40, 45, 50, 55, 60, 65],
      },
      {
        type: "Skill 2",
        name: "Fente",
        description:
          "Projette une lame qui marque les ennemis touchés et les ralentit.",
        cooldown: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cost: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultimate",
        name: "Phantom Execution",
        description:
          "Enchaîne une série de frappes dans une zone en restant invulnérable pendant l'animation.",
        cooldown: [40, 35, 30],
        cost: [120, 140, 160],
      },
    ],
    strengths: [
      "Mobilité quasi continue en combat",
      "Invulnérabilité exploitable de façon défensive",
      "Nettoyage de jungle rapide",
    ],
    weaknesses: [
      "Totalement neutralisé par le blocage de déplacement",
      "Fragile si l'enchaînement s'interrompt",
      "Courbe d'apprentissage longue",
    ],
    strongAgainst: ["layla", "pharsa", "cecilion", "estes", "gord"],
    weakAgainst: ["khufra", "franco", "phoveus", "minsitthar"],
    builds: [
      {
        name: "Jungle standard",
        context:
          "Le build de référence : pénétration puis un objet de survie pour tenir la deuxième rotation.",
        items: [
          "Swift Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Malefic Roar",
          "Blade of Despair",
          "Immortality",
        ],
        emblem: "Emblème d'assassin",
        talent: "Seasoned Hunter",
        spell: "Execution",
      },
    ],
  },
  {
    slug: "gusion",
    summary:
      "Assassin magique à combo : il pose ses dagues, se téléporte dessus, et les récupère pour infliger tous ses dégâts d'un coup.",
    analysis:
      "Gusion est le héros de combo le plus exigeant du jeu après Fanny. Toutes ses compétences peuvent être relancées, et l'ordre comme le timing des relances déterminent entièrement ses dégâts. Le combo standard consiste à poser les dagues, se rapprocher par l'ultime, puis déclencher la récupération pour que tout arrive simultanément.\n\nUn Gusion maîtrisé supprime n'importe quelle cible fragile en moins d'une seconde, souvent avant que l'écran adverse n'ait affiché quoi que ce soit. Un Gusion approximatif fait un tiers des dégâts et meurt sur place. Peu de héros ont un écart aussi grand entre les deux.",
    skills: [
      {
        type: "Passive",
        name: "Lame de dague",
        description:
          "Après une compétence, sa prochaine attaque de base inflige des dégâts supplémentaires proportionnels à la vie manquante de la cible.",
      },
      {
        type: "Skill 1",
        name: "Dagues de l'ombre",
        description:
          "Lance des dagues en éventail. Relancer la compétence rappelle les dagues plantées, infligeant à nouveau des dégâts.",
        cooldown: [11, 10.2, 9.4, 8.6, 7.8, 7],
        cost: [90, 95, 100, 105, 110, 115],
      },
      {
        type: "Skill 2",
        name: "Frappe spectrale",
        description:
          "Projette une dague unique. Relancer la compétence téléporte Gusion vers la dague.",
        cooldown: [10, 9.4, 8.8, 8.2, 7.6, 7],
        cost: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultimate",
        name: "Incandescence",
        description:
          "Recharge les deux compétences et permet de se propulser vers une zone. Le point de départ de tout combo.",
        cooldown: [45, 40, 35],
      },
    ],
    strengths: [
      "Un des plus hauts pics de dégâts du jeu",
      "Mobilité extrême entre les dagues",
      "Impose une pression permanente sur la lane du milieu",
    ],
    weaknesses: [
      "Exécution parmi les plus difficiles du roster",
      "Consommation de mana très élevée",
      "Sans son ultime, ses dégâts s'effondrent",
    ],
    strongAgainst: ["layla", "lesley", "gord", "cecilion", "estes"],
    weakAgainst: ["khufra", "franco", "belerick", "esmeralda"],
    builds: [
      {
        name: "Jungle magique",
        context:
          "Pénétration magique en priorité : Gusion vise les cibles fragiles, pas les tanks.",
        items: [
          "Arcane Boots",
          "Enchanted Talisman",
          "Glowing Wand",
          "Concentrated Energy",
          "Winter Crown",
          "Divine Glaive",
        ],
        emblem: "Emblème d'assassin",
        talent: "Seasoned Hunter",
        spell: "Execution",
      },
    ],
  },
  {
    slug: "ling",
    summary:
      "Assassin qui se déplace sur les murs, hors de portée, et choisit son moment pour tomber sur une cible.",
    analysis:
      "Ling change la géométrie de la carte. Tant qu'il est sur un mur, il est intouchable par la plupart des compétences au sol, ce qui lui permet d'attendre indéfiniment l'ouverture. Il n'utilise pas de mana mais une ressource d'énergie, ce qui limite le nombre de sauts consécutifs.\n\nSon ultime le rend insensible aux contrôles pendant le bond et inflige des dégâts critiques. Le héros est excellent en escarmouche mobile et faible face à une équipe groupée qui garde ses contrôles pour lui. Khufra reste sa réponse la plus nette.",
    skills: [
      {
        type: "Passive",
        name: "Danse des nuages",
        description:
          "Ling peut grimper sur les murs et s'y déplacer rapidement, en régénérant son énergie.",
      },
      {
        type: "Skill 1",
        name: "Bond de l'ombre",
        description:
          "Saute vers un point, y compris sur un mur. Coût en énergie, sans recharge tant que l'énergie tient.",
        cost: [30, 30, 30, 30, 30, 30],
      },
      {
        type: "Skill 2",
        name: "Épée de l'ombre",
        description:
          "Frappe les ennemis autour de lui et augmente sa vitesse d'attaque.",
        cooldown: [8.5, 8, 7.5, 7, 6.5, 6],
        cost: [40, 40, 40, 40, 40, 40],
      },
      {
        type: "Ultimate",
        name: "Tourbillon de lames",
        description:
          "Bondit dans une zone en infligeant des dégâts critiques, insensible aux contrôles pendant le saut.",
        cooldown: [45, 40, 35],
      },
    ],
    strengths: [
      "Déplacement sur les murs, hors de portée au sol",
      "Choisit librement le moment de l'engagement",
      "Excellent en escarmouche et en vol d'objectif",
    ],
    weaknesses: [
      "Dépend entièrement de son énergie",
      "Début de partie lent avant deux objets",
      "Punie sévèrement par les blocages de déplacement",
    ],
    strongAgainst: ["pharsa", "cecilion", "layla", "estes", "kimmy"],
    weakAgainst: ["khufra", "franco", "minsitthar", "phoveus"],
    builds: [
      {
        name: "Jungle critique",
        context:
          "Son ultime inflige des dégâts critiques : le taux de critique vaut plus que la pénétration brute.",
        items: [
          "Swift Boots",
          "Bloodlust Axe",
          "Berserker's Fury",
          "Windtalker",
          "Demon Hunter Sword",
          "Immortality",
        ],
        emblem: "Emblème d'assassin",
        talent: "Seasoned Hunter",
        spell: "Execution",
      },
    ],
  },
  {
    slug: "yi-sun-shin",
    summary:
      "Jungleur hybride qui passe de l'arc au glaive selon la distance, et dont l'ultime révèle toute la carte.",
    analysis:
      "Yi Sun-shin change d'arme tout seul : il tire à l'arc de loin et frappe au glaive au contact, et chaque changement renforce ses deux attaques suivantes. Sa compétence 1 le propulse vers l'avant en le rendant brièvement insensible aux contrôles, et sa recharge diminue à chaque changement d'arme réussi. L'ultime lui donne d'abord la vision de toute la carte et une accélération, puis, relancé, envoie un navire qui étourdit le centre de la zone avant un tir de barrage qui ralentit : c'est autant un outil d'information qu'un engagement à distance.\n\n" +
      "Son rendement mesuré se concentre en début de partie : son taux de victoire est nettement plus élevé dans les parties terminées avant la douzième minute, puis revient autour de la moyenne. Il vit donc de l'avance prise en jungle plutôt que de la fin de partie, et sa seule protection contre les contrôles ne dure qu'un instant. Les mesures le placent en difficulté face à Karina, Uranus, Aamon, Johnson et Hayabusa, du rang Mythic au rang Mythic Glory.",
    skills: [
      {
        type: "Passive",
        name: "Heavenly Vow",
        description:
          "Il attaque à l'arc ou au glaive selon la distance de sa cible. Après chaque changement d'arme, ses deux attaques suivantes gagnent en cadence et en dégâts critiques, avec un court gain de vitesse.",
      },
      {
        type: "Skill 1",
        name: "Traceless",
        description:
          "Ruée vers l'avant au glaive, qui le rend insensible aux contrôles un court instant. Chaque changement d'arme déclenché raccourcit sa recharge : c'est sa principale mobilité en combat.",
      },
      {
        type: "Skill 2",
        name: "Blood Floods",
        description:
          "Appui court : un coup de glaive rapide. Appui long : une flèche dont les dégâts augmentent avec le temps de charge. Dans les deux cas, elle déclenche immédiatement le bonus de changement d'arme.",
      },
      {
        type: "Ultimate",
        name: "Mountain Shocker",
        description:
          "Révèle toute la carte quelques secondes et l'accélère. Relancée, elle envoie un navire percuter une zone en étourdissant le centre, puis plusieurs salves de canon qui ralentissent sur une zone plus large.",
      },
    ],
    strengths: [
      "Vision de toute la carte au lancement de l'ultime",
      "Insensible aux contrôles pendant la ruée de la compétence 1",
      "Dégâts à distance comme au contact, sans changer de build",
      "Taux de victoire mesuré élevé dans les parties courtes",
    ],
    weaknesses: [
      "Taux de victoire mesuré qui revient à la moyenne passé les premières minutes",
      "Une protection contre les contrôles qui ne dure qu'un instant",
      "En difficulté face à Karina, Uranus et Aamon selon les mesures",
    ],
    strongAgainst: ["khufra", "benedetta", "thamuz", "melissa"],
    weakAgainst: ["karina", "uranus", "aamon", "johnson", "hayabusa"],
    builds: [
      {
        name: "Jungle standard",
        context:
          "Le build le plus joué, à tous les rangs : Hunter Strike et War Axe, puis Endless Battle, qui renforce l'attaque de base suivant chaque compétence et le soigne au passage.",
        items: ["Hunter Strike", "War Axe", "Endless Battle"],
        emblem: "Emblème d'assassin",
        talent: "Killing Spree",
        spell: "Retribution",
      },
      {
        name: "Exécution",
        context:
          "Sky Piercer à la place de War Axe : moins joué, avec un meilleur taux de victoire mesuré. Son seuil d'exécution grandit avec les éliminations et diminue à chaque mort, ce qui convient à un jungleur qui prend son avance tôt.",
        items: ["Hunter Strike", "Sky Piercer", "Endless Battle"],
        emblem: "Emblème d'assassin",
        talent: "Killing Spree",
        spell: "Retribution",
      },
    ],
  },
  {
    slug: "selena",
    summary:
      "Héroïne à deux formes : pièges et flèche d'étourdissement à distance, puis assassinat au contact après l'ultime.",
    analysis:
      "Selena se joue en deux temps. Sous sa forme elfique, elle pose des démons qui guettent un emplacement et s'accrochent aux ennemis de passage, et elle tire une flèche dont l'étourdissement s'allonge avec la distance parcourue ; ses compétences laissent des marques sur les cibles. L'ultime la fait passer en forme abyssale, où ses compétences deviennent une attaque bondissante avec bouclier et une charge, qui consomment ces marques pour des dégâts supplémentaires ; elle peut ensuite revenir en forme elfique.\n\n" +
      "Cette polyvalence a un coût : tout son engagement repose sur la flèche, qui doit partir de loin pour étourdir longtemps. Son taux de victoire mesuré reste sous la moyenne à tous les rangs, avec un point bas dans les parties de moins de douze minutes. Elle est jouée en lane du milieu comme en roam, avec des objets différents selon la position. Les mesures la placent en difficulté face à Gloo, Popol and Kupa, Chip et Lolita.",
    skills: [
      {
        type: "Passive",
        name: "Symbiosis",
        description:
          "Elle passe librement d'une forme à l'autre. En forme elfique, ses compétences posent des marques cumulables ; en forme abyssale, ses dégâts consomment ces marques pour frapper plus fort. Le jeu consiste à marquer de loin, puis à conclure de près.",
      },
      {
        type: "Skill 1",
        name: "Abyssal Trap",
        description:
          "Place un démon qui attend à un endroit, s'attache au premier ennemi qui approche, le ralentit puis explose sur lui et ses voisins. Plusieurs pièges peuvent coexister, et chaque piège supplémentaire renforce l'explosion.",
      },
      {
        type: "Skill 2",
        name: "Abyssal Arrow",
        description:
          "Tire une flèche qui étourdit le premier héros touché, d'autant plus longtemps qu'elle a voyagé loin. En traversant un piège, elle l'emporte avec elle et applique son effet à la cible. Son vrai outil d'engagement.",
      },
      {
        type: "Ultimate",
        name: "Primal Darkness",
        description:
          "La fait passer en forme abyssale avec un bref gain de vitesse et remet à zéro la recharge de ses compétences de cette forme. Ses attaques de base infligent alors des dégâts magiques supplémentaires.",
      },
    ],
    strengths: [
      "Étourdissement long quand la flèche part de loin",
      "Pièges posés à l'avance, plusieurs à la fois",
      "Deux formes : contrôle à distance, puis dégâts au contact",
      "Jouable en lane du milieu comme en roam",
    ],
    weaknesses: [
      "Tout son engagement dépend d'une flèche à viser de loin",
      "Taux de victoire mesuré sous la moyenne à tous les rangs",
      "Plus faible dans les parties très courtes selon les mesures",
      "En difficulté face à Gloo, Popol and Kupa et Chip",
    ],
    strongAgainst: ["benedetta", "beatrix", "x-borg", "ixia", "yve"],
    weakAgainst: ["gloo", "popol-and-kupa", "chip", "lolita"],
    builds: [
      {
        name: "Lane du milieu",
        context:
          "Le build le plus joué au milieu : Starlium Scythe ajoute des dégâts à l'attaque de base qui suit une compétence, ce qui sert sa forme abyssale, Lightning Truncheon un écho de dégâts et Divine Glaive la pénétration magique.",
        items: ["Starlium Scythe", "Lightning Truncheon", "Divine Glaive"],
        emblem: "Emblème de mage",
        talent: "Lethal Ignition",
        spell: "Flicker",
      },
      {
        name: "Roam",
        context:
          "Le build le plus joué en roam : Enchanted Talisman mise sur la recharge et la mana plutôt que sur les dégâts bruts, pour relancer pièges et flèches plus souvent avec le revenu plus faible de cette position.",
        items: ["Enchanted Talisman", "Glowing Wand", "Lightning Truncheon"],
        emblem: "Emblème de mage",
        talent: "Lethal Ignition",
        spell: "Flicker",
      },
    ],
  },
];
