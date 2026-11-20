import type { HeroAnalysis } from "@/lib/types";

/** Analyses of the supports. Factual data: see the sync. */
export const supports: HeroAnalysis[] = [
  {
    slug: "estes",
    summary:
      "Le soin le plus brut du jeu : son ultime régénère l'équipe entière pendant plusieurs secondes.",
    analysis:
      "Estes ne fait rien d'autre que soigner, mais il le fait à un volume qu'aucun autre soutien n'atteint. Dans un combat prolongé autour d'un objectif, son ultime peut annuler l'équivalent d'une composition entière de dégâts soutenus.\n\nCela en fait aussi le héros le plus dépendant du contexte de tout le jeu. Face à une équipe qui achète de la réduction de soins, ou qui possède un engagement capable de le supprimer en premier, il devient presque inutile. Il n'apporte qu'un ralentissement de zone, peu de dégâts et aucune mobilité : s'il ne soigne pas, il n'existe pas.",
    skills: [
      {
        type: "Passive",
        name: "Scripture of the Moon Elf",
        description:
          "Il accumule de l'énergie ; à cent cumuls, sa prochaine attaque de base est renforcée et rebondit sur les ennemis proches en les ralentissant. Le lien de sa compétence 1 accélère cette charge.",
      },
      {
        type: "Skill 1",
        name: "Moonlight Immersion",
        description: "Soigne un allié et se lie à lui quelques secondes : tous deux gagnent de la défense hybride, l'allié continue de récupérer des PV et Estes gagne de la vitesse.",
      },
      {
        type: "Skill 2",
        name: "Domain of Moon Goddess",
        description:
          "Un flot de lumière lunaire blesse les ennemis d'une zone, qui devient un domaine : les ennemis qui y sont restent visibles, et ceux qui en touchent le bord sont fortement ralentis.",
      },
      {
        type: "Ultimate",
        name: "Blessing of Moon Goddess",
        description:
          "Applique une version renforcée de sa compétence 1 à lui-même et à tous les alliés proches : soin immédiat et défense doublés, et un soin continu important pendant plusieurs secondes.",
      },
    ],
    strengths: [
      "Volume de soins inégalé sur la durée",
      "Rend les combats d'objectif très difficiles à perdre",
      "Simple à jouer correctement",
    ],
    weaknesses: [
      "Annulé par la réduction de soins",
      "Aucun contrôle fiable ni dégâts",
      "Cible prioritaire, et sans aucune fuite",
    ],
    strongAgainst: ["balmond", "alucard", "layla", "miya"],
    weakAgainst: ["franco", "chou", "khufra", "baxia", "gusion"],
    builds: [
      {
        name: "Roam soins",
        context:
          "Recharge et mana d'abord : le nombre d'ultimes lancés compte plus que leur puissance unitaire.",
        items: [
          "Tough Boots",
          "Magic Shoes",
          "Winter Crown",
          "Enchanted Talisman",
          "Immortality",
          "Valkyrie's Shield",
        ],
        emblem: "Emblème de soutien",
        talent: "Focusing Mark",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "angela",
    summary:
      "Soutien qui s'attache à un allié à travers la carte pour le renforcer et le protéger à distance.",
    analysis:
      "Angela joue une seconde partie en parallèle de la sienne. Son ultime lui permet de rejoindre n'importe quel allié où qu'il soit, en lui donnant un bouclier, et lance ses compétences sans coût en mana pendant qu'elle est attachée — elle devient littéralement une extension du joueur choisi.\n\nBien utilisée, elle permet à un porteur de plonger avec une sécurité qu'il n'aurait jamais seul, et elle apparaît à l'autre bout de la carte pour renverser une escarmouche. Mal utilisée, elle passe la partie attachée au mauvais joueur et n'influence rien.",
    skills: [
      {
        type: "Passive",
        name: "Smart Heart",
        description:
          "Chaque compétence lancée lui donne un peu de vitesse de déplacement, en se cumulant ; attachée à un allié, c'est lui qui en profite.",
      },
      {
        type: "Skill 1",
        name: "Love Waves",
        description: "Projette une onde qui blesse les ennemis touchés et y pose une marque cumulable, qui augmente les dégâts et ralentit, tout en soignant les alliés touchés. Jusqu'à cinq charges ; attachée à un allié, sa recharge est divisée par deux.",
      },
      {
        type: "Skill 2",
        name: "Puppet-on-a-String",
        description:
          "Relie un ennemi par un fil qui le ralentit de plus en plus ; s'il est toujours relié au bout de trois secondes, il est immobilisé et subit de lourds dégâts, accrus par les marques de la compétence 1.",
      },
      {
        type: "Ultimate",
        name: "Heartguard",
        description:
          "Donne un bouclier à un allié n'importe où sur la carte, puis s'attache à lui après une canalisation : elle lance alors ses compétences sans coût en mana.",
      },
    ],
    strengths: [
      "Présence globale : intervient partout sur la carte",
      "Bouclier qui sauve réellement un porteur plongé",
      "Excellente en duo coordonné",
    ],
    weaknesses: [
      "Extrêmement fragile en dehors de son ultime",
      "Sa valeur dépend du niveau de l'allié choisi",
      "Facile à tuer pendant qu'elle est attachée si le porteur tombe",
    ],
    strongAgainst: ["layla", "miya", "balmond"],
    weakAgainst: ["franco", "khufra", "chou", "natalia"],
    builds: [
      {
        name: "Roam protection",
        context:
          "Recharge d'abord, puis de la résistance : Angela doit pouvoir relancer son ultime souvent.",
        items: [
          "Tough Boots",
          "Magic Shoes",
          "Winter Crown",
          "Enchanted Talisman",
          "Immortality",
          "Radiant Armor",
        ],
        emblem: "Emblème de soutien",
        talent: "Focusing Mark",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "mathilda",
    summary:
      "Soutien de mobilité : elle emmène un allié avec elle, pour engager ou pour extraire.",
    analysis:
      "Mathilda est le soutien le plus polyvalent du jeu actuel. Sa compétence 2 embarque un allié dans son déplacement, ce qui permet aussi bien d'amener un combattant au contact que de sortir un tireur d'une mauvaise position. Son ultime, lui, verrouille une cible et sert d'initiation ciblée.\n\nElle inflige aussi des dégâts magiques conséquents, ce qui la rend jouable en assassin secondaire quand la partie tourne mal. Sa difficulté tient à la lecture : chaque déplacement engage deux joueurs à la fois, et une erreur coûte deux morts au lieu d'une.",
    skills: [
      {
        type: "Passive",
        name: "Ancestral Guidance",
        description:
          "Elle accumule de l'énergie en se déplaçant ; une fois chargée, sa prochaine attaque de base est renforcée et lui donne un regain de vitesse.",
      },
      {
        type: "Skill 1",
        name: "Soul Bloom",
        description:
          "Attire des esprits à mesure qu'elle se déplace ; à la fin de la durée, ou relancée, elle les envoie frapper les ennemis proches, qu'ils révèlent un instant.",
      },
      {
        type: "Skill 2",
        name: "Guiding Wind",
        description:
          "Bondit dans une direction et s'entoure d'un champ qui lui donne un bouclier et de la vitesse. Le premier allié qui touche le champ est guidé jusqu'à elle, avec le même bonus de vitesse.",
      },
      {
        type: "Ultimate",
        name: "Circling Eagle",
        description:
          "Marque un héros adverse et tourne autour de lui en le ralentissant, ses esprits frappant les ennemis proches. À la fin, elle fond sur la cible marquée en projetant en l'air les ennemis sur sa trajectoire.",
      },
    ],
    strengths: [
      "Repositionne un allié, en attaque comme en défense",
      "Dégâts réels pour un soutien",
      "Rotations de carte très rapides",
    ],
    weaknesses: [
      "Une erreur de déplacement engage deux joueurs",
      "Aucun soin",
      "Fragile si l'ultime est utilisé à vide",
    ],
    strongAgainst: ["layla", "estes", "cecilion", "pharsa"],
    weakAgainst: ["khufra", "franco", "diggie"],
    builds: [
      {
        name: "Roam mobilité",
        context:
          "Un peu de dégâts pour rester une menace, le reste en recharge et en résistance.",
        items: [
          "Tough Boots",
          "Enchanted Talisman",
          "Winter Crown",
          "Immortality",
          "Valkyrie's Shield",
          "Divine Glaive",
        ],
        emblem: "Emblème de soutien",
        talent: "Focusing Mark",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "rafaela",
    summary:
      "Soutien de soin et de résurrection, qui ramène un allié tombé sans attendre la fin de son délai de réapparition.",
    analysis:
      "Rafaela combine soin, vitesse et contrôle. Sa compétence 2 soigne les alliés proches, davantage le plus blessé, et leur donne de la vitesse avec une brève immunité aux ralentissements ; sa compétence 1 frappe automatiquement les trois ennemis les plus proches, les révèle et les ralentit ; son ultime étourdit sur une ligne. Son passif, surtout, permet de ressusciter un allié tombé, qui réapparaît à la base : une élimination adverse coûte donc moins cher à son équipe.\n\n" +
      "Le patch 2.1.88 a nettement réduit la recharge de base de la résurrection, tout en augmentant la part qui dépend du délai de réapparition de l'allié, renforcé la compétence 1 et baissé le coût en mana de ses autres compétences. Son taux de victoire mesuré est aujourd'hui très au-dessus de la moyenne, et son taux de bannissement monte sur les trente derniers jours. Sa limite est l'engagement : un seul contrôle, à viser en ligne droite. Les mesures la placent en difficulté face à Ixia, Odette, Estes, Layla et Silvanna.",
    skills: [
      {
        type: "Passive",
        name: "Divine Resurrection",
        description:
          "À intervalle régulier, une compétence spéciale ressuscite un allié tombé après une courte canalisation ; il réapparaît à la base avec un gain de vitesse. La recharge dépend du délai de réapparition de l'allié et ne profite pas de la réduction de recharge.",
      },
      {
        type: "Skill 1",
        name: "Light of Retribution",
        description:
          "Frappe automatiquement les trois ennemis les plus proches, les révèle brièvement et les ralentit. Les cibles touchées à nouveau peu après subissent davantage de dégâts, en se cumulant.",
      },
      {
        type: "Skill 2",
        name: "Holy Healing",
        description:
          "Soigne les alliés proches, avec un soin supplémentaire pour elle et l'allié le plus blessé, et leur donne de la vitesse et une brève immunité aux ralentissements. La puissance magique augmente ce bonus de vitesse.",
      },
      {
        type: "Ultimate",
        name: "Holy Baptism",
        description:
          "Un rayon en ligne droite qui blesse et étourdit les ennemis touchés. Son seul contrôle : à lancer sur un engagement adverse ou sur une cible déjà ralentie par la compétence 1.",
      },
    ],
    strengths: [
      "Ressuscite un allié tombé sans attendre la fin de son délai",
      "Un soin de groupe avec vitesse et immunité aux ralentissements",
      "Une compétence 1 à ciblage automatique qui révèle les ennemis",
      "Taux de victoire mesuré très au-dessus de la moyenne",
    ],
    weaknesses: [
      "Un seul contrôle, à viser en ligne droite",
      "Taux de victoire mesuré plus bas dans les parties longues, même s'il reste élevé",
      "En difficulté face à Ixia, Odette et Estes selon les mesures",
    ],
    strongAgainst: ["natalia", "valir", "karrie", "marcel", "alice"],
    weakAgainst: ["ixia", "odette", "estes", "layla", "silvanna"],
    builds: [
      {
        name: "Roam de soin",
        context:
          "Le build le plus joué : Flask of the Oasis protège les alliés soignés à bas PV et réduit ses recharges, Enchanted Talisman apporte recharge et mana, Queen's Wings la survie. Les joueurs hésitent entre Impure Rage et Focusing Mark, avec des taux de victoire mesurés très proches.",
        items: ["Flask of the Oasis", "Enchanted Talisman", "Queen's Wings"],
        emblem: "Emblème de soutien",
        talent: "Impure Rage",
        spell: "Revitalize",
      },
    ],
  },
  {
    slug: "floryn",
    summary:
      "Soutien de soin global : son ultime soigne toute l'équipe, où qu'elle se trouve sur la carte.",
    analysis:
      "Floryn soigne à distance et sans avoir besoin de viser ses alliés. Sa compétence 1 vise un ennemi, et des fruits de soin rebondissent ensuite vers les alliés proches ; sa compétence 2 étourdit brièvement et révèle les ennemis touchés ; son ultime soigne deux fois l'ensemble de l'équipe, quelle que soit la distance, et renforce un instant les boucliers et la régénération. Sa lanterne améliore ses statistiques et peut être partagée avec un allié, qui reçoit alors un bonus à chacun de ses soins.\n\n" +
      "Son rendement mesuré dépend fortement de la durée de partie : taux de victoire élevé dans les parties courtes, sous cinquante pour cent passé la dix-huitième minute. Le patch 2.1.88 a réduit le coût en mana de ses deux premières compétences. Ses meilleurs duos mesurés sont avec Carmilla et Atlas, et les mesures la placent nettement en difficulté face à Lolita, puis face à Yin, Ixia, Baxia et Silvanna.",
    skills: [
      {
        type: "Passive",
        name: "Dew",
        description:
          "Sa lanterne améliore peu à peu ses statistiques et ne se vend jamais. Hors combat, elle peut en confier la fleur à un allié, qui gagne un bonus chaque fois qu'elle le soigne.",
      },
      {
        type: "Skill 1",
        name: "Sow",
        description:
          "Lance une graine sur un ennemi ; des fruits de soin en jaillissent et rebondissent vers les alliés proches. Elle harcèle et soigne avec la même compétence.",
      },
      {
        type: "Skill 2",
        name: "Sprout",
        description:
          "Une boule d'énergie qui explose sur le premier ennemi touché, étourdit brièvement les ennemis proches et révèle leur position un instant.",
      },
      {
        type: "Ultimate",
        name: "Bloom",
        description:
          "Soigne deux fois tous les héros alliés, où qu'ils soient sur la carte, et renforce un court instant leurs boucliers et leur régénération. De quoi sauver un allié isolé ou faire basculer un combat lointain.",
      },
    ],
    strengths: [
      "Un ultime qui soigne toute l'équipe sans limite de distance",
      "Un soin sans avoir à viser un allié, via la compétence 1",
      "Étourdissement et révélation sur la compétence 2",
      "Un bonus de soin partagé avec un allié grâce à la lanterne",
    ],
    weaknesses: [
      "Taux de victoire mesuré en forte baisse dans les parties longues",
      "Un contrôle très bref",
      "Nettement en difficulté face à Lolita selon les mesures",
    ],
    strongAgainst: ["marcel", "alice", "x-borg", "faramis", "ling"],
    weakAgainst: ["lolita", "yin", "ixia", "baxia", "silvanna"],
    builds: [
      {
        name: "Roam de soin",
        context:
          "Le build de référence, très largement majoritaire : la lanterne, Flask of the Oasis pour le bouclier sur les alliés soignés à bas PV, Fleeting Time pour raccourcir la recharge de l'ultime à chaque élimination ou assistance.",
        items: ["Lantern of Hope", "Flask of the Oasis", "Fleeting Time"],
        emblem: "Emblème de soutien",
        talent: "Focusing Mark",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "carmilla",
    summary:
      "Tank de soutien qui lie les ennemis entre eux : un contrôle ou des dégâts sur l'un se propagent aux autres.",
    analysis:
      "Carmilla vit au contact. Son passif lui fait voler une partie des défenses des héros qu'elle touche, ses fleurs tournent autour d'elle en blessant, en ralentissant de plus en plus et en la soignant, et sa compétence 2 accumule de la vitesse avant de se relancer sur une cible pour l'étourdir, d'autant plus longtemps que la charge a duré. Son ultime maudit une zone : les ennemis qui y restent sont immobilisés puis liés, et tant qu'ils restent proches, un contrôle subi par l'un s'applique aux autres, avec une partie des dégâts.\n\n" +
      "Cette mécanique rend sa valeur très dépendante de ses alliés : ses meilleurs duos mesurés montrent des écarts parmi les plus forts relevés, avec Diggie, Floryn, Mathilda et Chip. Si les ennemis s'écartent les uns des autres, le lien se rompt. Elle figure parmi les héros renforcés du patch 2.1.88, sans détail publié sur le wiki. Les mesures la placent en difficulté face à X.Borg, Valentina, Natalia et Lesley.",
    skills: [
      {
        type: "Passive",
        name: "Vampire Pact",
        description:
          "Chaque fois qu'elle blesse un héros adverse, elle lui vole une partie de ses défenses physique et magique pour quelques secondes, en se cumulant, avec un délai avant de pouvoir revoler le même héros.",
      },
      {
        type: "Skill 1",
        name: "Crimson Flower",
        description:
          "Trois fleurs tournent autour d'elle, blessent les ennemis et les ralentissent de plus en plus. Chaque coup de fleur la soigne, beaucoup moins sur les sbires.",
      },
      {
        type: "Skill 2",
        name: "Bloodbath",
        description:
          "Accumule de l'énergie en gagnant de la vitesse, puis se relance sur un héros ou un monstre pour le blesser et l'étourdir. Plus la charge a duré, plus les dégâts et l'étourdissement sont forts.",
      },
      {
        type: "Ultimate",
        name: "Curse of Blood",
        description:
          "Maudit une zone qui ralentit, puis immobilise et lie les ennemis restés dedans. Un contrôle subi par un ennemi lié s'applique aux autres, qui reçoivent aussi une partie des dégâts ; le lien se rompt s'ils s'éloignent les uns des autres.",
      },
    ],
    strengths: [
      "Contrôles et dégâts partagés entre les ennemis liés",
      "Vole des défenses aux héros qu'elle touche",
      "Un soin continu pendant que ses fleurs frappent",
      "Un étourdissement dont la durée grandit avec la charge",
    ],
    weaknesses: [
      "Un lien rompu dès que les ennemis s'écartent",
      "Une valeur très dépendante des alliés qui exploitent le lien",
      "En difficulté face à X.Borg, Valentina et Natalia selon les mesures",
    ],
    strongAgainst: ["chip", "popol-and-kupa", "gloo", "minotaur"],
    weakAgainst: ["x-borg", "valentina", "natalia", "lesley"],
    builds: [
      {
        name: "Roam au contact",
        context:
          "Le build le plus joué, largement : Cursed Helmet brûle les ennemis autour d'elle et entretient ainsi le vol de défenses de son passif, Dominance Ice réduit leurs soins, Antique Cuirass affaiblit les dégâts physiques de ceux qui la touchent avec des compétences.",
        items: ["Cursed Helmet", "Dominance Ice", "Antique Cuirass"],
        emblem: "Emblème de tank",
        talent: "Concussive Blast",
        spell: "Petrify",
      },
    ],
  },
];
