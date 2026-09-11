import type { AnalyseHeros } from "@/lib/types";

/** Analyses des soutiens. Donnees factuelles : voir la synchronisation. */
export const supports: AnalyseHeros[] = [
  {
    slug: "estes",
    resume:
      "Le soin le plus brut du jeu : son ultime régénère l'équipe entière pendant plusieurs secondes.",
    analyse:
      "Estes ne fait rien d'autre que soigner, mais il le fait à un volume qu'aucun autre soutien n'atteint. Dans un combat prolongé autour d'un objectif, son ultime peut annuler l'équivalent d'une composition entière de dégâts soutenus.\n\nCela en fait aussi le héros le plus dépendant du contexte du roster. Face à une équipe qui achète de la réduction de soins, ou qui possède un engagement capable de le supprimer en premier, il devient presque inutile. Il n'apporte ni contrôle, ni dégâts, ni mobilité : s'il ne soigne pas, il n'existe pas.",
    competences: [
      {
        type: "Passif",
        nom: "Présence sacrée",
        description:
          "Ses soins appliquent une marque qui augmente la régénération des alliés concernés.",
      },
      {
        type: "Competence 1",
        nom: "Réconfort",
        description: "Soigne un allié ciblé et augmente sa vitesse de déplacement.",
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
          "Crée une zone qui soigne continuellement tous les alliés présents pendant plusieurs secondes.",
        recharge: [55, 50, 45],
        cout: [150, 170, 190],
      },
    ],
    forces: [
      "Volume de soins inégalé sur la durée",
      "Rend les combats d'objectif très difficiles à perdre",
      "Simple à jouer correctement",
    ],
    faiblesses: [
      "Annulé par la réduction de soins",
      "Aucun contrôle fiable ni dégâts",
      "Cible prioritaire, et sans aucune fuite",
    ],
    fortContre: ["balmond", "alucard", "layla", "miya"],
    faibleContre: ["franco", "chou", "khufra", "baxia", "gusion"],
    builds: [
      {
        nom: "Roam soins",
        contexte:
          "Recharge et mana d'abord : le nombre d'ultimes lancés compte plus que leur puissance unitaire.",
        objets: [
          "Tough Boots",
          "Magic Shoes",
          "Winter Crown",
          "Enchanted Talisman",
          "Immortality",
          "Athena's Shield",
        ],
        embleme: "Emblème de soutien",
        talent: "Focusing Mark",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "angela",
    resume:
      "Soutien qui s'attache à un allié à travers la carte pour le renforcer et le protéger à distance.",
    analyse:
      "Angela joue une seconde partie en parallèle de la sienne. Son ultime lui permet de rejoindre n'importe quel allié où qu'il soit, en lui donnant un bouclier et un gain de statistiques pendant qu'elle est attachée — elle devient littéralement une extension du joueur choisi.\n\nBien utilisée, elle permet à un porteur de plonger avec une sécurité qu'il n'aurait jamais seul, et elle apparaît à l'autre bout de la carte pour renverser une escarmouche. Mal utilisée, elle passe la partie attachée au mauvais joueur et n'influence rien.",
    competences: [
      {
        type: "Passif",
        nom: "Cœur de poupée",
        description:
          "Ses compétences appliquent des charges qui augmentent les dégâts subis par la cible ou les soins reçus par l'allié.",
      },
      {
        type: "Competence 1",
        nom: "Onde d'amour",
        description: "Projette une onde qui inflige des dégâts et ralentit les ennemis touchés.",
        recharge: [8, 7.4, 6.8, 6.2, 5.6, 5],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Competence 2",
        nom: "Chaîne du destin",
        description:
          "Relie une cible : un ennemi est immobilisé après un délai, un allié reçoit un soin continu.",
        recharge: [13, 12, 11, 10, 9, 8],
        cout: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Ultime",
        nom: "Attachement",
        description:
          "S'attache à un allié n'importe où sur la carte, lui accordant un bouclier et des statistiques accrues.",
        recharge: [60, 50, 40],
        cout: [120, 140, 160],
      },
    ],
    forces: [
      "Présence globale : intervient partout sur la carte",
      "Bouclier qui sauve réellement un porteur plongé",
      "Excellente en duo coordonné",
    ],
    faiblesses: [
      "Extrêmement fragile en dehors de son ultime",
      "Sa valeur dépend du niveau de l'allié choisi",
      "Facile à tuer pendant qu'elle est attachée si le porteur tombe",
    ],
    fortContre: ["layla", "miya", "balmond"],
    faibleContre: ["franco", "khufra", "chou", "natalia"],
    builds: [
      {
        nom: "Roam protection",
        contexte:
          "Recharge d'abord, puis de la résistance : Angela doit pouvoir relancer son ultime souvent.",
        objets: [
          "Tough Boots",
          "Magic Shoes",
          "Winter Crown",
          "Enchanted Talisman",
          "Immortality",
          "Radiant Armor",
        ],
        embleme: "Emblème de soutien",
        talent: "Focusing Mark",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "mathilda",
    resume:
      "Soutien de mobilité : elle emmène un allié avec elle, pour engager ou pour extraire.",
    analyse:
      "Mathilda est le soutien le plus polyvalent du jeu actuel. Sa compétence 2 embarque un allié dans son déplacement, ce qui permet aussi bien d'amener un combattant au contact que de sortir un tireur d'une mauvaise position. Son ultime, lui, verrouille une cible et sert d'initiation ciblée.\n\nElle a aussi des dégâts réels, ce qui la rend jouable en assassin secondaire quand la partie tourne mal. Sa difficulté tient à la lecture : chaque déplacement engage deux joueurs à la fois, et une erreur coûte deux morts au lieu d'une.",
    competences: [
      {
        type: "Passif",
        nom: "Âme ailée",
        description:
          "Ses compétences génèrent un bouclier et augmentent brièvement sa vitesse de déplacement.",
      },
      {
        type: "Competence 1",
        nom: "Guidance ancestrale",
        description:
          "Envoie des esprits qui infligent des dégâts et marquent les ennemis touchés.",
        recharge: [8.5, 8, 7.5, 7, 6.5, 6],
        cout: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Competence 2",
        nom: "Envol",
        description:
          "S'envole dans une direction en emmenant l'allié le plus proche avec elle.",
        recharge: [15, 14, 13, 12, 11, 10],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultime",
        nom: "Circulation",
        description:
          "Se rue sur une cible marquée, l'immobilise et inflige des dégâts à la zone.",
        recharge: [36, 32, 28],
        cout: [100, 120, 140],
      },
    ],
    forces: [
      "Repositionne un allié, en attaque comme en défense",
      "Dégâts réels pour un soutien",
      "Rotations de carte très rapides",
    ],
    faiblesses: [
      "Une erreur de déplacement engage deux joueurs",
      "Aucun soin",
      "Fragile si l'ultime est utilisé à vide",
    ],
    fortContre: ["layla", "estes", "cecilion", "pharsa"],
    faibleContre: ["khufra", "franco", "diggie"],
    builds: [
      {
        nom: "Roam mobilité",
        contexte:
          "Un peu de dégâts pour rester une menace, le reste en recharge et en résistance.",
        objets: [
          "Tough Boots",
          "Enchanted Talisman",
          "Winter Crown",
          "Immortality",
          "Athena's Shield",
          "Divine Glaive",
        ],
        embleme: "Emblème de soutien",
        talent: "Focusing Mark",
        sort: "Flicker",
      },
    ],
  },
];
