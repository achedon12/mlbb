import type { AnalyseHeros } from "@/lib/types";

/** Analyses des combattants. Donnees factuelles : voir la synchronisation. */
export const fighters: AnalyseHeros[] = [
  {
    slug: "chou",
    summary:
      "Combattant d'isolement : il extrait une cible du groupe adverse et la tue avant que son équipe ne réagisse.",
    analysis:
      "Chou est le héros de plus haut plafond du roam. L'idée est simple — l'ultime envoie une cible en l'air et la déplace — mais son exécution repose sur des annulations d'animation que le jeu n'explique nulle part. Le combo de référence enchaîne compétence 1, saut annulé, ultime, puis compétence 2 pour retenir la cible à l'atterrissage.\n\nSon intérêt en équipe organisée vient de là : il choisit qui meurt. Contre un joueur qui garde son Purify, en revanche, l'ultime perd la moitié de sa valeur, et Chou redevient un combattant moyen.",
    skills: [
      {
        type: "Passif",
        name: "Seul contre tous",
        description:
          "Toutes les quelques attaques de base, sa prochaine attaque devient un coup amélioré qui inflige des dégâts supplémentaires.",
      },
      {
        type: "Competence 1",
        name: "Coup de pied enchaîné",
        description:
          "Trois frappes successives. La dernière projette les ennemis touchés en l'air.",
        cooldown: [9, 8.4, 7.8, 7.2, 6.6, 6],
      },
      {
        type: "Competence 2",
        name: "Vague de fer",
        description:
          "Se rue dans une direction en devenant insensible aux contrôles pendant la course.",
        cooldown: [14, 13, 12, 11, 10, 9],
      },
      {
        type: "Ultime",
        name: "L'ultime coup",
        description:
          "Frappe une cible, la projette et la suit sur toute la trajectoire. Déplace un adversaire loin de son équipe.",
        cooldown: [40, 35, 30],
      },
    ],
    strengths: [
      "Choisit et isole une cible prioritaire",
      "Immunisé aux contrôles pendant sa compétence 2",
      "Excellent en escarmouche à deux ou trois",
    ],
    weaknesses: [
      "Exécution exigeante, très punitive à l'apprentissage",
      "Neutralisé par Purify sur la cible visée",
      "Dégâts faibles si l'isolement échoue",
    ],
    strongAgainst: ["layla", "pharsa", "cecilion", "estes", "kimmy"],
    weakAgainst: ["diggie", "khufra", "phoveus"],
    builds: [
      {
        name: "Roam d'isolement",
        context:
          "La version jouée en compétition : assez de résistance pour survivre à l'aller-retour, aucun objet de dégâts pur.",
        items: [
          "Warrior Boots",
          "Immortality",
          "Athena's Shield",
          "Antique Cuirass",
          "Blade Armor",
          "Guardian Helmet",
        ],
        emblem: "Emblème de soutien",
        talent: "Focusing Mark",
        spell: "Flicker",
      },
      {
        name: "Expérience offensif",
        context:
          "En lane d'expérience, quand Chou doit gagner son duel plutôt que servir son équipe.",
        items: [
          "Warrior Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Immortality",
          "Malefic Roar",
          "Antique Cuirass",
        ],
        emblem: "Emblème de combattant",
        talent: "Festival of Blood",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "yu-zhong",
    summary:
      "Combattant de lane d'expérience qui se soigne en frappant et devient très difficile à tuer en combat prolongé.",
    analysis:
      "Yu Zhong gagne les combats qui durent. Son passif transforme une partie des dégâts infligés en bouclier, ce qui le rend excellent dès qu'il y a plusieurs cibles à portée — un affrontement à cinq lui donne bien plus de retour qu'un duel.\n\nSon ultime le rend immunisé aux contrôles pendant qu'il avance, ce qui en fait aussi un initiateur crédible. Le contrer passe presque toujours par la réduction de soins : sans elle, un Yu Zhong bien équipé absorbe une équipe entière.",
    skills: [
      {
        type: "Passif",
        name: "Écailles du dragon sombre",
        description:
          "Les dégâts infligés par ses compétences se convertissent partiellement en bouclier, avec un rendement accru sur plusieurs cibles.",
      },
      {
        type: "Competence 1",
        name: "Griffe du dragon",
        description:
          "Enchaîne deux balayages devant lui. Le second inflige des dégâts accrus.",
        cooldown: [8, 7.4, 6.8, 6.2, 5.6, 5],
      },
      {
        type: "Competence 2",
        name: "Queue du dragon",
        description:
          "Bondit vers l'avant et projette les ennemis touchés. Sert autant à engager qu'à fuir.",
        cooldown: [11, 10.2, 9.4, 8.6, 7.8, 7],
      },
      {
        type: "Ultime",
        name: "Âme du dragon noir",
        description:
          "Prend une forme de dragon : immunisé aux contrôles, il avance en infligeant des dégâts de zone puis fait s'écraser un ennemi au sol.",
        cooldown: [54, 48, 42],
      },
    ],
    strengths: [
      "Régénération très forte dans les combats à cinq",
      "Immunité aux contrôles pendant l'ultime",
      "Bonne poussée de lane et bon contrôle de vague",
    ],
    weaknesses: [
      "Effondré par la réduction de soins",
      "Début de partie fragile avant le troisième objet",
      "Peu de dégâts sur cible unique isolée",
    ],
    strongAgainst: ["balmond", "alucard", "sun", "hilda"],
    weakAgainst: ["baxia", "dyrroth", "esmeralda", "phoveus"],
    builds: [
      {
        name: "Expérience régénération",
        context:
          "Le build de référence : de la résistance et du vol de vie, puisque le passif convertit déjà les dégâts en bouclier.",
        items: [
          "Warrior Boots",
          "Bloodlust Axe",
          "Immortality",
          "Antique Cuirass",
          "Athena's Shield",
          "Ares Belt",
        ],
        emblem: "Emblème de combattant",
        talent: "Festival of Blood",
        spell: "Vengeance",
      },
    ],
  },
  {
    slug: "paquito",
    summary:
      "Combattant à fenêtres : chaque compétence utilisée améliore la suivante, pour un pic de dégâts très court.",
    analysis:
      "Paquito ne se joue pas compétence par compétence mais par séquences. Chaque sort lancé charge une version améliorée du suivant, et tout son intérêt consiste à enchaîner ces versions améliorées dans le bon ordre avant que la fenêtre ne se ferme.\n\nBien joué, il supprime une cible fragile en deux secondes depuis une distance considérable. Mal joué, il gaspille ses versions améliorées sur des sbires et n'a plus rien. C'est un héros de rythme, très sensible au niveau du joueur.",
    skills: [
      {
        type: "Passif",
        name: "Posture de combat",
        description:
          "Utiliser une compétence améliore la prochaine compétence différente pendant quelques secondes.",
      },
      {
        type: "Competence 1",
        name: "Direct",
        description:
          "Frappe droit devant. Version améliorée : plus de portée, dégâts accrus et déplacement vers l'avant.",
        cooldown: [7.5, 7, 6.5, 6, 5.5, 5],
      },
      {
        type: "Competence 2",
        name: "Crochet",
        description:
          "Frappe en arc de cercle. Version améliorée : projette les ennemis touchés.",
        cooldown: [8, 7.5, 7, 6.5, 6, 5.5],
      },
      {
        type: "Ultime",
        name: "Enchaînement",
        description:
          "Se rue sur une cible et la repousse. Version améliorée : dégâts fortement accrus et projection.",
        cooldown: [32, 28, 24],
      },
    ],
    strengths: [
      "Pic de dégâts très élevé sur une fenêtre courte",
      "Grande portée d'engagement",
      "Aucun coût en mana",
    ],
    weaknesses: [
      "Perd tout son intérêt si les fenêtres sont gâchées",
      "Très vulnérable une fois ses compétences dépensées",
      "Punitif contre les héros qui gardent leur contrôle",
    ],
    strongAgainst: ["layla", "lesley", "cecilion", "pharsa"],
    weakAgainst: ["khufra", "phoveus", "esmeralda", "uranus"],
    builds: [
      {
        name: "Jungle explosif",
        context:
          "Quand l'objectif est de supprimer le tireur ou le mage adverse dès le premier engagement.",
        items: [
          "Swift Boots",
          "Bloodlust Axe",
          "Malefic Roar",
          "Queen's Wings",
          "Immortality",
          "Blade of Despair",
        ],
        emblem: "Emblème d'assassin",
        talent: "Festival of Blood",
        spell: "Execution",
      },
    ],
  },
];
