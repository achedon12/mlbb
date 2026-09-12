import type { AnalyseHeros } from "@/lib/types";

/** Analyses des mages. Donnees factuelles : voir la synchronisation. */
export const mages: AnalyseHeros[] = [
  {
    slug: "kagura",
    summary:
      "Mage à deux états : ses compétences changent complètement selon qu'elle tient son ombrelle ou l'a posée.",
    analysis:
      "Kagura a en pratique huit compétences pour trois touches. Chaque sort a une version avec ombrelle et une version sans, et savoir dans quel état on se trouve est l'essentiel du héros. Le combo signature enchaîne la pose de l'ombrelle, un rappel qui traverse et projette, puis l'ultime pour verrouiller.\n\nElle est aussi l'un des rares mages capables de se sortir seule d'un mauvais positionnement, puisque la téléportation vers l'ombrelle sert de fuite. En contrepartie, une erreur d'état la laisse sans mobilité au milieu de l'équipe adverse.",
    skills: [
      {
        type: "Passif",
        name: "Yin Yang rassemblés",
        description:
          "Quand Kagura et son ombrelle sont réunies, ses compétences se rechargent plus vite et elle gagne un bouclier après un sort.",
      },
      {
        type: "Competence 1",
        name: "Seimei Umbrella Open",
        description:
          "Envoie l'ombrelle à un endroit, ou la rappelle. L'ombrelle posée ralentit les ennemis autour d'elle.",
        cooldown: [3, 3, 3, 3, 3, 3],
        cost: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Competence 2",
        name: "Rasho Umbrella Flee",
        description:
          "Avec l'ombrelle : se déplace dans une direction. Sans l'ombrelle : se téléporte vers elle en projetant les ennemis traversés.",
        cooldown: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cost: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultime",
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
        type: "Passif",
        name: "Terreur des cieux",
        description:
          "Après une compétence, sa prochaine attaque de base inflige des dégâts magiques supplémentaires.",
      },
      {
        type: "Competence 1",
        name: "Vague d'énergie",
        description:
          "Envoie une onde qui explose à distance, infligeant des dégâts de zone.",
        cooldown: [7.5, 7, 6.5, 6, 5.5, 5],
        cost: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Competence 2",
        name: "Forme aviaire",
        description:
          "Prend une forme volante pour se déplacer rapidement, en traversant les obstacles.",
        cooldown: [15, 14, 13, 12, 11, 10],
        cost: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultime",
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
        type: "Passif",
        name: "Soif de sang",
        description:
          "Chaque compétence touchant un ennemi accumule des charges permanentes qui augmentent ses dégâts et sa mana maximale.",
      },
      {
        type: "Competence 1",
        name: "Chauve-souris sanglantes",
        description:
          "Libère une vague de chauves-souris dans une direction, infligeant des dégâts de zone.",
        cooldown: [3.2, 3.2, 3.2, 3.2, 3.2, 3.2],
        cost: [26, 30, 34, 38, 42, 46],
      },
      {
        type: "Competence 2",
        name: "Étreinte funeste",
        description:
          "Fait surgir des griffes qui immobilisent brièvement les ennemis dans la zone.",
        cooldown: [11, 10.2, 9.4, 8.6, 7.8, 7],
        cost: [70, 80, 90, 100, 110, 120],
      },
      {
        type: "Ultime",
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
];
