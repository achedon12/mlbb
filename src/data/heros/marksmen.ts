import type { AnalyseHeros } from "@/lib/types";

/** Analyses des tireurs. Donnees factuelles : voir la synchronisation. */
export const marksmen: AnalyseHeros[] = [
  {
    slug: "granger",
    resume:
      "Tireur a chargeur : ses degats viennent de ses competences, pas de sa vitesse d'attaque.",
    analyse:
      "Granger ne se construit pas comme un tireur classique. Son passif fixe son attaque a six balles dont la derniere est critique, ce qui rend la vitesse d'attaque presque inutile sur lui : on achete des degats d'attaque et de la penetration.\n\nCela lui donne un pic de puissance tres precoce, exploitable en jungle des le premier objet. Sa fragilite reste celle d'un tireur, aggravee par l'absence de tout controle : mal positionne, il n'a que sa competence 2 pour esperer sortir.",
    competences: [
      {
        type: "Passif",
        nom: "Chargeur",
        description:
          "Son arme contient six balles. La derniere balle du chargeur inflige toujours un coup critique.",
      },
      {
        type: "Competence 1",
        nom: "Rafale",
        description:
          "Tire une salve en cone qui traverse les ennemis, avec des degats accrus sur la premiere cible touchee.",
        recharge: [10, 9.2, 8.4, 7.6, 6.8, 6],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Competence 2",
        nom: "Rythme",
        description:
          "Se deplace rapidement et recharge instantanement son arme, en gagnant de la vitesse d'attaque.",
        recharge: [14, 13, 12, 11, 10, 9],
        cout: [60, 60, 60, 60, 60, 60],
      },
      {
        type: "Ultime",
        nom: "Symphonie mortelle",
        description:
          "Equipe un canon a longue portee tirant des obus explosifs a travers la carte.",
        recharge: [45, 40, 35],
        cout: [80, 100, 120],
      },
    ],
    forces: [
      "Pic de puissance tres precoce",
      "Degats a longue portee avec l'ultime",
      "Fonctionne en jungle comme en lane d'or",
    ],
    faiblesses: [
      "Aucun controle",
      "Tres fragile, une seule esquive disponible",
      "Fin de partie plus faible que les tireurs a vitesse d'attaque",
    ],
    fortContre: ["layla", "miya", "hanabi", "estes"],
    faibleContre: ["khufra", "franco", "ling", "natalia"],
    builds: [
      {
        nom: "Or degats bruts",
        contexte:
          "La vitesse d'attaque n'apporte rien a son passif : on empile les degats d'attaque et la penetration.",
        objets: [
          "Swift Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Malefic Roar",
          "Blade of Despair",
          "Immortality",
        ],
        embleme: "Embleme de tireur",
        talent: "Chasseur",
        sort: "Inspiration",
      },
    ],
  },
  {
    slug: "beatrix",
    resume:
      "Tireuse a quatre armes, chacune avec son propre ultime : elle change de role selon l'arme portee.",
    analyse:
      "Beatrix est en realite quatre heros. Elle porte deux armes a la fois parmi quatre, et chacune redefinit sa portee, sa cadence et son ultime : un fusil de precision a tres longue portee, un fusil a pompe explosif, un fusil d'assaut a cadence rapide, un lance-grenades de zone.\n\nLe niveau de jeu consiste a choisir la bonne paire avant la partie, puis a alterner en combat. C'est ce qui la rend a la fois tres forte en competition et tres punitive en file classee : une mauvaise paire, ou un mauvais changement au mauvais moment, et elle n'a plus de degats du tout.",
    competences: [
      {
        type: "Passif",
        nom: "Armurerie",
        description:
          "Beatrix porte deux armes parmi quatre. Chaque arme modifie ses attaques de base et remplace son ultime.",
      },
      {
        type: "Competence 1",
        nom: "Bombe fumigene",
        description:
          "Se deplace et laisse une fumee qui la dissimule brievement.",
        recharge: [13, 12, 11, 10, 9, 8],
      },
      {
        type: "Competence 2",
        nom: "Changement d'arme",
        description:
          "Echange l'arme active contre la seconde arme portee, en rechargeant l'ultime correspondant.",
        recharge: [3, 3, 3, 3, 3, 3],
      },
      {
        type: "Ultime",
        nom: "Tir de l'arme active",
        description:
          "Depend de l'arme portee : tir de precision longue portee, salve explosive, rafale rapide ou grenades de zone.",
      },
    ],
    forces: [
      "Portee et polyvalence sans equivalent",
      "Degats tres eleves des le debut de partie",
      "S'adapte a toute composition adverse",
    ],
    faiblesses: [
      "La plus difficile a prendre en main de sa categorie",
      "Fragile et lente sans sa fumee",
      "Une mauvaise paire d'armes est irrattrapable",
    ],
    fortContre: ["layla", "miya", "hanabi", "belerick"],
    faibleContre: ["ling", "fanny", "khufra", "natalia"],
    builds: [
      {
        nom: "Or longue portee",
        contexte:
          "Paire fusil de precision et lance-grenades : on tient la distance et on frappe les objectifs.",
        objets: [
          "Swift Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Malefic Roar",
          "Immortality",
          "Blade of Despair",
        ],
        embleme: "Embleme de tireur",
        talent: "Chasseur",
        sort: "Inspiration",
      },
    ],
  },
  {
    slug: "melissa",
    resume:
      "Tireuse defensive : son ultime cree une zone que les ennemis au corps a corps ne peuvent pas franchir.",
    analyse:
      "Melissa resout le probleme classique du tireur — se faire plonger — par une reponse directe. Son ultime pose un cercle qui repousse les adversaires en melee et reduit fortement leurs degats a l'interieur, ce qui lui permet de continuer a tirer pendant qu'un assassin s'epuise a essayer d'entrer.\n\nElle reste une tireuse standard sur le reste : bonne montee en puissance, degats corrects, aucune menace hors de sa portee. Contre une equipe a distance qui l'ignore et frappe a travers la zone, l'ultime perd l'essentiel de sa valeur.",
    competences: [
      {
        type: "Passif",
        nom: "Poupees",
        description:
          "Ses degats augmentent contre les cibles proches ou eloignees selon la distance, et ses attaques ralentissent brievement.",
      },
      {
        type: "Competence 1",
        nom: "Coup de balai",
        description:
          "Se deplace en projetant une poupee qui inflige des degats de zone.",
        recharge: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cout: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Competence 2",
        nom: "Poupee mecanique",
        description:
          "Invoque une poupee qui poursuit les ennemis et les ralentit.",
        recharge: [12, 11, 10, 9, 8, 7],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultime",
        nom: "Cercle protecteur",
        description:
          "Cree une zone que les ennemis au corps a corps ne peuvent pas franchir et dans laquelle leurs degats sont fortement reduits.",
        recharge: [50, 45, 40],
        cout: [100, 120, 140],
      },
    ],
    forces: [
      "Reponse directe aux assassins et aux plongeons",
      "Prise en main simple pour une tireuse moderne",
      "Ralentissements constants qui securisent le kiting",
    ],
    faiblesses: [
      "L'ultime ne protege pas des degats a distance",
      "Portee inferieure a celle des tireurs d'artillerie",
      "Peu utile pour engager ou creer une ouverture",
    ],
    fortContre: ["ling", "lancelot", "alucard", "chou", "zilong"],
    faibleContre: ["pharsa", "cecilion", "beatrix", "kimmy"],
    builds: [
      {
        nom: "Or standard",
        contexte:
          "Vitesse d'attaque et critique : Melissa tire en continu tant qu'elle n'est pas touchee.",
        objets: [
          "Swift Boots",
          "Berserker's Fury",
          "Windtalker",
          "Demon Hunter Sword",
          "Bloodlust Axe",
          "Immortality",
        ],
        embleme: "Embleme de tireur",
        talent: "Chasseur",
        sort: "Inspiration",
      },
    ],
  },
];
