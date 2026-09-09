import type { AnalyseHeros } from "@/lib/types";

/** Analyses des soutiens. Donnees factuelles : voir la synchronisation. */
export const supports: AnalyseHeros[] = [
  {
    slug: "estes",
    resume:
      "Le soin le plus brut du jeu : son ultime regenere l'equipe entiere pendant plusieurs secondes.",
    analyse:
      "Estes ne fait rien d'autre que soigner, mais il le fait a un volume qu'aucun autre soutien n'atteint. Dans un combat prolonge autour d'un objectif, son ultime peut annuler l'equivalent d'une composition entiere de degats soutenus.\n\nCela en fait aussi le heros le plus dependant du contexte du roster. Face a une equipe qui achete de la reduction de soins, ou qui possede un engagement capable de le supprimer en premier, il devient presque inutile. Il n'apporte ni controle, ni degats, ni mobilite : s'il ne soigne pas, il n'existe pas.",
    competences: [
      {
        type: "Passif",
        nom: "Presence sacree",
        description:
          "Ses soins appliquent une marque qui augmente la regeneration des allies concernes.",
      },
      {
        type: "Competence 1",
        nom: "Reconfort",
        description: "Soigne un allie cible et augmente sa vitesse de deplacement.",
        recharge: [8, 7.4, 6.8, 6.2, 5.6, 5],
        cout: [90, 100, 110, 120, 130, 140],
      },
      {
        type: "Competence 2",
        nom: "Lien spirituel",
        description:
          "Relie une cible ennemie, la ralentit, puis l'immobilise si le lien tient assez longtemps.",
        recharge: [12, 11, 10, 9, 8, 7],
        cout: [70, 80, 90, 100, 110, 120],
      },
      {
        type: "Ultime",
        nom: "Bosquet de vie",
        description:
          "Cree une zone qui soigne continuellement tous les allies presents pendant plusieurs secondes.",
        recharge: [55, 50, 45],
        cout: [150, 170, 190],
      },
    ],
    forces: [
      "Volume de soins inegale sur la duree",
      "Rend les combats d'objectif tres difficiles a perdre",
      "Simple a jouer correctement",
    ],
    faiblesses: [
      "Annule par la reduction de soins",
      "Aucun controle fiable ni degats",
      "Cible prioritaire, et sans aucune fuite",
    ],
    fortContre: ["balmond", "alucard", "layla", "miya"],
    faibleContre: ["franco", "chou", "khufra", "baxia", "gusion"],
    builds: [
      {
        nom: "Roam soins",
        contexte:
          "Recharge et mana d'abord : le nombre d'ultimes lances compte plus que leur puissance unitaire.",
        objets: [
          "Bottes en cuir",
          "Bottes oracles",
          "Sablier de Kadita",
          "Talisman de glace",
          "Trepas immortel",
          "Bouclier d'Athena",
        ],
        embleme: "Embleme de soutien",
        talent: "Sauveur",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "angela",
    resume:
      "Soutien qui s'attache a un allie a travers la carte pour le renforcer et le proteger a distance.",
    analyse:
      "Angela joue une seconde partie en parallele de la sienne. Son ultime lui permet de rejoindre n'importe quel allie ou qu'il soit, en lui donnant un bouclier et un gain de statistiques pendant qu'elle est attachee — elle devient litteralement une extension du joueur choisi.\n\nBien utilisee, elle permet a un porteur de plonger avec une securite qu'il n'aurait jamais seul, et elle apparait a l'autre bout de la carte pour renverser une escarmouche. Mal utilisee, elle passe la partie attachee au mauvais joueur et n'influence rien.",
    competences: [
      {
        type: "Passif",
        nom: "Coeur de poupee",
        description:
          "Ses competences appliquent des charges qui augmentent les degats subis par la cible ou les soins recus par l'allie.",
      },
      {
        type: "Competence 1",
        nom: "Onde d'amour",
        description: "Projette une onde qui inflige des degats et ralentit les ennemis touches.",
        recharge: [8, 7.4, 6.8, 6.2, 5.6, 5],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Competence 2",
        nom: "Chaine du destin",
        description:
          "Relie une cible : un ennemi est immobilise apres un delai, un allie recoit un soin continu.",
        recharge: [13, 12, 11, 10, 9, 8],
        cout: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Ultime",
        nom: "Attachement",
        description:
          "S'attache a un allie n'importe ou sur la carte, lui accordant un bouclier et des statistiques accrues.",
        recharge: [60, 50, 40],
        cout: [120, 140, 160],
      },
    ],
    forces: [
      "Presence globale : intervient partout sur la carte",
      "Bouclier qui sauve reellement un porteur plonge",
      "Excellente en duo coordonne",
    ],
    faiblesses: [
      "Extremement fragile en dehors de son ultime",
      "Sa valeur depend du niveau de l'allie choisi",
      "Facile a tuer pendant qu'elle est attachee si le porteur tombe",
    ],
    fortContre: ["layla", "miya", "balmond"],
    faibleContre: ["franco", "khufra", "chou", "natalia"],
    builds: [
      {
        nom: "Roam protection",
        contexte:
          "Recharge d'abord, puis de la resistance : Angela doit pouvoir relancer son ultime souvent.",
        objets: [
          "Bottes en cuir",
          "Bottes oracles",
          "Sablier de Kadita",
          "Talisman de glace",
          "Trepas immortel",
          "Cape de Radiance",
        ],
        embleme: "Embleme de soutien",
        talent: "Sauveur",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "mathilda",
    resume:
      "Soutien de mobilite : elle emmene un allie avec elle, pour engager ou pour extraire.",
    analyse:
      "Mathilda est le soutien le plus polyvalent du jeu actuel. Sa competence 2 embarque un allie dans son deplacement, ce qui permet aussi bien d'amener un combattant au contact que de sortir un tireur d'une mauvaise position. Son ultime, lui, verrouille une cible et sert d'initiation ciblee.\n\nElle a aussi des degats reels, ce qui la rend jouable en assassin secondaire quand la partie tourne mal. Sa difficulte tient a la lecture : chaque deplacement engage deux joueurs a la fois, et une erreur coute deux morts au lieu d'une.",
    competences: [
      {
        type: "Passif",
        nom: "Ame ailee",
        description:
          "Ses competences generent un bouclier et augmentent brievement sa vitesse de deplacement.",
      },
      {
        type: "Competence 1",
        nom: "Guidance ancestrale",
        description:
          "Envoie des esprits qui infligent des degats et marquent les ennemis touches.",
        recharge: [8.5, 8, 7.5, 7, 6.5, 6],
        cout: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Competence 2",
        nom: "Envol",
        description:
          "S'envole dans une direction en emmenant l'allie le plus proche avec elle.",
        recharge: [15, 14, 13, 12, 11, 10],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultime",
        nom: "Circulation",
        description:
          "Se rue sur une cible marquee, l'immobilise et inflige des degats a la zone.",
        recharge: [36, 32, 28],
        cout: [100, 120, 140],
      },
    ],
    forces: [
      "Repositionne un allie, en attaque comme en defense",
      "Degats reels pour un soutien",
      "Rotations de carte tres rapides",
    ],
    faiblesses: [
      "Une erreur de deplacement engage deux joueurs",
      "Aucun soin",
      "Fragile si l'ultime est utilise a vide",
    ],
    fortContre: ["layla", "estes", "cecilion", "pharsa"],
    faibleContre: ["khufra", "franco", "diggie"],
    builds: [
      {
        nom: "Roam mobilite",
        contexte:
          "Un peu de degats pour rester une menace, le reste en recharge et en resistance.",
        objets: [
          "Bottes en cuir",
          "Talisman de glace",
          "Sablier de Kadita",
          "Trepas immortel",
          "Bouclier d'Athena",
          "Anneau de flamme sacree",
        ],
        embleme: "Embleme de soutien",
        talent: "Sauveur",
        sort: "Flicker",
      },
    ],
  },
];
