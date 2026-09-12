import type { AnalyseHeros } from "@/lib/types";

/** Analyses des tireurs. Donnees factuelles : voir la synchronisation. */
export const marksmen: AnalyseHeros[] = [
  {
    slug: "granger",
    summary:
      "Tireur à chargeur : ses dégâts viennent de ses compétences, pas de sa vitesse d'attaque.",
    analysis:
      "Granger ne se construit pas comme un tireur classique. Son passif fixe son attaque à six balles dont la dernière est critique, ce qui rend la vitesse d'attaque presque inutile sur lui : on achète des dégâts d'attaque et de la pénétration.\n\nCela lui donne un pic de puissance très précoce, exploitable en jungle dès le premier objet. Sa fragilité reste celle d'un tireur, aggravée par l'absence de tout contrôle : mal positionné, il n'a que sa compétence 2 pour espérer sortir.",
    skills: [
      {
        type: "Passif",
        name: "Chargeur",
        description:
          "Son arme contient six balles. La dernière balle du chargeur inflige toujours un coup critique.",
      },
      {
        type: "Competence 1",
        name: "Rafale",
        description:
          "Tire une salve en cône qui traverse les ennemis, avec des dégâts accrus sur la première cible touchée.",
        cooldown: [10, 9.2, 8.4, 7.6, 6.8, 6],
        cost: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Competence 2",
        name: "Rythme",
        description:
          "Se déplace rapidement et recharge instantanément son arme, en gagnant de la vitesse d'attaque.",
        cooldown: [14, 13, 12, 11, 10, 9],
        cost: [60, 60, 60, 60, 60, 60],
      },
      {
        type: "Ultime",
        name: "Symphonie mortelle",
        description:
          "Équipe un canon à longue portée tirant des obus explosifs à travers la carte.",
        cooldown: [45, 40, 35],
        cost: [80, 100, 120],
      },
    ],
    strengths: [
      "Pic de puissance très précoce",
      "Dégâts à longue portée avec l'ultime",
      "Fonctionne en jungle comme en lane d'or",
    ],
    weaknesses: [
      "Aucun contrôle",
      "Très fragile, une seule esquive disponible",
      "Fin de partie plus faible que les tireurs à vitesse d'attaque",
    ],
    strongAgainst: ["layla", "miya", "hanabi", "estes"],
    weakAgainst: ["khufra", "franco", "ling", "natalia"],
    builds: [
      {
        name: "Or dégâts bruts",
        context:
          "La vitesse d'attaque n'apporte rien à son passif : on empile les dégâts d'attaque et la pénétration.",
        items: [
          "Swift Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Malefic Roar",
          "Blade of Despair",
          "Immortality",
        ],
        emblem: "Emblème de tireur",
        talent: "Festival of Blood",
        spell: "Inspiration",
      },
    ],
  },
  {
    slug: "beatrix",
    summary:
      "Tireuse à quatre armes, chacune avec son propre ultime : elle change de rôle selon l'arme portée.",
    analysis:
      "Beatrix est en réalité quatre héros. Elle porte deux armes à la fois parmi quatre, et chacune redéfinit sa portée, sa cadence et son ultime : un fusil de précision à très longue portée, un fusil à pompe explosif, un fusil d'assaut à cadence rapide, un lance-grenades de zone.\n\nLe niveau de jeu consiste à choisir la bonne paire avant la partie, puis à alterner en combat. C'est ce qui la rend à la fois très forte en compétition et très punitive en file classée : une mauvaise paire, ou un mauvais changement au mauvais moment, et elle n'a plus de dégâts du tout.",
    skills: [
      {
        type: "Passif",
        name: "Armurerie",
        description:
          "Beatrix porte deux armes parmi quatre. Chaque arme modifie ses attaques de base et remplace son ultime.",
      },
      {
        type: "Competence 1",
        name: "Bombe fumigène",
        description:
          "Se déplace et laisse une fumée qui la dissimule brièvement.",
        cooldown: [13, 12, 11, 10, 9, 8],
      },
      {
        type: "Competence 2",
        name: "Changement d'arme",
        description:
          "Échange l'arme active contre la seconde arme portée, en rechargeant l'ultime correspondant.",
        cooldown: [3, 3, 3, 3, 3, 3],
      },
      {
        type: "Ultime",
        name: "Tir de l'arme active",
        description:
          "Dépend de l'arme portée : tir de précision longue portée, salve explosive, rafale rapide ou grenades de zone.",
      },
    ],
    strengths: [
      "Portée et polyvalence sans équivalent",
      "Dégâts très élevés dès le début de partie",
      "S'adapte à toute composition adverse",
    ],
    weaknesses: [
      "La plus difficile à prendre en main de sa catégorie",
      "Fragile et lente sans sa fumée",
      "Une mauvaise paire d'armes est irrattrapable",
    ],
    strongAgainst: ["layla", "miya", "hanabi", "belerick"],
    weakAgainst: ["ling", "fanny", "khufra", "natalia"],
    builds: [
      {
        name: "Or longue portée",
        context:
          "Paire fusil de précision et lance-grenades : on tient la distance et on frappe les objectifs.",
        items: [
          "Swift Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Malefic Roar",
          "Immortality",
          "Blade of Despair",
        ],
        emblem: "Emblème de tireur",
        talent: "Weapons Master",
        spell: "Inspiration",
      },
    ],
  },
  {
    slug: "melissa",
    summary:
      "Tireuse défensive : son ultime crée une zone que les ennemis au corps à corps ne peuvent pas franchir.",
    analysis:
      "Melissa résout le problème classique du tireur — se faire plonger — par une réponse directe. Son ultime pose un cercle qui repousse les adversaires en mêlée et réduit fortement leurs dégâts à l'intérieur, ce qui lui permet de continuer à tirer pendant qu'un assassin s'épuise à essayer d'entrer.\n\nElle reste une tireuse standard sur le reste : bonne montée en puissance, dégâts corrects, aucune menace hors de sa portée. Contre une équipe à distance qui l'ignore et frappe à travers la zone, l'ultime perd l'essentiel de sa valeur.",
    skills: [
      {
        type: "Passif",
        name: "Poupées",
        description:
          "Ses dégâts augmentent contre les cibles proches ou éloignées selon la distance, et ses attaques ralentissent brièvement.",
      },
      {
        type: "Competence 1",
        name: "Coup de balai",
        description:
          "Se déplace en projetant une poupée qui inflige des dégâts de zone.",
        cooldown: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cost: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Competence 2",
        name: "Poupée mécanique",
        description:
          "Invoque une poupée qui poursuit les ennemis et les ralentit.",
        cooldown: [12, 11, 10, 9, 8, 7],
        cost: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultime",
        name: "Cercle protecteur",
        description:
          "Crée une zone que les ennemis au corps à corps ne peuvent pas franchir et dans laquelle leurs dégâts sont fortement réduits.",
        cooldown: [50, 45, 40],
        cost: [100, 120, 140],
      },
    ],
    strengths: [
      "Réponse directe aux assassins et aux plongeons",
      "Prise en main simple pour une tireuse moderne",
      "Ralentissements constants qui sécurisent le kiting",
    ],
    weaknesses: [
      "L'ultime ne protège pas des dégâts à distance",
      "Portée inférieure à celle des tireurs d'artillerie",
      "Peu utile pour engager ou créer une ouverture",
    ],
    strongAgainst: ["ling", "lancelot", "alucard", "chou", "zilong"],
    weakAgainst: ["pharsa", "cecilion", "beatrix", "kimmy"],
    builds: [
      {
        name: "Or standard",
        context:
          "Vitesse d'attaque et critique : Melissa tire en continu tant qu'elle n'est pas touchée.",
        items: [
          "Swift Boots",
          "Berserker's Fury",
          "Windtalker",
          "Demon Hunter Sword",
          "Bloodlust Axe",
          "Immortality",
        ],
        emblem: "Emblème de tireur",
        talent: "Bargain Hunter",
        spell: "Inspiration",
      },
    ],
  },
];
