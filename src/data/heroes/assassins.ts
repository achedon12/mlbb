import type { HeroAnalysis } from "@/lib/types";

/** Analyses of the assassins. Factual data: see the sync. */
export const assassins: HeroAnalysis[] = [
  {
    slug: "lancelot",
    summary:
      "Assassin de jungle bâti sur l'enchaînement de dashs, avec une fenêtre d'invulnérabilité pendant l'ultime.",
    analysis:
      "Lancelot traverse un combat plutôt qu'il n'y entre. Sa compétence 1 marque le premier ennemi non marqué qu'elle traverse, et chaque nouvelle marque réinitialise sa recharge : bien enchaîné, il peut dasher presque sans interruption tant qu'il trouve une cible à marquer. Sa compétence 2 le rend intouchable pendant ses trois frappes.\n\nSon ultime le rend invulnérable pendant l'animation, ce qui en fait aussi un outil défensif pour esquiver un contrôle ou une exécution. Le héros est puni par tout ce qui bloque le déplacement — Khufra en tête — et par les zones qui l'empêchent d'enchaîner.",
    skills: [
      {
        type: "Passive",
        name: "Soul Cutter",
        description:
          "Chaque charge augmente ses dégâts pendant quelques secondes, en se cumulant.",
      },
      {
        type: "Skill 1",
        name: "Puncture",
        description:
          "Charge dans une direction en frappant les ennemis traversés et marque le premier ennemi non marqué touché. Chaque nouvelle marque réinitialise la recharge.",
      },
      {
        type: "Skill 2",
        name: "Thorned Rose",
        description:
          "Frappe trois fois dans une direction en restant intouchable. Les ennemis au centre de la zone subissent les trois coups et sont ralentis.",
      },
      {
        type: "Ultimate",
        name: "Phantom Execution",
        description:
          "Enchaîne une série de frappes dans une zone en restant invulnérable pendant l'animation.",
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
        emblem: "Assassin Emblem",
        talent: "Seasoned Hunter",
        spell: "Execution",
      },
    ],
  },
  {
    slug: "gusion",
    summary:
      "Assassin magique à combo : il lance ses dagues, se glisse derrière la cible marquée, et les rappelle pour infliger tous ses dégâts d'un coup.",
    analysis:
      "Gusion est le héros de combo le plus exigeant du jeu après Fanny. Toutes ses compétences peuvent être relancées, et l'ordre comme le timing des relances déterminent entièrement ses dégâts. Le combo standard consiste à poser les dagues, se rapprocher par l'ultime, puis déclencher la récupération pour que tout arrive simultanément.\n\nUn Gusion maîtrisé supprime n'importe quelle cible fragile en moins d'une seconde, souvent avant que l'écran adverse n'ait affiché quoi que ce soit. Un Gusion approximatif fait un tiers des dégâts et meurt sur place. Peu de héros ont un écart aussi grand entre les deux.",
    skills: [
      {
        type: "Passive",
        name: "Dagger Specialist",
        description:
          "Chaque compétence lancée ajoute une rune à sa dague, jusqu'à quatre : chacune renforce sa prochaine attaque de base, qui inflige des dégâts supplémentaires selon les PV de la cible et le soigne.",
      },
      {
        type: "Skill 1",
        name: "Sword Spike",
        description:
          "Lance une dague qui blesse et marque le premier ennemi touché. Relancée, elle le fait passer derrière la cible marquée en la frappant à nouveau, sans pouvoir être interrompu.",
      },
      {
        type: "Skill 2",
        name: "Shadowblade Slaughter",
        description:
          "Lance une salve de dagues qui blessent et ralentissent les ennemis touchés. Relancée, elle rappelle les dagues, qui frappent à nouveau sur leur trajet.",
      },
      {
        type: "Ultimate",
        name: "Incandescence",
        description:
          "Se propulse vers une zone et réinitialise la recharge de ses deux compétences ; relancée, elle le fait dasher sur une courte distance. Le point de départ de tout combo.",
      },
    ],
    strengths: [
      "Un des plus hauts pics de dégâts du jeu",
      "Mobilité extrême entre les dagues",
      "Impose une pression permanente sur la Mid lane",
    ],
    weaknesses: [
      "Exécution parmi les plus difficiles du jeu",
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
        emblem: "Assassin Emblem",
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
      "Ling change la géométrie de la carte. Tant qu'il est sur un mur, il est intouchable par la plupart des compétences au sol, ce qui lui permet d'attendre indéfiniment l'ouverture. Il n'utilise pas de mana mais une ressource d'énergie, ce qui limite le nombre de sauts consécutifs.\n\nSon ultime le rend invulnérable pendant le bond, puis ralentit et projette en l'air les ennemis à l'atterrissage. Le héros est excellent en escarmouche mobile et faible face à une équipe groupée qui garde ses contrôles pour lui. Khufra reste sa réponse la plus nette.",
    skills: [
      {
        type: "Passive",
        name: "Cloud Walker",
        description:
          "Ling bondit de mur en mur et regagne de l'énergie sur un mur comme en infligeant des dégâts. Il tire 1,6 fois plus de chance de critique de toutes ses sources, mais ses dégâts critiques sont réduits.",
      },
      {
        type: "Skill 1",
        name: "Finch Poise",
        description:
          "Saute sur un mur et passe en semi-camouflage, plus rapide. Sauter d'un mur à l'autre ne déclenche pas la recharge ; un contrôle le fait tomber au sol.",
      },
      {
        type: "Skill 2",
        name: "Defiant Sword",
        description:
          "Charge dans une direction et frappe les ennemis proches. Lancée depuis un mur, sans coût en énergie, elle le fait plonger au sol en ralentissant les ennemis de la zone.",
      },
      {
        type: "Ultimate",
        name: "Tempest of Blades",
        description:
          "Bondit dans les airs en restant invulnérable, puis retombe en ralentissant les ennemis de la zone et en projetant en l'air ceux du centre. Le champ d'épées laissé au sol recharge ses autres compétences.",
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
      "Puni sévèrement par les blocages de déplacement",
    ],
    strongAgainst: ["pharsa", "cecilion", "layla", "estes", "kimmy"],
    weakAgainst: ["khufra", "franco", "minsitthar", "phoveus"],
    builds: [
      {
        name: "Jungle critique",
        context:
          "Son passif multiplie la chance de critique qu'il obtient : le taux de critique vaut plus que la pénétration brute.",
        items: [
          "Swift Boots",
          "Bloodlust Axe",
          "Berserker's Fury",
          "Windtalker",
          "Demon Hunter Sword",
          "Immortality",
        ],
        emblem: "Assassin Emblem",
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
      "Son rendement mesuré se concentre en début de partie : son taux de victoire est nettement plus élevé dans les parties terminées avant la douzième minute, puis revient autour de la moyenne. Il vit donc de l'avance prise en jungle plutôt que de la fin de partie, et sa seule protection contre les contrôles ne dure qu'un instant. Les mesures le placent en difficulté face à Karina, Uranus, Aamon, Johnson et Hayabusa, du rang Mythic au rang Mythical Glory.",
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
          "Révèle toute la carte quelques secondes et accélère Yi Sun-shin. Relancée, elle envoie un navire percuter une zone en étourdissant le centre, puis plusieurs salves de canon qui ralentissent sur une zone plus large.",
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
        emblem: "Assassin Emblem",
        talent: "Killing Spree",
        spell: "Retribution",
      },
      {
        name: "Exécution",
        context:
          "Sky Piercer à la place de War Axe : moins joué, avec un meilleur taux de victoire mesuré. Son seuil d'exécution grandit avec les éliminations et diminue à chaque mort, ce qui convient à un jungleur qui prend son avance tôt.",
        items: ["Hunter Strike", "Sky Piercer", "Endless Battle"],
        emblem: "Assassin Emblem",
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
      "Cette polyvalence a un coût : tout son engagement repose sur la flèche, qui doit partir de loin pour étourdir longtemps. Son taux de victoire mesuré reste sous la moyenne à tous les rangs, avec un point bas dans les parties de moins de douze minutes. Elle est jouée en Mid lane comme en roam, avec des objets différents selon la position. Les mesures la placent en difficulté face à Gloo, Popol and Kupa, Chip et Lolita.",
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
      "Jouable en Mid lane comme en roam",
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
        name: "Mid lane",
        context:
          "Le build le plus joué au milieu : Starlium Scythe ajoute des dégâts à l'attaque de base qui suit une compétence, ce qui sert sa forme abyssale, Lightning Truncheon un écho de dégâts et Divine Glaive la pénétration magique.",
        items: ["Starlium Scythe", "Lightning Truncheon", "Divine Glaive"],
        emblem: "Mage Emblem",
        talent: "Lethal Ignition",
        spell: "Flicker",
      },
      {
        name: "Roam",
        context:
          "Le build le plus joué en roam : Enchanted Talisman mise sur la recharge et la mana plutôt que sur les dégâts bruts, pour relancer pièges et flèches plus souvent avec le revenu plus faible de cette position.",
        items: ["Enchanted Talisman", "Glowing Wand", "Lightning Truncheon"],
        emblem: "Mage Emblem",
        talent: "Lethal Ignition",
        spell: "Flicker",
      },
    ],
  },
];
