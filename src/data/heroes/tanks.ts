import type { HeroAnalysis } from "@/lib/types";

/** Analyses of the tanks. Factual data: see the sync. */
export const tanks: HeroAnalysis[] = [

  {
    slug: "tigreal",
    summary:
      "Tank d'engagement historique, capable de regrouper une équipe entière dans un seul ultime.",
    analysis:
      "Tigreal fait une chose, et il la fait mieux que presque personne : ramasser plusieurs adversaires d'un coup. Le combo classique consiste à se ruer avec la compétence 2, puis à enchaîner immédiatement l'ultime avant que les cibles ne se dispersent — l'annulation de l'animation par un sort de Flicker reste la technique la plus rentable à apprendre sur lui.\n\nSa limite est nette : hors de son ultime, il n'apporte presque rien. Un Tigreal qui a raté son engagement laisse son équipe à quatre pendant une dizaine de secondes. C'est un héros de timing, pas de présence continue.",
    skills: [
      {
        type: "Passive",
        name: "Forteresse",
        description:
          "Les attaques de base de Tigreal chargent son armure. À pleine charge, sa prochaine attaque inflige des dégâts supplémentaires et le protège brièvement.",
      },
      {
        type: "Skill 1",
        name: "Onde de choc",
        description:
          "Frappe le sol devant lui, infligeant des dégâts et ralentissant les ennemis touchés.",
        cooldown: [7, 6.6, 6.2, 5.8, 5.4, 5],
        cost: [40, 45, 50, 55, 60, 65],
      },
      {
        type: "Skill 2",
        name: "Charge sacrée",
        description:
          "Se rue vers l'avant en poussant les ennemis rencontrés, puis les projette en l'air à la fin de la course.",
        cooldown: [11, 10.4, 9.8, 9.2, 8.6, 8],
        cost: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultimate",
        name: "Implosion",
        description:
          "Attire tous les ennemis proches vers lui, puis les étourdit. La référence en matière d'engagement de groupe.",
        cooldown: [42, 36, 30],
        cost: [100, 120, 140],
      },
    ],
    strengths: [
      "Le meilleur regroupement du jeu sur plusieurs cibles",
      "Très résistant même avec un budget d'objets modeste",
      "Lisible : facile à prendre en main en file classée basse",
    ],
    weaknesses: [
      "Inutile quand son ultime est en recharge",
      "L'engagement est télégraphié sans Flicker",
      "Aucune mobilité pour se désengager s'il rate",
    ],
    strongAgainst: ["cecilion", "layla", "pharsa", "estes"],
    weakAgainst: ["diggie", "khufra", "wanwan", "benedetta"],
    builds: [
      {
        name: "Roam d'engagement",
        context:
          "Le build par défaut. On sacrifie tous les dégâts pour arriver au contact et survivre à l'ouverture du combat.",
        items: [
          "Warrior Boots",
          "Athena's Shield",
          "Antique Cuirass",
          "Immortality",
          "Guardian Helmet",
          "Blade Armor",
        ],
        emblem: "Emblème de tank",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
      {
        name: "Front résistant au magique",
        context:
          "Contre une composition adverse à deux mages ou plus, ou quand le dommage magique adverse dépasse le physique.",
        items: [
          "Tough Boots",
          "Athena's Shield",
          "Radiant Armor",
          "Immortality",
          "Oracle",
          "Antique Cuirass",
        ],
        emblem: "Emblème de tank",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "franco",
    summary:
      "Tank d'initiation dont toute la partie tient dans un grappin : il retire un joueur de la carte.",
    analysis:
      "Franco ne joue pas la même partie que les autres tanks. Il ne cherche pas à absorber des dégâts, il cherche à supprimer un adversaire du combat avant qu'il ne commence. Un grappin réussi sur le tireur adverse, suivi de l'ultime, c'est un joueur mort et un objectif gratuit.\n\nToute sa valeur repose donc sur la précision d'une compétence à projectile lent, que la vision conditionne entièrement. Franco se joue dans les buissons, pas dans la lane. Un Franco qui rate trois grappins de suite est un poids mort ; un Franco qui les touche gagne la partie à lui seul.",
    skills: [
      {
        type: "Passive",
        name: "Vaillance",
        description:
          "Chaque coup reçu augmente sa vitesse de déplacement pendant un court instant, cumulable.",
      },
      {
        type: "Skill 1",
        name: "Grappin",
        description:
          "Lance un crochet qui tire le premier ennemi touché jusqu'à lui et l'immobilise brièvement.",
        cooldown: [11, 10.4, 9.8, 9.2, 8.6, 8],
        cost: [70, 80, 90, 100, 110, 120],
      },
      {
        type: "Skill 2",
        name: "Fléau",
        description:
          "Frappe autour de lui, infligeant des dégâts et ralentissant fortement les ennemis proches.",
        cooldown: [7, 6.4, 5.8, 5.2, 4.6, 4],
        cost: [50, 55, 60, 65, 70, 75],
      },
      {
        type: "Ultimate",
        name: "Déferlement",
        description:
          "Immobilise une cible et la frappe à répétition. Le contrôle dure assez longtemps pour que l'équipe conclue.",
        cooldown: [50, 42, 34],
        cost: [100, 125, 150],
      },
    ],
    strengths: [
      "Retire une cible clé du combat, quelle que soit sa résistance",
      "Excellent contrôle d'objectif autour du seigneur et de la tortue",
      "Récompense énormément la lecture de la carte",
    ],
    weaknesses: [
      "Un grappin raté le laisse sans rien pendant huit secondes",
      "Très dépendant de la vision et des buissons",
      "L'ultime est une cible unique : sans relais, il meurt après",
    ],
    strongAgainst: ["layla", "estes", "cecilion", "kimmy"],
    weakAgainst: ["diggie", "wanwan", "benedetta", "fanny"],
    builds: [
      {
        name: "Roam de contrôle",
        context:
          "Franco n'a pas besoin de dégâts : il a besoin d'arriver à portée et de survivre au grappin.",
        items: [
          "Warrior Boots",
          "Immortality",
          "Athena's Shield",
          "Antique Cuirass",
          "Radiant Armor",
          "Blade Armor",
        ],
        emblem: "Emblème de tank",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "khufra",
    summary:
      "Le tank qui punit la mobilité : sa compétence 1 annule les dashs et les sauts adverses.",
    analysis:
      "Khufra existe pour répondre à une catégorie précise de héros — ceux qui se déplacent constamment. Sa compétence 1 pose un champ qui interrompt tout dash traversé, ce qui neutralise Fanny, Ling, Wanwan ou Benedetta d'une façon qu'aucun autre tank ne permet.\n\nEn dehors de ce rôle de réponse, il reste un excellent initiateur : la boule de l'ultime propulse les adversaires et permet de les repousser contre une tourelle ou un mur. Sa faiblesse est sa recharge : hors compétences, Khufra est lent et facile à contourner.",
    skills: [
      {
        type: "Passive",
        name: "Provocation",
        description:
          "Après avoir utilisé une compétence, sa prochaine attaque de base inflige des dégâts supplémentaires et le soigne.",
      },
      {
        type: "Skill 1",
        name: "Bandage rebondissant",
        description:
          "Crée une zone qui projette en l'air les ennemis qui tentent de la traverser par un déplacement. Le principal outil anti-mobilité du jeu.",
        cooldown: [12, 11.4, 10.8, 10.2, 9.6, 9],
        cost: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Skill 2",
        name: "Bond de la boule",
        description:
          "Se transforme en boule et roule dans une direction, en poussant et ralentissant les ennemis heurtés.",
        cooldown: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cost: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultimate",
        name: "Tempête du désert",
        description:
          "Frappe le sol : les ennemis pris dans la zone sont projetés et immobilisés un instant.",
        cooldown: [42, 38, 34],
        cost: [120, 140, 160],
      },
    ],
    strengths: [
      "Réponse directe à toute composition mobile",
      "Enchaînement de contrôles très long une fois lancé",
      "Peut isoler une cible contre un mur",
    ],
    weaknesses: [
      "Sans ses compétences, il n'a aucune vitesse",
      "Recharges longues en début de partie",
      "Peu utile face à une équipe sans déplacement",
    ],
    strongAgainst: ["fanny", "ling", "wanwan", "benedetta", "harith"],
    weakAgainst: ["diggie", "cecilion", "yve"],
    builds: [
      {
        name: "Roam anti-mobilité",
        context:
          "Le build standard, à prendre dès que l'équipe adverse aligne un assassin mobile.",
        items: [
          "Warrior Boots",
          "Immortality",
          "Athena's Shield",
          "Antique Cuirass",
          "Blade Armor",
          "Guardian Helmet",
        ],
        emblem: "Emblème de tank",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "belerick",
    summary:
      "Tank de provocation qui riposte à chaque série de coups reçus : plus on le frappe, plus il blesse.",
    analysis:
      "Belerick est construit pour être frappé. Son passif tire sur l'ennemi le plus proche à mesure qu'il encaisse des dégâts, et augmente les PV qu'il tire de ses objets et emblèmes. Ses deux contrôles sont des provocations : la compétence 1 ralentit sur une ligne puis provoque, après un court délai, les ennemis restés sur le tracé, et l'ultime provoque tout ce qui l'entoure. Sa compétence 2 l'accélère, ralentit fortement sa cible et le soigne, et chaque déclenchement du passif en raccourcit la recharge.\n\n" +
      "Ses dégâts dépendent de ceux qu'il reçoit : une équipe qui l'ignore lui retire l'essentiel de sa riposte, et la provocation de la compétence 1 laisse le temps de quitter la ligne. Son taux de victoire mesuré est le plus haut dans les parties courtes et baisse doucement ensuite. Les mesures le placent en difficulté face à Lesley, Beatrix, Brody, Natalia et Marcel.",
    skills: [
      {
        type: "Passive",
        name: "Deadly Thorns",
        description:
          "Les dégâts qu'il subit ont une chance de déclencher un tir magique sur l'ennemi le plus proche, basé en partie sur ses PV maximum. Les PV apportés par ses objets et emblèmes sont augmentés : chaque objet de PV renforce aussi sa riposte.",
      },
      {
        type: "Skill 1",
        name: "Ancient Seed",
        description:
          "Des lianes partent en ligne, blessent et ralentissent, puis les graines laissées sur le tracé provoquent un instant plus tard les ennemis encore dessus. Le ralentissement sert à les y retenir.",
      },
      {
        type: "Skill 2",
        name: "Nature's Strike",
        description:
          "L'accélère et renforce sa prochaine attaque de base, qui ralentit fortement la cible et le soigne d'une partie de ses PV manquants. Chaque tir du passif réduit sa recharge.",
      },
      {
        type: "Ultimate",
        name: "Wrath of Dryad",
        description:
          "Des lianes jaillissent autour de lui, frappent plusieurs fois et provoquent tous les ennemis de la zone. À lancer au milieu de l'équipe adverse, pour qu'elle se tourne vers lui.",
      },
    ],
    strengths: [
      "Deux provocations, dont une de zone à l'ultime",
      "Une riposte automatique quand il encaisse des dégâts",
      "Soin et accélération sur la compétence 2",
      "Des PV supplémentaires tirés de chaque objet",
    ],
    weaknesses: [
      "Peu de dégâts si l'adversaire ne le frappe pas",
      "Une provocation de compétence 1 retardée, que l'on évite en quittant la ligne",
      "En difficulté face à Lesley, Beatrix et Brody selon les mesures",
    ],
    strongAgainst: ["zhask", "johnson", "obsidia", "silvanna"],
    weakAgainst: ["lesley", "beatrix", "brody", "natalia", "marcel"],
    builds: [
      {
        name: "Roam PV",
        context:
          "Le build le plus joué : Dominance Ice réduit les soins des ennemis autour de lui, Chastise Pauldron ralentit l'attaque de ceux qui le frappent, Guardian Helmet empile les PV que son passif renforce.",
        items: ["Dominance Ice", "Chastise Pauldron", "Guardian Helmet"],
        emblem: "Emblème de tank",
        talent: "Brave Smite",
        spell: "Revitalize",
      },
      {
        name: "Résistances mixtes",
        context:
          "Deuxième build le plus joué, associé à Vengeance : Antique Cuirass contre les dégâts physiques des compétences, Athena's Shield contre les dégâts magiques, quand l'équipe adverse mélange les deux.",
        items: ["Dominance Ice", "Antique Cuirass", "Athena's Shield"],
        emblem: "Emblème de tank",
        talent: "Brave Smite",
        spell: "Vengeance",
      },
    ],
  },
  {
    slug: "atlas",
    summary:
      "Tank d'engagement qui attire plusieurs héros d'un coup et les dépose là où il le décide.",
    analysis:
      "Atlas engage en deux temps. Son ultime lance des chaînes qui ralentissent les héros touchés pendant qu'il canalise, puis, relancé, les tire vers lui et les écrase à l'endroit choisi ; seule une suppression peut l'interrompre. Sa compétence 2 le fait sortir de son armure pour se déplacer plus vite, insensible aux ralentissements, avant que la machine ne le rejoigne en étourdissant autour d'elle. Chaque compétence lancée crée autour de lui une zone de froid qui ralentit, puis gèle les ennemis qui y restent.\n\n" +
      "Ses chiffres varient selon le rang : son taux de victoire mesuré est plus élevé en Mythic et Mythic Honor qu'en Mythic Glory, où il est en revanche davantage banni. Il figure parmi les héros renforcés du patch 2.1.88, sans détail publié sur le wiki. Ses meilleurs duos mesurés sont avec des soutiens — Mathilda, Floryn, Estes, Rafaela — et les mesures le placent nettement en difficulté face à Marcel, puis face à Wanwan, Alice, Valentina et Lancelot.",
    skills: [
      {
        type: "Passive",
        name: "Frigid Breath",
        description:
          "Chaque compétence lancée l'entoure quelques secondes d'un souffle glacé : les ennemis qui y restent sont ralentis de plus en plus, puis gelés un court instant. Il gagne des défenses tant que le souffle est actif.",
      },
      {
        type: "Skill 1",
        name: "Annihilate",
        description:
          "Frappe le sol et provoque trois explosions autour de lui. Hors de son armure, le pilote et la machine la lancent tous les deux.",
      },
      {
        type: "Skill 2",
        name: "Perfect Match",
        description:
          "Il quitte la machine, plus rapide et insensible aux ralentissements, pendant qu'elle le suit de plus en plus vite. Quand ils se rejoignent, les ennemis proches sont blessés et étourdis. Pilote et machine partagent une barre de PV et subissent moins de dégâts pendant cette phase.",
      },
      {
        type: "Ultimate",
        name: "Fatal Links",
        description:
          "Lance des chaînes qui ralentissent les héros touchés pendant la canalisation, que seule une suppression interrompt. Relancée, elle les ramène vers lui et les écrase à l'endroit choisi. Hors de son armure, la machine revient aussitôt mais l'étourdissement devient un ralentissement.",
      },
    ],
    strengths: [
      "Déplace plusieurs héros d'un coup avec l'ultime",
      "Une canalisation interrompue seulement par une suppression",
      "Insensible aux ralentissements quand il quitte la machine",
      "Une zone de froid qui ralentit puis gèle",
    ],
    weaknesses: [
      "Nettement en difficulté face à Marcel selon les mesures",
      "Taux de victoire mesuré plus bas en Mythic Glory",
      "Un étourdissement perdu si l'ultime part hors de son armure",
      "En difficulté face à Wanwan, Alice et Valentina",
    ],
    strongAgainst: ["popol-and-kupa", "layla", "estes", "lolita", "eudora"],
    weakAgainst: ["marcel", "wanwan", "alice", "valentina", "lancelot"],
    builds: [
      {
        name: "Engagement résistant",
        context:
          "Le build le plus joué : Dominance Ice pour les résistances et la réduction de soins autour de lui, Radiant Armor contre la magie, Chastise Pauldron contre les attaques de base.",
        items: ["Dominance Ice", "Radiant Armor", "Chastise Pauldron"],
        emblem: "Emblème de tank",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
      {
        name: "Contre la magie",
        context:
          "Athena's Shield à la place de Radiant Armor, avec l'emblème de soutien : moins jouée, avec un meilleur taux de victoire mesuré. À préférer contre une équipe adverse aux dégâts magiques élevés.",
        items: ["Dominance Ice", "Athena's Shield", "Chastise Pauldron"],
        emblem: "Emblème de soutien",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "barats",
    summary:
      "Jungleur tank dont la monture grossit à chaque compétence qui touche, et qui avale un adversaire pour le recracher contre un mur.",
    analysis:
      "Barats joue sur l'accumulation. Chaque compétence qui touche fait grossir Detona, sa monture, et lui donne des défenses supplémentaires ; à charge maximale, ses attaques de base deviennent des piétinements de zone qui entretiennent l'effet. La compétence 2 ralentit et ramène les ennemis vers lui, et l'ultime lance Detona sur le premier ennemi touché : la cible est avalée, neutralisée, puis recrachée, et explose en étourdissant si elle heurte un héros ou un mur. Barats est insensible aux contrôles pendant la manœuvre.\n\n" +
      "Son rendement mesuré est concentré en début de partie : taux de victoire élevé dans les parties courtes, puis sous cinquante pour cent passé la seizième minute. Il gagne en popularité, avec des taux de sélection et de bannissement en hausse sur les trente derniers jours. Les mesures le placent très nettement en difficulté face à X.Borg, puis face à Gord, Alice, Yve et Uranus.",
    skills: [
      {
        type: "Passive",
        name: "Big Guy",
        description:
          "Chaque compétence qui touche ajoute une charge pendant quelques secondes : Detona grossit et gagne des défenses et de la résistance aux contrôles. À charge maximale, ses attaques de base deviennent des piétinements de zone qui prolongent les charges.",
      },
      {
        type: "Skill 1",
        name: "So-Called Teamwork",
        description:
          "Detona crache de l'huile en éventail, que Barats enflamme aussitôt. La zone grandit avec le nombre de charges : c'est sa compétence de nettoyage et d'entretien des charges.",
      },
      {
        type: "Skill 2",
        name: "Missile \"Expert\"",
        description:
          "Deux missiles tombent sur une zone et ralentissent, puis leur souffle pousse les ennemis vers Barats. Sert à ramener une cible à portée de l'ultime.",
      },
      {
        type: "Ultimate",
        name: "Detona's Welcome",
        description:
          "Après un court délai, Detona charge et avale le premier ennemi touché, le neutralise puis le recrache. Si la cible heurte un héros ou un mur, elle explose et étourdit les ennemis proches. Barats ignore les contrôles pendant la durée, et une annulation rembourse une partie de la recharge.",
      },
    ],
    strengths: [
      "Des défenses qui augmentent avec chaque compétence qui touche",
      "Un ultime qui neutralise une cible et étourdit contre un mur",
      "Insensible aux contrôles pendant l'ultime",
      "Une compétence 2 qui ramène les ennemis vers lui",
    ],
    weaknesses: [
      "Taux de victoire mesuré en baisse nette dans les parties longues",
      "Doit toucher ses compétences pour garder ses charges",
      "Très nettement en difficulté face à X.Borg selon les mesures",
    ],
    strongAgainst: ["silvanna", "phoveus", "alucard", "brody"],
    weakAgainst: ["x-borg", "gord", "alice", "yve", "uranus"],
    builds: [
      {
        name: "Jungle tank",
        context:
          "Le build le plus joué en jungle : War Axe pour le vol de vie, Brute Force Breastplate pour les PV et la réduction de la durée des contrôles quand il enchaîne les dégâts, Oracle pour renforcer les soins et boucliers qu'il reçoit.",
        items: ["War Axe", "Brute Force Breastplate", "Oracle"],
        emblem: "Emblème de tank",
        talent: "Concussive Blast",
        spell: "Retribution",
      },
    ],
  },
  {
    slug: "minotaur",
    summary:
      "Tank de roam qui soigne son équipe autant qu'il la protège, et dont l'ultime le fait entrer en rage pour renforcer ses compétences.",
    analysis:
      "Minotaur apporte deux choses : du contrôle et du soin. Sa compétence 1 le fait bondir sur une zone en projetant brièvement les ennemis et en renforçant ses attaques suivantes ; sa compétence 2 soigne l'allié le plus blessé à proximité ainsi que lui-même. L'ultime frappe le sol trois fois, ralentit puis projette en l'air, le rend insensible aux contrôles pendant l'attaque et le fait entrer en rage : pendant plusieurs secondes, ses compétences sont renforcées et son soin touche tous les alliés proches.\n\n" +
      "Il est rarement banni malgré un taux de victoire mesuré au-dessus de la moyenne à tous les rangs, un écart qui s'érode doucement dans les parties longues. Il figure parmi les héros renforcés du patch 2.1.88, sans détail publié sur le wiki. Les mesures le placent en difficulté face à Beatrix, Ixia, Carmilla, Alice et Yve.",
    skills: [
      {
        type: "Passive",
        name: "Rage Incarnate",
        description:
          "Chaque compétence lancée lui donne un bonus temporaire et le soigne d'une partie des dégâts que lui infligent les héros adverses. En rage, ces effets sont doublés.",
      },
      {
        type: "Skill 1",
        name: "Despair Stomp",
        description:
          "Bondit sur une zone, projette brièvement les ennemis et les ralentit, puis renforce ses attaques de base quelques secondes. En rage, la zone et les dégâts augmentent.",
      },
      {
        type: "Skill 2",
        name: "Motivation Roar",
        description:
          "Soigne l'allié le plus blessé à proximité et lui-même, en fonction de ses PV manquants. En rage, le soin s'étend à tous les alliés proches : c'est la compétence à garder pour la fin d'un combat.",
      },
      {
        type: "Ultimate",
        name: "Minoan Fury",
        description:
          "Frappe le sol trois fois : les deux premiers coups ralentissent fortement, le dernier projette en l'air. Il ignore les contrôles pendant l'attaque, puis reste en rage plusieurs secondes avec des compétences renforcées.",
      },
    ],
    strengths: [
      "Un soin sur l'allié le plus blessé, puis sur tous les alliés en rage",
      "Deux projections, au bond et à l'ultime",
      "Insensible aux contrôles pendant l'ultime",
      "Taux de victoire mesuré au-dessus de la moyenne à tous les rangs",
    ],
    weaknesses: [
      "Des compétences renforcées seulement pendant la rage qui suit l'ultime",
      "Taux de victoire mesuré qui s'érode dans les parties longues",
      "En difficulté face à Beatrix, Ixia et Carmilla selon les mesures",
    ],
    strongAgainst: ["lolita", "cyclops", "silvanna", "odette", "khufra"],
    weakAgainst: ["beatrix", "ixia", "carmilla", "alice", "yve"],
    builds: [
      {
        name: "Roam de soin",
        context:
          "Le build le plus joué : Flask of the Oasis accorde un bouclier aux alliés soignés à bas PV et réduit ses recharges, Dominance Ice et Radiant Armor complètent les résistances.",
        items: ["Flask of the Oasis", "Dominance Ice", "Radiant Armor"],
        emblem: "Emblème de soutien",
        talent: "Concussive Blast",
        spell: "Revitalize",
      },
      {
        name: "Soins reçus",
        context:
          "Oracle à la place de Radiant Armor renforce les soins et boucliers qu'il reçoit, dont les siens : moins joué, avec un taux de victoire mesuré plus haut.",
        items: ["Flask of the Oasis", "Dominance Ice", "Oracle"],
        emblem: "Emblème de soutien",
        talent: "Concussive Blast",
        spell: "Revitalize",
      },
    ],
  },
];
