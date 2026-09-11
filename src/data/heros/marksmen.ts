import type { AnalyseHeros } from "@/lib/types";

/** Analyses des tireurs. Donnees factuelles : voir la synchronisation. */
export const marksmen: AnalyseHeros[] = [
  {
    slug: "granger",
    resume:
      "Tireur à chargeur : ses dégâts viennent de ses compétences, pas de sa vitesse d'attaque.",
    analyse:
      "Granger ne se construit pas comme un tireur classique. Son passif fixe son attaque à six balles dont la dernière est critique, ce qui rend la vitesse d'attaque presque inutile sur lui : on achète des dégâts d'attaque et de la pénétration.\n\nCela lui donne un pic de puissance très précoce, exploitable en jungle dès le premier objet. Sa fragilité reste celle d'un tireur, aggravée par l'absence de tout contrôle : mal positionné, il n'a que sa compétence 2 pour espérer sortir.",
    competences: [
      {
        type: "Passif",
        nom: "Chargeur",
        description:
          "Son arme contient six balles. La dernière balle du chargeur inflige toujours un coup critique.",
      },
      {
        type: "Competence 1",
        nom: "Rafale",
        description:
          "Tire une salve en cône qui traverse les ennemis, avec des dégâts accrus sur la première cible touchée.",
        recharge: [10, 9.2, 8.4, 7.6, 6.8, 6],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Competence 2",
        nom: "Rythme",
        description:
          "Se déplace rapidement et recharge instantanément son arme, en gagnant de la vitesse d'attaque.",
        recharge: [14, 13, 12, 11, 10, 9],
        cout: [60, 60, 60, 60, 60, 60],
      },
      {
        type: "Ultime",
        nom: "Symphonie mortelle",
        description:
          "Équipe un canon à longue portée tirant des obus explosifs à travers la carte.",
        recharge: [45, 40, 35],
        cout: [80, 100, 120],
      },
    ],
    forces: [
      "Pic de puissance très précoce",
      "Dégâts à longue portée avec l'ultime",
      "Fonctionne en jungle comme en lane d'or",
    ],
    faiblesses: [
      "Aucun contrôle",
      "Très fragile, une seule esquive disponible",
      "Fin de partie plus faible que les tireurs à vitesse d'attaque",
    ],
    fortContre: ["layla", "miya", "hanabi", "estes"],
    faibleContre: ["khufra", "franco", "ling", "natalia"],
    builds: [
      {
        nom: "Or dégâts bruts",
        contexte:
          "La vitesse d'attaque n'apporte rien à son passif : on empile les dégâts d'attaque et la pénétration.",
        objets: [
          "Swift Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Malefic Roar",
          "Blade of Despair",
          "Immortality",
        ],
        embleme: "Emblème de tireur",
        talent: "Festival of Blood",
        sort: "Inspiration",
      },
    ],
  },
  {
    slug: "beatrix",
    resume:
      "Tireuse à quatre armes, chacune avec son propre ultime : elle change de rôle selon l'arme portée.",
    analyse:
      "Beatrix est en réalité quatre héros. Elle porte deux armes à la fois parmi quatre, et chacune redéfinit sa portée, sa cadence et son ultime : un fusil de précision à très longue portée, un fusil à pompe explosif, un fusil d'assaut à cadence rapide, un lance-grenades de zone.\n\nLe niveau de jeu consiste à choisir la bonne paire avant la partie, puis à alterner en combat. C'est ce qui la rend à la fois très forte en compétition et très punitive en file classée : une mauvaise paire, ou un mauvais changement au mauvais moment, et elle n'a plus de dégâts du tout.",
    competences: [
      {
        type: "Passif",
        nom: "Armurerie",
        description:
          "Beatrix porte deux armes parmi quatre. Chaque arme modifie ses attaques de base et remplace son ultime.",
      },
      {
        type: "Competence 1",
        nom: "Bombe fumigène",
        description:
          "Se déplace et laisse une fumée qui la dissimule brièvement.",
        recharge: [13, 12, 11, 10, 9, 8],
      },
      {
        type: "Competence 2",
        nom: "Changement d'arme",
        description:
          "Échange l'arme active contre la seconde arme portée, en rechargeant l'ultime correspondant.",
        recharge: [3, 3, 3, 3, 3, 3],
      },
      {
        type: "Ultime",
        nom: "Tir de l'arme active",
        description:
          "Dépend de l'arme portée : tir de précision longue portée, salve explosive, rafale rapide ou grenades de zone.",
      },
    ],
    forces: [
      "Portée et polyvalence sans équivalent",
      "Dégâts très élevés dès le début de partie",
      "S'adapte à toute composition adverse",
    ],
    faiblesses: [
      "La plus difficile à prendre en main de sa catégorie",
      "Fragile et lente sans sa fumée",
      "Une mauvaise paire d'armes est irrattrapable",
    ],
    fortContre: ["layla", "miya", "hanabi", "belerick"],
    faibleContre: ["ling", "fanny", "khufra", "natalia"],
    builds: [
      {
        nom: "Or longue portée",
        contexte:
          "Paire fusil de précision et lance-grenades : on tient la distance et on frappe les objectifs.",
        objets: [
          "Swift Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Malefic Roar",
          "Immortality",
          "Blade of Despair",
        ],
        embleme: "Emblème de tireur",
        talent: "Weapons Master",
        sort: "Inspiration",
      },
    ],
  },
  {
    slug: "melissa",
    resume:
      "Tireuse défensive : son ultime crée une zone que les ennemis au corps à corps ne peuvent pas franchir.",
    analyse:
      "Melissa résout le problème classique du tireur — se faire plonger — par une réponse directe. Son ultime pose un cercle qui repousse les adversaires en mêlée et réduit fortement leurs dégâts à l'intérieur, ce qui lui permet de continuer à tirer pendant qu'un assassin s'épuise à essayer d'entrer.\n\nElle reste une tireuse standard sur le reste : bonne montée en puissance, dégâts corrects, aucune menace hors de sa portée. Contre une équipe à distance qui l'ignore et frappe à travers la zone, l'ultime perd l'essentiel de sa valeur.",
    competences: [
      {
        type: "Passif",
        nom: "Poupées",
        description:
          "Ses dégâts augmentent contre les cibles proches ou éloignées selon la distance, et ses attaques ralentissent brièvement.",
      },
      {
        type: "Competence 1",
        nom: "Coup de balai",
        description:
          "Se déplace en projetant une poupée qui inflige des dégâts de zone.",
        recharge: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cout: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Competence 2",
        nom: "Poupée mécanique",
        description:
          "Invoque une poupée qui poursuit les ennemis et les ralentit.",
        recharge: [12, 11, 10, 9, 8, 7],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultime",
        nom: "Cercle protecteur",
        description:
          "Crée une zone que les ennemis au corps à corps ne peuvent pas franchir et dans laquelle leurs dégâts sont fortement réduits.",
        recharge: [50, 45, 40],
        cout: [100, 120, 140],
      },
    ],
    forces: [
      "Réponse directe aux assassins et aux plongeons",
      "Prise en main simple pour une tireuse moderne",
      "Ralentissements constants qui sécurisent le kiting",
    ],
    faiblesses: [
      "L'ultime ne protège pas des dégâts à distance",
      "Portée inférieure à celle des tireurs d'artillerie",
      "Peu utile pour engager ou créer une ouverture",
    ],
    fortContre: ["ling", "lancelot", "alucard", "chou", "zilong"],
    faibleContre: ["pharsa", "cecilion", "beatrix", "kimmy"],
    builds: [
      {
        nom: "Or standard",
        contexte:
          "Vitesse d'attaque et critique : Melissa tire en continu tant qu'elle n'est pas touchée.",
        objets: [
          "Swift Boots",
          "Berserker's Fury",
          "Windtalker",
          "Demon Hunter Sword",
          "Bloodlust Axe",
          "Immortality",
        ],
        embleme: "Emblème de tireur",
        talent: "Bargain Hunter",
        sort: "Inspiration",
      },
    ],
  },
];
