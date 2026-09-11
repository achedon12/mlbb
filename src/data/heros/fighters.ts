import type { AnalyseHeros } from "@/lib/types";

/** Analyses des combattants. Donnees factuelles : voir la synchronisation. */
export const fighters: AnalyseHeros[] = [
  {
    slug: "chou",
    resume:
      "Combattant d'isolement : il extrait une cible du groupe adverse et la tue avant que son equipe ne reagisse.",
    analyse:
      "Chou est le heros de plus haut plafond du roam. L'idee est simple — l'ultime envoie une cible en l'air et la deplace — mais son execution repose sur des annulations d'animation que le jeu n'explique nulle part. Le combo de reference enchaine competence 1, saut annule, ultime, puis competence 2 pour retenir la cible a l'atterrissage.\n\nSon interet en equipe organisee vient de la : il choisit qui meurt. Contre un joueur qui garde son Purify, en revanche, l'ultime perd la moitie de sa valeur, et Chou redevient un combattant moyen.",
    competences: [
      {
        type: "Passif",
        nom: "Seul contre tous",
        description:
          "Toutes les quelques attaques de base, sa prochaine attaque devient un coup ameliore qui inflige des degats supplementaires.",
      },
      {
        type: "Competence 1",
        nom: "Coup de pied enchaine",
        description:
          "Trois frappes successives. La derniere projette les ennemis touches en l'air.",
        recharge: [9, 8.4, 7.8, 7.2, 6.6, 6],
      },
      {
        type: "Competence 2",
        nom: "Vague de fer",
        description:
          "Se rue dans une direction en devenant insensible aux controles pendant la course.",
        recharge: [14, 13, 12, 11, 10, 9],
      },
      {
        type: "Ultime",
        nom: "L'ultime coup",
        description:
          "Frappe une cible, la projette et la suit sur toute la trajectoire. Deplace un adversaire loin de son equipe.",
        recharge: [40, 35, 30],
      },
    ],
    forces: [
      "Choisit et isole une cible prioritaire",
      "Immunise aux controles pendant sa competence 2",
      "Excellent en escarmouche a deux ou trois",
    ],
    faiblesses: [
      "Execution exigeante, tres punitive a l'apprentissage",
      "Neutralise par Purify sur la cible visee",
      "Degats faibles si l'isolement echoue",
    ],
    fortContre: ["layla", "pharsa", "cecilion", "estes", "kimmy"],
    faibleContre: ["diggie", "khufra", "phoveus"],
    builds: [
      {
        nom: "Roam d'isolement",
        contexte:
          "La version jouee en competition : assez de resistance pour survivre a l'aller-retour, aucun objet de degats pur.",
        objets: [
          "Warrior Boots",
          "Immortality",
          "Athena's Shield",
          "Antique Cuirass",
          "Blade Armor",
          "Guardian Helmet",
        ],
        embleme: "Embleme de soutien",
        talent: "Focusing Mark",
        sort: "Flicker",
      },
      {
        nom: "Experience offensif",
        contexte:
          "En lane d'experience, quand Chou doit gagner son duel plutot que servir son equipe.",
        objets: [
          "Warrior Boots",
          "Bloodlust Axe",
          "Queen's Wings",
          "Immortality",
          "Malefic Roar",
          "Antique Cuirass",
        ],
        embleme: "Embleme de combattant",
        talent: "Festival of Blood",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "yu-zhong",
    resume:
      "Combattant de lane d'experience qui se soigne en frappant et devient tres difficile a tuer en combat prolonge.",
    analyse:
      "Yu Zhong gagne les combats qui durent. Son passif transforme une partie des degats infliges en bouclier, ce qui le rend excellent des qu'il y a plusieurs cibles a portee — un affrontement a cinq lui donne bien plus de retour qu'un duel.\n\nSon ultime le rend immunise aux controles pendant qu'il avance, ce qui en fait aussi un initiateur credible. Le contrer passe presque toujours par la reduction de soins : sans elle, un Yu Zhong bien equipe absorbe une equipe entiere.",
    competences: [
      {
        type: "Passif",
        nom: "Ecailles du dragon sombre",
        description:
          "Les degats infliges par ses competences se convertissent partiellement en bouclier, avec un rendement accru sur plusieurs cibles.",
      },
      {
        type: "Competence 1",
        nom: "Griffe du dragon",
        description:
          "Enchaine deux balayages devant lui. Le second inflige des degats accrus.",
        recharge: [8, 7.4, 6.8, 6.2, 5.6, 5],
      },
      {
        type: "Competence 2",
        nom: "Queue du dragon",
        description:
          "Bondit vers l'avant et projette les ennemis touches. Sert autant a engager qu'a fuir.",
        recharge: [11, 10.2, 9.4, 8.6, 7.8, 7],
      },
      {
        type: "Ultime",
        nom: "Ame du dragon noir",
        description:
          "Prend une forme de dragon : immunise aux controles, il avance en infligeant des degats de zone puis fait s'ecraser un ennemi au sol.",
        recharge: [54, 48, 42],
      },
    ],
    forces: [
      "Regeneration tres forte dans les combats a cinq",
      "Immunite aux controles pendant l'ultime",
      "Bonne poussee de lane et bon controle de vague",
    ],
    faiblesses: [
      "Effondre par la reduction de soins",
      "Debut de partie fragile avant le troisieme objet",
      "Peu de degats sur cible unique isolee",
    ],
    fortContre: ["balmond", "alucard", "sun", "hilda"],
    faibleContre: ["baxia", "dyrroth", "esmeralda", "phoveus"],
    builds: [
      {
        nom: "Experience regeneration",
        contexte:
          "Le build de reference : de la resistance et du vol de vie, puisque le passif convertit deja les degats en bouclier.",
        objets: [
          "Warrior Boots",
          "Bloodlust Axe",
          "Immortality",
          "Antique Cuirass",
          "Athena's Shield",
          "Ares Belt",
        ],
        embleme: "Embleme de combattant",
        talent: "Festival of Blood",
        sort: "Vengeance",
      },
    ],
  },
  {
    slug: "paquito",
    resume:
      "Combattant a fenetres : chaque competence utilisee ameliore la suivante, pour un pic de degats tres court.",
    analyse:
      "Paquito ne se joue pas competence par competence mais par sequences. Chaque sort lance charge une version amelioree du suivant, et tout son interet consiste a enchainer ces versions ameliorees dans le bon ordre avant que la fenetre ne se ferme.\n\nBien joue, il supprime une cible fragile en deux secondes depuis une distance considerable. Mal joue, il gaspille ses versions ameliorees sur des sbires et n'a plus rien. C'est un heros de rythme, tres sensible au niveau du joueur.",
    competences: [
      {
        type: "Passif",
        nom: "Posture de combat",
        description:
          "Utiliser une competence ameliore la prochaine competence differente pendant quelques secondes.",
      },
      {
        type: "Competence 1",
        nom: "Direct",
        description:
          "Frappe droit devant. Version amelioree : plus de portee, degats accrus et deplacement vers l'avant.",
        recharge: [7.5, 7, 6.5, 6, 5.5, 5],
      },
      {
        type: "Competence 2",
        nom: "Crochet",
        description:
          "Frappe en arc de cercle. Version amelioree : projette les ennemis touches.",
        recharge: [8, 7.5, 7, 6.5, 6, 5.5],
      },
      {
        type: "Ultime",
        nom: "Enchainement",
        description:
          "Se rue sur une cible et la repousse. Version amelioree : degats fortement accrus et projection.",
        recharge: [32, 28, 24],
      },
    ],
    forces: [
      "Pic de degats tres eleve sur une fenetre courte",
      "Grande portee d'engagement",
      "Aucun cout en mana",
    ],
    faiblesses: [
      "Perd tout son interet si les fenetres sont gachees",
      "Tres vulnerable une fois ses competences depensees",
      "Punitif contre les heros qui gardent leur controle",
    ],
    fortContre: ["layla", "lesley", "cecilion", "pharsa"],
    faibleContre: ["khufra", "phoveus", "esmeralda", "uranus"],
    builds: [
      {
        nom: "Jungle explosif",
        contexte:
          "Quand l'objectif est de supprimer le tireur ou le mage adverse des le premier engagement.",
        objets: [
          "Swift Boots",
          "Bloodlust Axe",
          "Malefic Roar",
          "Queen's Wings",
          "Immortality",
          "Blade of Despair",
        ],
        embleme: "Embleme d'assassin",
        talent: "Festival of Blood",
        sort: "Execution",
      },
    ],
  },
];
