import type { AnalyseHeros } from "@/lib/types";

/** Analyses des mages. Donnees factuelles : voir la synchronisation. */
export const mages: AnalyseHeros[] = [
  {
    slug: "kagura",
    resume:
      "Mage à deux états : ses compétences changent complètement selon qu'elle tient son ombrelle ou l'a posée.",
    analyse:
      "Kagura a en pratique huit compétences pour trois touches. Chaque sort a une version avec ombrelle et une version sans, et savoir dans quel état on se trouve est l'essentiel du héros. Le combo signature enchaîne la pose de l'ombrelle, un rappel qui traverse et projette, puis l'ultime pour verrouiller.\n\nElle est aussi l'un des rares mages capables de se sortir seule d'un mauvais positionnement, puisque la téléportation vers l'ombrelle sert de fuite. En contrepartie, une erreur d'état la laisse sans mobilité au milieu de l'équipe adverse.",
    competences: [
      {
        type: "Passif",
        nom: "Yin Yang rassemblés",
        description:
          "Quand Kagura et son ombrelle sont réunies, ses compétences se rechargent plus vite et elle gagne un bouclier après un sort.",
      },
      {
        type: "Competence 1",
        nom: "Seimei Umbrella Open",
        description:
          "Envoie l'ombrelle à un endroit, ou la rappelle. L'ombrelle posée ralentit les ennemis autour d'elle.",
        recharge: [3, 3, 3, 3, 3, 3],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Competence 2",
        nom: "Rasho Umbrella Flee",
        description:
          "Avec l'ombrelle : se déplace dans une direction. Sans l'ombrelle : se téléporte vers elle en projetant les ennemis traversés.",
        recharge: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cout: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultime",
        nom: "Yin Yang Gathering",
        description:
          "Immobilise et attire les ennemis autour de l'ombrelle, puis inflige des dégâts de zone importants.",
        recharge: [30, 27, 24],
        cout: [130, 150, 170],
      },
    ],
    forces: [
      "Dégâts de zone très élevés en milieu de partie",
      "Mobilité défensive rare pour un mage",
      "Contrôle de zone permanent autour de l'ombrelle",
    ],
    faiblesses: [
      "Gestion d'état exigeante, punitive à l'erreur",
      "Coût en mana élevé avant le premier objet",
      "Sans ombrelle à proximité, elle est immobile",
    ],
    fortContre: ["layla", "miya", "balmond", "alucard"],
    faibleContre: ["gusion", "natalia", "helcurt", "hayabusa"],
    builds: [
      {
        nom: "Milieu explosif",
        contexte:
          "Le build standard : pénétration magique pour conserver des dégâts face aux premiers objets défensifs.",
        objets: [
          "Arcane Boots",
          "Winter Crown",
          "Enchanted Talisman",
          "Glowing Wand",
          "Concentrated Energy",
          "Divine Glaive",
        ],
        embleme: "Emblème de mage",
        talent: "Lethal Ignition",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "pharsa",
    resume:
      "Mage d'artillerie : son ultime frappe à travers la carte, sans jamais entrer dans le combat.",
    analyse:
      "Pharsa joue sur la portée. Son ultime est un bombardement canalisé couvrant une zone énorme à longue distance, ce qui lui permet de participer à un combat qu'elle ne voit qu'à peine. Bien placé, ce sort seul peut décider d'un affrontement autour du seigneur.\n\nSa compétence 2 lui donne une forme volante qui traverse les murs, indispensable pour se repositionner après avoir canalisé. Le point faible est évident : pendant l'ultime elle est immobile et sans défense, et n'importe quel assassin qui la trouve la tue.",
    competences: [
      {
        type: "Passif",
        nom: "Terreur des cieux",
        description:
          "Après une compétence, sa prochaine attaque de base inflige des dégâts magiques supplémentaires.",
      },
      {
        type: "Competence 1",
        nom: "Vague d'énergie",
        description:
          "Envoie une onde qui explose à distance, infligeant des dégâts de zone.",
        recharge: [7.5, 7, 6.5, 6, 5.5, 5],
        cout: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Competence 2",
        nom: "Forme aviaire",
        description:
          "Prend une forme volante pour se déplacer rapidement, en traversant les obstacles.",
        recharge: [15, 14, 13, 12, 11, 10],
        cout: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultime",
        nom: "Tempête de plumes",
        description:
          "Canalise un bombardement sur une zone très étendue, à longue distance de la carte.",
        recharge: [40, 35, 30],
        cout: [150, 170, 190],
      },
    ],
    forces: [
      "Portée d'ultime parmi les plus grandes du jeu",
      "Participe aux combats sans s'exposer",
      "Repositionnement libre grâce à la forme volante",
    ],
    faiblesses: [
      "Immobile et sans défense pendant la canalisation",
      "Aucun contrôle fiable en cas d'engagement sur elle",
      "Dépend beaucoup de la vision de son équipe",
    ],
    fortContre: ["balmond", "hylos", "belerick", "uranus"],
    faibleContre: ["ling", "fanny", "gusion", "hayabusa", "natalia"],
    builds: [
      {
        nom: "Milieu artillerie",
        contexte:
          "Portée et dégâts bruts, avec un objet défensif tardif pour survivre à une plongée.",
        objets: [
          "Arcane Boots",
          "Enchanted Talisman",
          "Glowing Wand",
          "Concentrated Energy",
          "Divine Glaive",
          "Winter Crown",
        ],
        embleme: "Emblème de mage",
        talent: "Lethal Ignition",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "cecilion",
    resume:
      "Mage à cumul : il accumule du sang toute la partie et devient une menace de zone impossible à ignorer en fin de partie.",
    analyse:
      "Cecilion est un pari sur la durée. Chaque compétence lancée ajoute une charge permanente qui augmente ses dégâts et sa mana maximale — un Cecilion qui a farmé tranquillement pendant quinze minutes n'a plus rien à voir avec celui du début.\n\nEn contrepartie, il est extrêmement fragile avant d'avoir cumulé, et ses compétences ont une zone large mais lente. Face à une équipe qui l'attaque tôt et souvent, il n'atteint jamais son palier. C'est le héros type où le résultat dépend du rythme de la partie plus que du duel.",
    competences: [
      {
        type: "Passif",
        nom: "Soif de sang",
        description:
          "Chaque compétence touchant un ennemi accumule des charges permanentes qui augmentent ses dégâts et sa mana maximale.",
      },
      {
        type: "Competence 1",
        nom: "Chauve-souris sanglantes",
        description:
          "Libère une vague de chauves-souris dans une direction, infligeant des dégâts de zone.",
        recharge: [3.2, 3.2, 3.2, 3.2, 3.2, 3.2],
        cout: [26, 30, 34, 38, 42, 46],
      },
      {
        type: "Competence 2",
        nom: "Étreinte funeste",
        description:
          "Fait surgir des griffes qui immobilisent brièvement les ennemis dans la zone.",
        recharge: [11, 10.2, 9.4, 8.6, 7.8, 7],
        cout: [70, 80, 90, 100, 110, 120],
      },
      {
        type: "Ultime",
        nom: "Nuit éternelle",
        description:
          "Se soigne, gagne de la portée sur ses compétences et inflige des dégâts de zone massifs autour de lui.",
        recharge: [42, 36, 30],
        cout: [100, 120, 140],
      },
    ],
    forces: [
      "Dégâts de zone illimités en fin de partie",
      "Excellent contrôle de vague et poussée de lane",
      "Un des meilleurs mages pour tenir un objectif",
    ],
    faiblesses: [
      "Très fragile et sans mobilité",
      "Dépend entièrement de son cumul précoce",
      "Cible prioritaire de tous les assassins",
    ],
    fortContre: ["balmond", "hylos", "belerick", "sun", "uranus"],
    faibleContre: ["ling", "fanny", "gusion", "lancelot", "natalia"],
    builds: [
      {
        nom: "Milieu cumul",
        contexte:
          "Mana et recharge d'abord pour cumuler vite, dégâts ensuite. Le Sablier n'est pas optionnel.",
        objets: [
          "Arcane Boots",
          "Enchanted Talisman",
          "Glowing Wand",
          "Winter Crown",
          "Concentrated Energy",
          "Divine Glaive",
        ],
        embleme: "Emblème de mage",
        talent: "Lethal Ignition",
        sort: "Flicker",
      },
    ],
  },
];
