import type { HeroAnalysis } from "@/lib/types";

/** Analyses of the mages. Factual data: see the sync. */
export const mages: HeroAnalysis[] = [
  {
    slug: "kagura",
    summary:
      "Mage à deux états : ses compétences changent complètement selon qu'elle tient son ombrelle ou l'a posée.",
    analysis:
      "Kagura a en pratique huit compétences pour trois touches. Chaque sort a une version avec ombrelle et une version sans, et savoir dans quel état on se trouve est l'essentiel du héros. Le combo signature enchaîne la pose de l'ombrelle, un rappel qui traverse et projette, puis l'ultime pour verrouiller.\n\nElle est aussi l'un des rares mages capables de se sortir seule d'un mauvais positionnement, puisque la téléportation vers l'ombrelle sert de fuite. En contrepartie, une erreur d'état la laisse sans mobilité au milieu de l'équipe adverse.",
    skills: [
      {
        type: "Passive",
        name: "Yin Yang rassemblés",
        description:
          "Quand Kagura et son ombrelle sont réunies, ses compétences se rechargent plus vite et elle gagne un bouclier après un sort.",
      },
      {
        type: "Skill 1",
        name: "Seimei Umbrella Open",
        description:
          "Envoie l'ombrelle à un endroit, ou la rappelle. L'ombrelle posée ralentit les ennemis autour d'elle.",
        cooldown: [3, 3, 3, 3, 3, 3],
        cost: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Skill 2",
        name: "Rasho Umbrella Flee",
        description:
          "Avec l'ombrelle : se déplace dans une direction. Sans l'ombrelle : se téléporte vers elle en projetant les ennemis traversés.",
        cooldown: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cost: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultimate",
        name: "Yin Yang Gathering",
        description:
          "Immobilise et attire les ennemis autour de l'ombrelle, puis inflige des dégâts de zone importants.",
        cooldown: [30, 27, 24],
        cost: [130, 150, 170],
      },
    ],
    strengths: [
      "Dégâts de zone très élevés en milieu de partie",
      "Mobilité défensive rare pour un mage",
      "Contrôle de zone permanent autour de l'ombrelle",
    ],
    weaknesses: [
      "Gestion d'état exigeante, punitive à l'erreur",
      "Coût en mana élevé avant le premier objet",
      "Sans ombrelle à proximité, elle est immobile",
    ],
    strongAgainst: ["layla", "miya", "balmond", "alucard"],
    weakAgainst: ["gusion", "natalia", "helcurt", "hayabusa"],
    builds: [
      {
        name: "Milieu explosif",
        context:
          "Le build standard : pénétration magique pour conserver des dégâts face aux premiers objets défensifs.",
        items: [
          "Arcane Boots",
          "Winter Crown",
          "Enchanted Talisman",
          "Glowing Wand",
          "Concentrated Energy",
          "Divine Glaive",
        ],
        emblem: "Emblème de mage",
        talent: "Lethal Ignition",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "pharsa",
    summary:
      "Mage d'artillerie : son ultime frappe à travers la carte, sans jamais entrer dans le combat.",
    analysis:
      "Pharsa joue sur la portée. Son ultime est un bombardement canalisé couvrant une zone énorme à longue distance, ce qui lui permet de participer à un combat qu'elle ne voit qu'à peine. Bien placé, ce sort seul peut décider d'un affrontement autour du seigneur.\n\nSa compétence 2 lui donne une forme volante qui traverse les murs, indispensable pour se repositionner après avoir canalisé. Le point faible est évident : pendant l'ultime elle est immobile et sans défense, et n'importe quel assassin qui la trouve la tue.",
    skills: [
      {
        type: "Passive",
        name: "Terreur des cieux",
        description:
          "Après une compétence, sa prochaine attaque de base inflige des dégâts magiques supplémentaires.",
      },
      {
        type: "Skill 1",
        name: "Vague d'énergie",
        description:
          "Envoie une onde qui explose à distance, infligeant des dégâts de zone.",
        cooldown: [7.5, 7, 6.5, 6, 5.5, 5],
        cost: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Skill 2",
        name: "Forme aviaire",
        description:
          "Prend une forme volante pour se déplacer rapidement, en traversant les obstacles.",
        cooldown: [15, 14, 13, 12, 11, 10],
        cost: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultimate",
        name: "Tempête de plumes",
        description:
          "Canalise un bombardement sur une zone très étendue, à longue distance de la carte.",
        cooldown: [40, 35, 30],
        cost: [150, 170, 190],
      },
    ],
    strengths: [
      "Portée d'ultime parmi les plus grandes du jeu",
      "Participe aux combats sans s'exposer",
      "Repositionnement libre grâce à la forme volante",
    ],
    weaknesses: [
      "Immobile et sans défense pendant la canalisation",
      "Aucun contrôle fiable en cas d'engagement sur elle",
      "Dépend beaucoup de la vision de son équipe",
    ],
    strongAgainst: ["balmond", "hylos", "belerick", "uranus"],
    weakAgainst: ["ling", "fanny", "gusion", "hayabusa", "natalia"],
    builds: [
      {
        name: "Milieu artillerie",
        context:
          "Portée et dégâts bruts, avec un objet défensif tardif pour survivre à une plongée.",
        items: [
          "Arcane Boots",
          "Enchanted Talisman",
          "Glowing Wand",
          "Concentrated Energy",
          "Divine Glaive",
          "Winter Crown",
        ],
        emblem: "Emblème de mage",
        talent: "Lethal Ignition",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "cecilion",
    summary:
      "Mage à cumul : il accumule du sang toute la partie et devient une menace de zone impossible à ignorer en fin de partie.",
    analysis:
      "Cecilion est un pari sur la durée. Chaque compétence lancée ajoute une charge permanente qui augmente ses dégâts et sa mana maximale — un Cecilion qui a farmé tranquillement pendant quinze minutes n'a plus rien à voir avec celui du début.\n\nEn contrepartie, il est extrêmement fragile avant d'avoir cumulé, et ses compétences ont une zone large mais lente. Face à une équipe qui l'attaque tôt et souvent, il n'atteint jamais son palier. C'est le héros type où le résultat dépend du rythme de la partie plus que du duel.",
    skills: [
      {
        type: "Passive",
        name: "Soif de sang",
        description:
          "Chaque compétence touchant un ennemi accumule des charges permanentes qui augmentent ses dégâts et sa mana maximale.",
      },
      {
        type: "Skill 1",
        name: "Chauve-souris sanglantes",
        description:
          "Libère une vague de chauves-souris dans une direction, infligeant des dégâts de zone.",
        cooldown: [3.2, 3.2, 3.2, 3.2, 3.2, 3.2],
        cost: [26, 30, 34, 38, 42, 46],
      },
      {
        type: "Skill 2",
        name: "Étreinte funeste",
        description:
          "Fait surgir des griffes qui immobilisent brièvement les ennemis dans la zone.",
        cooldown: [11, 10.2, 9.4, 8.6, 7.8, 7],
        cost: [70, 80, 90, 100, 110, 120],
      },
      {
        type: "Ultimate",
        name: "Nuit éternelle",
        description:
          "Se soigne, gagne de la portée sur ses compétences et inflige des dégâts de zone massifs autour de lui.",
        cooldown: [42, 36, 30],
        cost: [100, 120, 140],
      },
    ],
    strengths: [
      "Dégâts de zone illimités en fin de partie",
      "Excellent contrôle de vague et poussée de lane",
      "Un des meilleurs mages pour tenir un objectif",
    ],
    weaknesses: [
      "Très fragile et sans mobilité",
      "Dépend entièrement de son cumul précoce",
      "Cible prioritaire de tous les assassins",
    ],
    strongAgainst: ["balmond", "hylos", "belerick", "sun", "uranus"],
    weakAgainst: ["ling", "fanny", "gusion", "lancelot", "natalia"],
    builds: [
      {
        name: "Milieu cumul",
        context:
          "Mana et recharge d'abord pour cumuler vite, dégâts ensuite. Le Sablier n'est pas optionnel.",
        items: [
          "Arcane Boots",
          "Enchanted Talisman",
          "Glowing Wand",
          "Winter Crown",
          "Concentrated Energy",
          "Divine Glaive",
        ],
        emblem: "Emblème de mage",
        talent: "Lethal Ignition",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "novaria",
    summary:
      "Mage de harcèlement à distance, dont l'ultime agrandit la silhouette des cibles pour rendre ses tirs plus faciles à placer.",
    analysis:
      "Novaria se joue de loin. Sa compétence 1 pose une sphère qui blesse et ralentit autour d'elle avant d'exploser ; sa compétence 2 fait revenir une sphère vers elle en lui donnant de la vitesse et la capacité de traverser les murs, puis la relance vers un héros, avec des dégâts qui augmentent avec la distance parcourue. Ses sphères révèlent les ennemis proches, et son ultime agrandit la zone d'impact des héros touchés tout en dévoilant leurs alentours : c'est ce qui rend ses tirs lointains fiables.\n\n" +
      "Elle n'a aucun étourdissement ni immobilisation, seulement des ralentissements. Son taux de victoire mesuré reste sous la moyenne à tous les rangs, mais progresse avec la durée de la partie et passe au-dessus de cinquante pour cent après la dix-huitième minute. Les mesures la placent nettement en difficulté face à Natalia, puis face à Zilong, Aldous, Ling et Estes.",
    skills: [
      {
        type: "Passive",
        name: "Star Trail",
        description:
          "Les sphères qu'elle invoque ralentissent en continu les ennemis proches et les rendent visibles. Chaque sphère posée est donc aussi une source de vision.",
      },
      {
        type: "Skill 1",
        name: "Astral Meteor",
        description:
          "Pose une sphère qui blesse plusieurs fois les ennemis autour d'elle, puis explose et renforce nettement son ralentissement. Sert à tenir une zone ou à préparer un tir de la compétence 2.",
      },
      {
        type: "Skill 2",
        name: "Astral Recall",
        description:
          "Fait apparaître une sphère au loin et la ramène vers elle, en gagnant de la vitesse et en traversant le décor. Elle peut ensuite la relancer : la sphère explose sur le premier héros touché, d'autant plus fort qu'elle a parcouru de distance.",
      },
      {
        type: "Ultimate",
        name: "Astral Echo",
        description:
          "Une vague qui ralentit brièvement les héros touchés et les marque quelques secondes : leur zone d'impact devient bien plus grande et leurs alentours sont révélés. À lancer juste avant les tirs lointains.",
      },
    ],
    strengths: [
      "Dégâts qui augmentent avec la distance du tir",
      "Vision sur les ennemis proches de ses sphères",
      "Traverse les murs pendant la compétence 2",
      "Taux de victoire mesuré en hausse dans les parties longues",
    ],
    weaknesses: [
      "Aucun étourdissement ni immobilisation, seulement des ralentissements",
      "Taux de victoire mesuré sous la moyenne à tous les rangs",
      "Plus faible dans les parties courtes selon les mesures",
      "Nettement en difficulté face à Natalia",
    ],
    strongAgainst: ["diggie", "luo-yi", "valir", "bane", "atlas"],
    weakAgainst: ["natalia", "zilong", "aldous", "ling", "estes"],
    builds: [
      {
        name: "Harcèlement",
        context:
          "Le build le plus joué : Lightning Truncheon ajoute un écho de dégâts à ses compétences, Glowing Wand une brûlure qui réduit aussi les soins, et Wishing Lantern des dégâts sur les PV actuels de la cible à force de la toucher.",
        items: ["Lightning Truncheon", "Glowing Wand", "Wishing Lantern"],
        emblem: "Emblème de mage",
        talent: "Impure Rage",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "eudora",
    summary:
      "Mage d'explosion : chaque compétence électrise la cible et renforce la suivante, jusqu'à un étourdissement de zone.",
    analysis:
      "Eudora fonctionne par enchaînement. Chacune de ses compétences électrise les cibles touchées, et la compétence suivante gagne un effet contre une cible électrisée : la compétence 1 crée une chaîne qui l'accélère et peut réduire sa recharge de moitié, la compétence 2 passe d'un étourdissement sur une cible à un étourdissement de zone, et l'ultime déclenche une explosion supplémentaire autour de chaque cible électrisée. Le bon ordre transforme une rotation de compétences en élimination et en contrôle groupé.\n\n" +
      "Sans électrisation posée, ses compétences perdent leurs effets supplémentaires : une première compétence ratée casse l'enchaînement. Son taux de victoire mesuré est plus haut dans les parties courtes et redescend vers la moyenne au-delà de dix-huit minutes. Le patch 2.1.88 la range parmi les héros renforcés, sans que le wiki ne détaille la modification. Les mesures la placent en difficulté face à Atlas, Masha, Barats et Leomord.",
    skills: [
      {
        type: "Passive",
        name: "Superconductor",
        description:
          "Ses compétences électrisent quelques secondes les héros et monstres touchés, et chacune de ses compétences gagne un effet supplémentaire contre une cible électrisée. Tout son jeu tient dans l'ordre de lancement.",
      },
      {
        type: "Skill 1",
        name: "Forked Lightning",
        description:
          "Un éclair en éventail, renforcé contre les sbires. Sur une cible électrisée, il crée une chaîne qui l'accélère un instant et inflige des dégâts continus ; si la chaîne tient jusqu'au bout, la recharge est réduite de moitié.",
      },
      {
        type: "Skill 2",
        name: "Ball Lightning",
        description:
          "Un orbe qui réduit la défense magique de la cible et l'étourdit. Sur une cible électrisée, l'effet s'étend à tous les ennemis autour d'elle : c'est son contrôle de groupe.",
      },
      {
        type: "Ultimate",
        name: "Thunder's Wrath",
        description:
          "La foudre frappe une zone, plus fort au centre qu'en périphérie. Chaque cible électrisée touchée déclenche une seconde explosion autour d'elle après un court délai.",
      },
    ],
    strengths: [
      "Étourdissement de zone quand la cible est électrisée",
      "Recharge de la compétence 1 réduite de moitié quand la chaîne tient",
      "Un ultime qui explose une seconde fois autour des cibles électrisées",
      "Taux de victoire mesuré élevé dans les parties courtes",
    ],
    weaknesses: [
      "Une première compétence ratée prive les suivantes de leurs effets",
      "Taux de victoire mesuré qui redescend vers la moyenne dans les parties longues",
      "En difficulté face à Atlas, Masha et Barats selon les mesures",
    ],
    strongAgainst: ["zilong", "irithel", "natalia", "floryn"],
    weakAgainst: ["atlas", "masha", "barats", "leomord"],
    builds: [
      {
        name: "Explosion",
        context:
          "Le build le plus joué, très loin devant les autres : Genius Wand réduit la défense magique des cibles, Sky Piercer achève les héros à très bas PV, Lightning Truncheon ajoute un écho de dégâts. L'emblème d'assassin est le choix de la grande majorité des joueurs qui la prennent.",
        items: ["Genius Wand", "Sky Piercer", "Lightning Truncheon"],
        emblem: "Emblème d'assassin",
        talent: "Lethal Ignition",
        spell: "Flicker",
      },
      {
        name: "Pénétration et brûlure",
        context:
          "Glowing Wand et Divine Glaive à la place de Sky Piercer et Lightning Truncheon : bien moins joué, avec un taux de victoire mesuré équivalent. Utile contre des cibles résistantes à la magie ou qui se soignent.",
        items: ["Genius Wand", "Glowing Wand", "Divine Glaive"],
        emblem: "Emblème d'assassin",
        talent: "Lethal Ignition",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "zetian",
    summary:
      "Mage dont l'ultime blesse et étourdit tous les héros adverses, où qu'ils soient sur la carte.",
    analysis:
      "Zetian combine harcèlement et présence globale. Sa compétence 1 lance une vague qui en relance une autre à chaque touche, jusqu'à trois, et elle peut se déplacer et lancer d'autres compétences pendant ce temps ; sa compétence 2 installe un esprit qui ralentit, réduit la défense magique et peut être redirigé. Son ultime accélère toute son équipe, blesse et étourdit brièvement chaque héros ennemi et révèle leur position : il pèse sur un combat même lancé de l'autre côté de la carte. Son passif la protège aussi, à intervalle long, en repoussant et en étourdissant les héros qui s'approchent d'elle.\n\n" +
      "Son rendement mesuré est régulier plutôt que spectaculaire : taux de victoire proche de la moyenne, sans écart marqué selon la durée de partie, et taux de bannissement en léger recul sur trente jours. Le vol de vie de son passif ne se charge qu'en touchant des héros avec ses deux premières compétences. Les mesures la placent en difficulté face à Valentina, Floryn, Mathilda, Uranus et Gloo.",
    skills: [
      {
        type: "Passive",
        name: "Celestial Armament",
        description:
          "Toucher des héros avec ses compétences 1 et 2 lui donne un vol de vie qui se cumule. À intervalle long, une protection repousse et étourdit les héros qui s'approchent d'elle et lui accorde un bouclier.",
      },
      {
        type: "Skill 1",
        name: "Phoenix Strike",
        description:
          "Une vague qui, si elle touche, en déclenche une autre, jusqu'à trois ; la dernière est plus large et attire légèrement. Elle peut se déplacer et utiliser ses autres compétences pendant la séquence.",
      },
      {
        type: "Skill 2",
        name: "Phoenix Descent",
        description:
          "Invoque un esprit qui ralentit la zone, blesse en continu et réduit la défense magique des ennemis présents. Relancée, elle l'envoie charger vers un autre point, avec un nouveau ralentissement à l'arrivée.",
      },
      {
        type: "Ultimate",
        name: "Fury of the Phoenix",
        description:
          "Accélère tous les héros alliés, blesse et étourdit brièvement tous les héros adverses et les révèle, sans limite de distance. Elle peut lancer ses autres compétences pendant la canalisation.",
      },
    ],
    strengths: [
      "Un ultime global qui étourdit chaque héros adverse",
      "Révèle toute l'équipe ennemie au lancement de l'ultime",
      "Une protection automatique contre un assaillant grâce au passif",
      "Peut se déplacer pendant sa compétence 1",
    ],
    weaknesses: [
      "Une protection du passif disponible seulement toutes les deux minutes",
      "Un vol de vie qui dépend de compétences qui touchent des héros",
      "En difficulté face à Valentina, Floryn et Mathilda selon les mesures",
    ],
    strongAgainst: ["lolita", "natalia", "tigreal", "helcurt"],
    weakAgainst: ["valentina", "floryn", "mathilda", "uranus", "gloo"],
    builds: [
      {
        name: "Brûlure et écho",
        context:
          "Le build le plus joué : Glowing Wand pour la brûlure et la réduction de soins, Lightning Truncheon pour l'écho de dégâts, Divine Glaive pour la pénétration magique.",
        items: ["Glowing Wand", "Lightning Truncheon", "Divine Glaive"],
        emblem: "Emblème de mage",
        talent: "Impure Rage",
        spell: "Flicker",
      },
      {
        name: "Recharge d'ultime",
        context:
          "Fleeting Time à la place de Divine Glaive réduit la recharge de l'ultime à chaque élimination ou assistance, pour relancer plus souvent son étourdissement global. Deuxième build le plus joué, avec un taux de victoire mesuré proche du premier.",
        items: ["Glowing Wand", "Fleeting Time", "Lightning Truncheon"],
        emblem: "Emblème de mage",
        talent: "Impure Rage",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "vexana",
    summary:
      "Mage de contrôle qui invoque un gardien combattant, bien plus efficace, selon les mesures, dans les parties courtes que dans les longues.",
    analysis:
      "Vexana harcèle à distance et contrôle à l'impact. Sa compétence 1 est un projectile qui s'arrête sur le premier héros touché, l'effraie et le repousse avant d'exploser sur ses voisins ; sa compétence 2 frappe une zone après un court délai. Son ultime projette en l'air les ennemis à l'arrivée d'un gardien qui combat ensuite à ses côtés pendant plusieurs secondes et frappe de larges zones. Son passif maudit les cibles touchées, qui explosent sur leurs alliés si elles meurent.\n\n" +
      "Les mesures la situent dans la moyenne tous rangs confondus, mais avec une pente nette : taux de victoire élevé dans les parties courtes, sous cinquante pour cent au-delà de la seizième minute. Sa compétence 2 à retardement laisse à la cible le temps de sortir de la zone. Elle est en difficulté face à Alice, X.Borg, Marcel, Natalia et Benedetta.",
    skills: [
      {
        type: "Passive",
        name: "Nether Touch",
        description:
          "Vexana et son gardien maudissent les ennemis touchés pendant quelques secondes. Une cible maudite qui meurt explose et blesse ses alliés proches : utile quand les adversaires combattent groupés.",
      },
      {
        type: "Skill 1",
        name: "Deathly Grasp",
        description:
          "Un projectile qui blesse sur son trajet et s'arrête sur le premier héros touché : celui-ci est effrayé et repoussé, puis l'explosion effraie aussi les ennemis proches. Son principal outil pour interrompre un engagement.",
      },
      {
        type: "Skill 2",
        name: "Cursed Blast",
        description:
          "Marque une zone qui est frappée après un court délai. Des dégâts simples, à placer sur une cible déjà contrôlée, par exemple juste après la compétence 1.",
      },
      {
        type: "Ultimate",
        name: "Eternal Guard",
        description:
          "Invoque un gardien qui projette en l'air les ennemis à son arrivée, puis combat à ses côtés pendant plusieurs secondes en frappant de larges zones.",
      },
    ],
    strengths: [
      "Deux contrôles : peur à la compétence 1, projection à l'ultime",
      "Un gardien qui combat à ses côtés pendant plusieurs secondes",
      "Dégâts de zone sur les groupes serrés",
      "Taux de victoire mesuré élevé dans les parties courtes",
    ],
    weaknesses: [
      "Taux de victoire mesuré en baisse dans les parties longues",
      "Une compétence 2 à retardement, facile à anticiper",
      "Un projectile de compétence 1 arrêté par le premier héros qu'il rencontre",
      "En difficulté face à Alice, X.Borg et Marcel selon les mesures",
    ],
    strongAgainst: ["gloo", "zhask", "chip", "sun"],
    weakAgainst: ["alice", "x-borg", "marcel", "natalia", "benedetta"],
    builds: [
      {
        name: "Brûlure et écho",
        context:
          "Le build le plus joué : Glowing Wand pour la brûlure et la réduction de soins, Lightning Truncheon pour l'écho de dégâts, Divine Glaive pour la pénétration magique.",
        items: ["Glowing Wand", "Lightning Truncheon", "Divine Glaive"],
        emblem: "Emblème de mage",
        talent: "Impure Rage",
        spell: "Flicker",
      },
      {
        name: "Réduction de défense",
        context:
          "Deuxième build le plus joué : Genius Wand en premier pour réduire la défense magique des héros touchés, avec l'emblème d'assassin. Taux de victoire mesuré légèrement inférieur au premier.",
        items: ["Genius Wand", "Glowing Wand", "Lightning Truncheon"],
        emblem: "Emblème d'assassin",
        talent: "Impure Rage",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "nana",
    summary:
      "Mage de harcèlement qui neutralise une cible en la transformant, et survit une fois à un coup fatal.",
    analysis:
      "Nana use ses adversaires de loin avec un boomerang qui touche à l'aller et au retour. Sa compétence 2 envoie Molina poursuivre le héros ennemi le plus proche : celui qu'elle atteint est transformé un court instant, ralenti et fragilisé face aux dégâts magiques. L'ultime frappe une zone trois fois et étourdit les ennemis touchés plusieurs fois de suite. Son passif lui accorde, une fois toutes les deux minutes et demie, une transformation invulnérable au moment où elle devrait mourir.\n\n" +
      "Ses chiffres mesurés sont faibles : taux de victoire sous la moyenne à tous les rangs, plus bas encore en Mythic Glory, sans vraie amélioration dans les parties longues. Pendant la transformation de son passif, elle ne peut lancer aucune compétence, et Molina choisit elle-même sa cible parmi les héros proches. Les écarts de contres restent modestes ; les plus nets la placent en difficulté face à Gloo, puis face à Akai et Hylos.",
    skills: [
      {
        type: "Passive",
        name: "Molina's Gift",
        description:
          "Face à un coup fatal, elle se débarrasse des effets négatifs et se transforme : invulnérable, plus rapide, elle récupère un peu de PV mais ne peut lancer aucune compétence. L'effet a une longue recharge.",
      },
      {
        type: "Skill 1",
        name: "Magic Boomerang",
        description:
          "Un boomerang qui touche à l'aller comme au retour. Ses dégâts baissent pour chaque ennemi supplémentaire traversé : il vaut mieux viser une cible isolée.",
      },
      {
        type: "Skill 2",
        name: "Molina Smooch",
        description:
          "Place Molina, qui poursuit ensuite le héros ennemi le plus proche. Le premier héros atteint est transformé un court instant, ralenti et sa défense magique réduite. Sans héros à portée, Molina reste en place un moment avant de disparaître.",
      },
      {
        type: "Ultimate",
        name: "Molina Blitz",
        description:
          "Molina frappe une zone trois fois de suite, en ralentissant à chaque impact. Un ennemi touché par des impacts consécutifs est étourdi.",
      },
    ],
    strengths: [
      "Une transformation qui neutralise un héros adverse",
      "Survit une fois à un coup fatal grâce au passif",
      "Réduction de défense magique sur la cible de Molina",
      "Étourdissement de zone à l'ultime sur les cibles qui y restent",
    ],
    weaknesses: [
      "Taux de victoire mesuré sous la moyenne à tous les rangs",
      "Aucune compétence utilisable pendant la transformation du passif",
      "Molina poursuit le héros le plus proche, pas celui qu'on choisit",
      "En difficulté face à Gloo selon les mesures",
    ],
    strongAgainst: ["odette", "lolita", "estes", "alucard"],
    weakAgainst: ["gloo", "akai", "hylos"],
    builds: [
      {
        name: "Brûlure et pénétration",
        context:
          "Le build le plus joué, de loin : Glowing Wand et Divine Glaive pour la brûlure et la pénétration magique, puis Wishing Lantern pour des dégâts sur les PV actuels de la cible à force de la toucher. Il est associé au sort Flameshot plutôt qu'à Flicker.",
        items: ["Glowing Wand", "Divine Glaive", "Wishing Lantern"],
        emblem: "Emblème de mage",
        talent: "Lethal Ignition",
        spell: "Flameshot",
      },
    ],
  },
];
