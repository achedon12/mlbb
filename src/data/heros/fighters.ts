import type { AnalyseHeros } from "@/lib/types";

/** Analyses des combattants. Donnees factuelles : voir la synchronisation. */
export const fighters: AnalyseHeros[] = [
  {
    slug: "chou",
    resume:
      "Combattant d'isolement : il extrait une cible du groupe adverse et la tue avant que son équipe ne réagisse.",
    analyse:
      "Chou est le héros de plus haut plafond du roam. L'idée est simple — l'ultime envoie une cible en l'air et la déplace — mais son exécution repose sur des annulations d'animation que le jeu n'explique nulle part. Le combo de référence enchaîne compétence 1, saut annulé, ultime, puis compétence 2 pour retenir la cible à l'atterrissage.\n\nSon intérêt en équipe organisée vient de là : il choisit qui meurt. Contre un joueur qui garde son Purify, en revanche, l'ultime perd la moitié de sa valeur, et Chou redevient un combattant moyen.",
    competences: [
      {
        type: "Passif",
        nom: "Seul contre tous",
        description:
          "Toutes les quelques attaques de base, sa prochaine attaque devient un coup amélioré qui inflige des dégâts supplémentaires.",
      },
      {
        type: "Competence 1",
        nom: "Coup de pied enchaîné",
        description:
          "Trois frappes successives. La dernière projette les ennemis touchés en l'air.",
        recharge: [9, 8.4, 7.8, 7.2, 6.6, 6],
      },
      {
        type: "Competence 2",
        nom: "Vague de fer",
        description:
          "Se rue dans une direction en devenant insensible aux contrôles pendant la course.",
        recharge: [14, 13, 12, 11, 10, 9],
      },
      {
        type: "Ultime",
        nom: "L'ultime coup",
        description:
          "Frappe une cible, la projette et la suit sur toute la trajectoire. Déplace un adversaire loin de son équipe.",
        recharge: [40, 35, 30],
      },
    ],
    forces: [
      "Choisit et isole une cible prioritaire",
      "Immunisé aux contrôles pendant sa compétence 2",
      "Excellent en escarmouche à deux ou trois",
    ],
    faiblesses: [
      "Exécution exigeante, très punitive à l'apprentissage",
      "Neutralisé par Purify sur la cible visée",
      "Dégâts faibles si l'isolement échoue",
    ],
    fortContre: ["layla", "pharsa", "cecilion", "estes", "kimmy"],
    faibleContre: ["diggie", "khufra", "phoveus"],
    builds: [
      {
        nom: "Roam d'isolement",
        contexte:
          "La version jouée en compétition : assez de résistance pour survivre à l'aller-retour, aucun objet de dégâts pur.",
        objets: [
          "Warrior Boots",
          "Immortality",
          "Athena's Shield",
          "Antique Cuirass",
          "Blade Armor",
          "Guardian Helmet",
        ],
        embleme: "Emblème de soutien",
        talent: "Focusing Mark",
        sort: "Flicker",
      },
      {
        nom: "Expérience offensif",
        contexte:
          "En lane d'expérience, quand Chou doit gagner son duel plutôt que servir son équipe.",
        objets: [
          "Warrior Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Immortality",
          "Malefic Roar",
          "Antique Cuirass",
        ],
        embleme: "Emblème de combattant",
        talent: "Festival of Blood",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "yu-zhong",
    resume:
      "Combattant de lane d'expérience qui se soigne en frappant et devient très difficile à tuer en combat prolongé.",
    analyse:
      "Yu Zhong gagne les combats qui durent. Son passif transforme une partie des dégâts infligés en bouclier, ce qui le rend excellent dès qu'il y a plusieurs cibles à portée — un affrontement à cinq lui donne bien plus de retour qu'un duel.\n\nSon ultime le rend immunisé aux contrôles pendant qu'il avance, ce qui en fait aussi un initiateur crédible. Le contrer passe presque toujours par la réduction de soins : sans elle, un Yu Zhong bien équipé absorbe une équipe entière.",
    competences: [
      {
        type: "Passif",
        nom: "Écailles du dragon sombre",
        description:
          "Les dégâts infligés par ses compétences se convertissent partiellement en bouclier, avec un rendement accru sur plusieurs cibles.",
      },
      {
        type: "Competence 1",
        nom: "Griffe du dragon",
        description:
          "Enchaîne deux balayages devant lui. Le second inflige des dégâts accrus.",
        recharge: [8, 7.4, 6.8, 6.2, 5.6, 5],
      },
      {
        type: "Competence 2",
        nom: "Queue du dragon",
        description:
          "Bondit vers l'avant et projette les ennemis touchés. Sert autant à engager qu'à fuir.",
        recharge: [11, 10.2, 9.4, 8.6, 7.8, 7],
      },
      {
        type: "Ultime",
        nom: "Âme du dragon noir",
        description:
          "Prend une forme de dragon : immunisé aux contrôles, il avance en infligeant des dégâts de zone puis fait s'écraser un ennemi au sol.",
        recharge: [54, 48, 42],
      },
    ],
    forces: [
      "Régénération très forte dans les combats à cinq",
      "Immunité aux contrôles pendant l'ultime",
      "Bonne poussée de lane et bon contrôle de vague",
    ],
    faiblesses: [
      "Effondré par la réduction de soins",
      "Début de partie fragile avant le troisième objet",
      "Peu de dégâts sur cible unique isolée",
    ],
    fortContre: ["balmond", "alucard", "sun", "hilda"],
    faibleContre: ["baxia", "dyrroth", "esmeralda", "phoveus"],
    builds: [
      {
        nom: "Expérience régénération",
        contexte:
          "Le build de référence : de la résistance et du vol de vie, puisque le passif convertit déjà les dégâts en bouclier.",
        objets: [
          "Warrior Boots",
          "Bloodlust Axe",
          "Immortality",
          "Antique Cuirass",
          "Athena's Shield",
          "Ares Belt",
        ],
        embleme: "Emblème de combattant",
        talent: "Festival of Blood",
        sort: "Vengeance",
      },
    ],
  },
  {
    slug: "paquito",
    resume:
      "Combattant à fenêtres : chaque compétence utilisée améliore la suivante, pour un pic de dégâts très court.",
    analyse:
      "Paquito ne se joue pas compétence par compétence mais par séquences. Chaque sort lancé charge une version améliorée du suivant, et tout son intérêt consiste à enchaîner ces versions améliorées dans le bon ordre avant que la fenêtre ne se ferme.\n\nBien joué, il supprime une cible fragile en deux secondes depuis une distance considérable. Mal joué, il gaspille ses versions améliorées sur des sbires et n'a plus rien. C'est un héros de rythme, très sensible au niveau du joueur.",
    competences: [
      {
        type: "Passif",
        nom: "Posture de combat",
        description:
          "Utiliser une compétence améliore la prochaine compétence différente pendant quelques secondes.",
      },
      {
        type: "Competence 1",
        nom: "Direct",
        description:
          "Frappe droit devant. Version améliorée : plus de portée, dégâts accrus et déplacement vers l'avant.",
        recharge: [7.5, 7, 6.5, 6, 5.5, 5],
      },
      {
        type: "Competence 2",
        nom: "Crochet",
        description:
          "Frappe en arc de cercle. Version améliorée : projette les ennemis touchés.",
        recharge: [8, 7.5, 7, 6.5, 6, 5.5],
      },
      {
        type: "Ultime",
        nom: "Enchaînement",
        description:
          "Se rue sur une cible et la repousse. Version améliorée : dégâts fortement accrus et projection.",
        recharge: [32, 28, 24],
      },
    ],
    forces: [
      "Pic de dégâts très élevé sur une fenêtre courte",
      "Grande portée d'engagement",
      "Aucun coût en mana",
    ],
    faiblesses: [
      "Perd tout son intérêt si les fenêtres sont gâchées",
      "Très vulnérable une fois ses compétences dépensées",
      "Punitif contre les héros qui gardent leur contrôle",
    ],
    fortContre: ["layla", "lesley", "cecilion", "pharsa"],
    faibleContre: ["khufra", "phoveus", "esmeralda", "uranus"],
    builds: [
      {
        nom: "Jungle explosif",
        contexte:
          "Quand l'objectif est de supprimer le tireur ou le mage adverse dès le premier engagement.",
        objets: [
          "Swift Boots",
          "Bloodlust Axe",
          "Malefic Roar",
          "Queen's Wings",
          "Immortality",
          "Blade of Despair",
        ],
        embleme: "Emblème d'assassin",
        talent: "Festival of Blood",
        sort: "Execution",
      },
    ],
  },
];
