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
        name: "Fearless",
        description:
          "Chaque attaque de base subie et chaque compétence lancée lui donnent un cumul ; à quatre, il bloque la prochaine attaque de base reçue, tourelles comprises.",
      },
      {
        type: "Skill 1",
        name: "Attack Wave",
        description:
          "Frappe le sol devant lui, infligeant des dégâts et ralentissant les ennemis touchés.",
      },
      {
        type: "Skill 2",
        name: "Sacred Hammer",
        description:
          "Se rue vers l'avant en poussant les ennemis rencontrés, puis les projette en l'air à la fin de la course.",
      },
      {
        type: "Ultimate",
        name: "Implosion",
        description:
          "Attire tous les ennemis proches vers lui, puis les étourdit. La référence en matière d'engagement de groupe.",
      },
    ],
    strengths: [
      "Le meilleur regroupement du jeu sur plusieurs cibles",
      "Très résistant même avec un budget d'objets modeste",
      "Lisible : facile à prendre en main dans les rangs classés inférieurs",
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
          "Valkyrie's Shield",
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
        name: "Ligne de front anti-magie",
        context:
          "Contre une composition adverse à deux mages ou plus, ou quand les dégâts magiques adverses dépassent les dégâts physiques.",
        items: [
          "Tough Boots",
          "Valkyrie's Shield",
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
        name: "Wasteland Force",
        description:
          "Après quelques secondes sans subir de dégâts, il gagne de la vitesse, récupère des PV et accumule de la force ; sa prochaine compétence consomme ces cumuls pour des dégâts fortement accrus.",
      },
      {
        type: "Skill 1",
        name: "Iron Hook",
        description:
          "Lance un crochet qui blesse le premier ennemi touché et le tire jusqu'à lui.",
      },
      {
        type: "Skill 2",
        name: "Fury Shock",
        description:
          "Frappe autour de lui, infligeant des dégâts et ralentissant fortement les ennemis proches.",
      },
      {
        type: "Ultimate",
        name: "Bloody Hunt",
        description:
          "Neutralise un héros adverse (suppression) et le frappe six fois pendant la durée. Le contrôle dure assez longtemps pour que l'équipe conclue.",
      },
    ],
    strengths: [
      "Retire une cible clé du combat, quelle que soit sa résistance",
      "Excellent contrôle d'objectif autour du Seigneur et de la Tortue",
      "Récompense énormément la lecture de la carte",
    ],
    weaknesses: [
      "Un grappin raté le laisse sans rien pendant huit secondes",
      "Très dépendant de la vision et des buissons",
      "L'ultime ne vise qu'une cible : sans relais, il meurt ensuite",
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
          "Valkyrie's Shield",
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
      "Khufra existe pour répondre à une catégorie précise de héros — ceux qui se déplacent constamment. Sa compétence 2 le change en boule qui projette en l'air tout ennemi tentant de la franchir par un déplacement, ce qui neutralise Fanny, Ling, Wanwan ou Benedetta d'une façon qu'aucun autre tank ne permet.\n\nEn dehors de ce rôle de réponse, il reste un excellent initiateur : sa compétence 1 le lance sur le premier héros adverse en projetant en l'air les ennemis autour, et son ultime repousse les adversaires devant lui, en les étourdissant s'ils heurtent un mur. Sa faiblesse est sa recharge : hors compétences, Khufra est lent et facile à contourner.",
    skills: [
      {
        type: "Passive",
        name: "Spell Curse",
        description:
          "À intervalle régulier, sa prochaine attaque de base porte plus loin, inflige des dégâts selon les PV de la cible, la ralentit et le soigne. Chaque contrôle posé par ses compétences réduit ce délai.",
      },
      {
        type: "Skill 1",
        name: "Tyrant's Revenge",
        description:
          "Se propulse dans une direction en blessant les ennemis sur son trajet ; il s'arrête au premier héros adverse et projette en l'air les ennemis proches.",
      },
      {
        type: "Skill 2",
        name: "Bouncing Ball",
        description:
          "Se change en boule rebondissante, avec plus de défense hybride : les ennemis qui tentent de la franchir par un déplacement sont projetés en l'air, et chaque rebond ralentit les ennemis proches. Le principal outil anti-mobilité du jeu.",
      },
      {
        type: "Ultimate",
        name: "Tyrant's Rage",
        description:
          "Repousse tous les ennemis autour de lui vers l'avant et les ralentit ; ceux qui heurtent un mur subissent des dégâts supplémentaires et sont étourdis.",
      },
    ],
    strengths: [
      "Réponse directe à toute composition mobile",
      "Enchaînement de contrôles très long une fois lancé",
      "Peut isoler une cible contre un mur",
    ],
    weaknesses: [
      "Sans ses compétences, il est très lent",
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
          "Valkyrie's Shield",
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
          "Deuxième build le plus joué, associé à Vengeance : Antique Cuirass contre les dégâts physiques des compétences, Valkyrie's Shield contre les dégâts magiques, quand l'équipe adverse mélange les deux.",
        items: ["Dominance Ice", "Antique Cuirass", "Valkyrie's Shield"],
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
      "Ses chiffres varient selon le rang : son taux de victoire mesuré est plus élevé en Mythique et Honneur mythique qu'en Gloire mythique, où il est en revanche davantage banni. Il figure parmi les héros renforcés du patch 2.1.88, sans détail publié sur le wiki. Ses meilleurs duos mesurés sont avec des soutiens — Mathilda, Floryn, Estes, Rafaela — et les mesures le placent nettement en difficulté face à Marcel, puis face à Wanwan, Alice, Valentina et Lancelot.",
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
      "Taux de victoire mesuré plus bas en Gloire mythique",
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
          "Valkyrie's Shield à la place de Radiant Armor, avec l'emblème de support : moins joué, avec un meilleur taux de victoire mesuré. À préférer contre une équipe adverse aux dégâts magiques élevés.",
        items: ["Dominance Ice", "Valkyrie's Shield", "Chastise Pauldron"],
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
  {
    slug: "alice",
    summary:
      "Mage tank qui s'installe au milieu des ennemis : tant que ses compétences touchent, elle brûle tout autour d'elle et se soigne.",
    analysis:
      "Alice joue au contact malgré ses dégâts magiques. Deux compétences qui touchent coup sur coup activent son passif, une aura qui blesse les ennemis proches à intervalles réguliers, la soigne et l'accélère, et que chaque compétence qui touche un héros prolonge. Sa compétence 1 lance une décharge de sang qu'elle peut rejoindre en se téléportant ; sa compétence 2, à recharge courte, blesse et ralentit fortement autour d'elle, et brûle davantage quand l'aura est active. L'ultime la rend insensible aux contrôles et réduit les dégâts subis pendant sa charge, puis elle retombe sur la zone en immobilisant les ennemis.\n\n" +
      "Ses chiffres mesurés sont dans la moyenne, avec un taux de victoire qui progresse un peu dans les parties longues et un bannissement plus fréquent en Mythique qu'en Gloire mythique. En jungle, le build le plus joué l'est nettement plus que tous les autres. Les mesures la placent en difficulté face à Angela, Floryn, Karrie, Estes et Valir, et à l'aise face à Chip, Gloo, Tigreal, Barats et Atlas.",
    skills: [
      {
        type: "Passive",
        name: "Crimson Blood Banquet",
        description:
          "Chaque compétence qui touche lui donne une charge ; à deux charges, une aura blesse les ennemis proches à intervalles réguliers, la soigne et accélère son déplacement. Toucher un héros avec une compétence prolonge l'aura.",
      },
      {
        type: "Skill 1",
        name: "Crimson Gleam",
        description:
          "Lance une décharge de sang vers l'avant ; relancée avant qu'elle se dissipe, Alice se téléporte à son point d'arrivée. C'est son engagement, et la seule compétence encore utilisable pendant la charge de l'ultime.",
      },
      {
        type: "Skill 2",
        name: "Doom Waltz",
        description:
          "Une danse qui blesse les ennemis autour d'elle et les ralentit fortement. Aura active, elle brûle en plus les cibles et la soigne d'autant : à relancer dès qu'elle est disponible, sa recharge est courte.",
      },
      {
        type: "Ultimate",
        name: "Throne of Ruin",
        description:
          "Pendant une courte charge, Alice est insensible aux contrôles et subit moins de dégâts, mais se déplace plus lentement ; elle retombe ensuite sur la zone en blessant et en immobilisant tous les ennemis présents.",
      },
    ],
    strengths: [
      "Soin continu tant que ses compétences touchent",
      "Insensible aux contrôles pendant la charge de l'ultime",
      "Une compétence 2 à recharge courte qui ralentit fortement",
      "À l'aise face à Chip, Gloo et Tigreal selon les mesures",
    ],
    weaknesses: [
      "Une aura qui s'éteint si ses compétences ratent",
      "Taux de victoire mesuré plus bas dans les parties courtes",
      "En difficulté face à Angela, Floryn et Karrie selon les mesures",
    ],
    strongAgainst: ["chip", "gloo", "tigreal", "barats", "atlas"],
    weakAgainst: ["angela", "floryn", "karrie", "estes", "valir"],
    builds: [
      {
        name: "Jungle",
        context:
          "Le build le plus joué en jungle, nettement devant les autres : Brute Force Breastplate et Oracle apportent PV, armure et réduction de recharge, et Oracle renforce les soins reçus, dont ceux de son aura ; Concentrated Energy ajoute puissance magique, PV et vol de vie hybride.",
        items: ["Brute Force Breastplate", "Oracle", "Concentrated Energy"],
        emblem: "Emblème de tank",
        talent: "Impure Rage",
        spell: "Retribution",
      },
      {
        name: "EXP lane",
        context:
          "Les trois mêmes objets en EXP lane, avec le sort Revitalize à la place de Retribution : c'est la version la plus jouée à cette position.",
        items: ["Brute Force Breastplate", "Oracle", "Concentrated Energy"],
        emblem: "Emblème de tank",
        talent: "Impure Rage",
        spell: "Revitalize",
      },
    ],
  },
];
