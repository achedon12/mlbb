import type { AnalyseHeros } from "@/lib/types";

/** Analyses des mages. Donnees factuelles : voir la synchronisation. */
export const mages: AnalyseHeros[] = [
  {
    slug: "kagura",
    resume:
      "Mage a deux etats : ses competences changent completement selon qu'elle tient son ombrelle ou l'a posee.",
    analyse:
      "Kagura a en pratique huit competences pour trois touches. Chaque sort a une version avec ombrelle et une version sans, et savoir dans quel etat on se trouve est l'essentiel du heros. Le combo signature enchaine la pose de l'ombrelle, un rappel qui traverse et projette, puis l'ultime pour verrouiller.\n\nElle est aussi l'un des rares mages capables de se sortir seule d'un mauvais positionnement, puisque la teleportation vers l'ombrelle sert de fuite. En contrepartie, une erreur d'etat la laisse sans mobilite au milieu de l'equipe adverse.",
    competences: [
      {
        type: "Passif",
        nom: "Yin Yang rassembles",
        description:
          "Quand Kagura et son ombrelle sont reunies, ses competences se rechargent plus vite et elle gagne un bouclier apres un sort.",
      },
      {
        type: "Competence 1",
        nom: "Seimei Umbrella Open",
        description:
          "Envoie l'ombrelle a un endroit, ou la rappelle. L'ombrelle posee ralentit les ennemis autour d'elle.",
        recharge: [3, 3, 3, 3, 3, 3],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Competence 2",
        nom: "Rasho Umbrella Flee",
        description:
          "Avec l'ombrelle : se deplace dans une direction. Sans l'ombrelle : se teleporte vers elle en projetant les ennemis traverses.",
        recharge: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cout: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultime",
        nom: "Yin Yang Gathering",
        description:
          "Immobilise et attire les ennemis autour de l'ombrelle, puis inflige des degats de zone importants.",
        recharge: [30, 27, 24],
        cout: [130, 150, 170],
      },
    ],
    forces: [
      "Degats de zone tres eleves en milieu de partie",
      "Mobilite defensive rare pour un mage",
      "Controle de zone permanent autour de l'ombrelle",
    ],
    faiblesses: [
      "Gestion d'etat exigeante, punitive a l'erreur",
      "Cout en mana eleve avant le premier objet",
      "Sans ombrelle a proximite, elle est immobile",
    ],
    fortContre: ["layla", "miya", "balmond", "alucard"],
    faibleContre: ["gusion", "natalia", "helcurt", "hayabusa"],
    builds: [
      {
        nom: "Milieu explosif",
        contexte:
          "Le build standard : penetration magique pour conserver des degats face aux premiers objets defensifs.",
        objets: [
          "Bottes magiques",
          "Sablier de Kadita",
          "Talisman de glace",
          "Baton divin",
          "Sceptre sanglant",
          "Anneau de flamme sacree",
        ],
        embleme: "Embleme de mage",
        talent: "Feu magique",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "pharsa",
    resume:
      "Mage d'artillerie : son ultime frappe a travers la carte, sans jamais entrer dans le combat.",
    analyse:
      "Pharsa joue sur la portee. Son ultime est un bombardement canalise couvrant une zone enorme a longue distance, ce qui lui permet de participer a un combat qu'elle ne voit qu'a peine. Bien place, ce sort seul peut decider d'un affrontement autour du seigneur.\n\nSa competence 2 lui donne une forme volante qui traverse les murs, indispensable pour se repositionner apres avoir canalise. Le point faible est evident : pendant l'ultime elle est immobile et sans defense, et n'importe quel assassin qui la trouve la tue.",
    competences: [
      {
        type: "Passif",
        nom: "Terreur des cieux",
        description:
          "Apres une competence, sa prochaine attaque de base inflige des degats magiques supplementaires.",
      },
      {
        type: "Competence 1",
        nom: "Vague de energie",
        description:
          "Envoie une onde qui explose a distance, infligeant des degats de zone.",
        recharge: [7.5, 7, 6.5, 6, 5.5, 5],
        cout: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Competence 2",
        nom: "Forme aviaire",
        description:
          "Prend une forme volante pour se deplacer rapidement, en traversant les obstacles.",
        recharge: [15, 14, 13, 12, 11, 10],
        cout: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultime",
        nom: "Tempete de plumes",
        description:
          "Canalise un bombardement sur une zone tres etendue, a longue distance de la carte.",
        recharge: [40, 35, 30],
        cout: [150, 170, 190],
      },
    ],
    forces: [
      "Portee d'ultime parmi les plus grandes du jeu",
      "Participe aux combats sans s'exposer",
      "Repositionnement libre grace a la forme volante",
    ],
    faiblesses: [
      "Immobile et sans defense pendant la canalisation",
      "Aucun controle fiable en cas d'engagement sur elle",
      "Depend beaucoup de la vision de son equipe",
    ],
    fortContre: ["balmond", "hylos", "belerick", "uranus"],
    faibleContre: ["ling", "fanny", "gusion", "hayabusa", "natalia"],
    builds: [
      {
        nom: "Milieu artillerie",
        contexte:
          "Portee et degats bruts, avec un objet defensif tardif pour survivre a une plongee.",
        objets: [
          "Bottes magiques",
          "Talisman de glace",
          "Baton divin",
          "Sceptre sanglant",
          "Anneau de flamme sacree",
          "Sablier de Kadita",
        ],
        embleme: "Embleme de mage",
        talent: "Feu magique",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "cecilion",
    resume:
      "Mage a cumul : il accumule du sang toute la partie et devient une menace de zone impossible a ignorer en fin de partie.",
    analyse:
      "Cecilion est un pari sur la duree. Chaque competence lancee ajoute une charge permanente qui augmente ses degats et sa mana maximale — un Cecilion qui a farme tranquillement pendant quinze minutes n'a plus rien a voir avec celui du debut.\n\nEn contrepartie, il est extremement fragile avant d'avoir cumule, et ses competences ont une zone large mais lente. Face a une equipe qui l'attaque tot et souvent, il n'atteint jamais son palier. C'est le heros type ou le resultat depend du rythme de la partie plus que du duel.",
    competences: [
      {
        type: "Passif",
        nom: "Soif de sang",
        description:
          "Chaque competence touchant un ennemi accumule des charges permanentes qui augmentent ses degats et sa mana maximale.",
      },
      {
        type: "Competence 1",
        nom: "Chauve-souris sanglantes",
        description:
          "Libere une vague de chauves-souris dans une direction, infligeant des degats de zone.",
        recharge: [3.2, 3.2, 3.2, 3.2, 3.2, 3.2],
        cout: [26, 30, 34, 38, 42, 46],
      },
      {
        type: "Competence 2",
        nom: "Etreinte funeste",
        description:
          "Fait surgir des griffes qui immobilisent brievement les ennemis dans la zone.",
        recharge: [11, 10.2, 9.4, 8.6, 7.8, 7],
        cout: [70, 80, 90, 100, 110, 120],
      },
      {
        type: "Ultime",
        nom: "Nuit eternelle",
        description:
          "Se soigne, gagne de la portee sur ses competences et inflige des degats de zone massifs autour de lui.",
        recharge: [42, 36, 30],
        cout: [100, 120, 140],
      },
    ],
    forces: [
      "Degats de zone illimites en fin de partie",
      "Excellent controle de vague et poussee de lane",
      "Un des meilleurs mages pour tenir un objectif",
    ],
    faiblesses: [
      "Tres fragile et sans mobilite",
      "Depend entierement de son cumul precoce",
      "Cible prioritaire de tous les assassins",
    ],
    fortContre: ["balmond", "hylos", "belerick", "sun", "uranus"],
    faibleContre: ["ling", "fanny", "gusion", "lancelot", "natalia"],
    builds: [
      {
        nom: "Milieu cumul",
        contexte:
          "Mana et recharge d'abord pour cumuler vite, degats ensuite. Le Sablier n'est pas optionnel.",
        objets: [
          "Bottes magiques",
          "Talisman de glace",
          "Baton divin",
          "Sablier de Kadita",
          "Sceptre sanglant",
          "Anneau de flamme sacree",
        ],
        embleme: "Embleme de mage",
        talent: "Feu magique",
        sort: "Flicker",
      },
    ],
  },
];
