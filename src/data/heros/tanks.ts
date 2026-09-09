import type { Heros } from "@/lib/types";

/** Fiches detaillees des tanks. Voir `index.ts` pour la convention d'ajout. */
export const tanks: Heros[] = [

  {
    slug: "tigreal",
    nom: "Tigreal",
    titre: "Le Rempart",
    roles: ["Tank"],
    lanes: ["Roam"],
    specialites: ["Controle", "Protection"],
    sortie: 2016,
    difficulte: 4,
    resume:
      "Tank d'engagement historique, capable de regrouper une equipe entiere dans un seul ultime.",
    analyse:
      "Tigreal fait une chose, et il la fait mieux que presque personne : ramasser plusieurs adversaires d'un coup. Le combo classique consiste a se ruer avec la competence 2, puis a enchainer immediatement l'ultime avant que les cibles ne se dispersent — l'annulation de l'animation par un sort de Flicker reste la technique la plus rentable a apprendre sur lui.\n\nSa limite est nette : hors de son ultime, il n'apporte presque rien. Un Tigreal qui a rate son engagement laisse son equipe a quatre pendant une dizaine de secondes. C'est un heros de timing, pas de presence continue.",
    competences: [
      {
        type: "Passif",
        nom: "Forteresse",
        description:
          "Les attaques de base de Tigreal chargent son armure. A pleine charge, sa prochaine attaque inflige des degats supplementaires et le protege brievement.",
      },
      {
        type: "Competence 1",
        nom: "Onde de choc",
        description:
          "Frappe le sol devant lui, infligeant des degats et ralentissant les ennemis touches.",
        recharge: [7, 6.6, 6.2, 5.8, 5.4, 5],
        cout: [40, 45, 50, 55, 60, 65],
      },
      {
        type: "Competence 2",
        nom: "Charge sacree",
        description:
          "Se rue vers l'avant en poussant les ennemis rencontres, puis les projette en l'air a la fin de la course.",
        recharge: [11, 10.4, 9.8, 9.2, 8.6, 8],
        cout: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultime",
        nom: "Implosion",
        description:
          "Attire tous les ennemis proches vers lui, puis les etourdit. La reference en matiere d'engagement de groupe.",
        recharge: [42, 36, 30],
        cout: [100, 120, 140],
      },
    ],
    forces: [
      "Le meilleur regroupement du jeu sur plusieurs cibles",
      "Tres resistant meme avec un budget d'objets modeste",
      "Lisible : facile a prendre en main en file classee basse",
    ],
    faiblesses: [
      "Inutile quand son ultime est en recharge",
      "L'engagement est telegraphie sans Flicker",
      "Aucune mobilite pour se desengager s'il rate",
    ],
    fortContre: ["cecilion", "layla", "pharsa", "estes"],
    faibleContre: ["diggie", "khufra", "wanwan", "benedetta"],
    builds: [
      {
        nom: "Roam d'engagement",
        contexte:
          "Le build par defaut. On sacrifie tous les degats pour arriver au contact et survivre a l'ouverture du combat.",
        objets: [
          "Bottes de guerre",
          "Bouclier d'Athena",
          "Armure antique",
          "Trepas immortel",
          "Guardian Helmet",
          "Blade Armor",
        ],
        embleme: "Embleme de tank",
        talent: "Choc",
        sort: "Flicker",
      },
      {
        nom: "Front resistant au magique",
        contexte:
          "Contre une composition adverse a deux mages ou plus, ou quand le dommage magique adverse depasse le physique.",
        objets: [
          "Bottes en cuir",
          "Bouclier d'Athena",
          "Cape de Radiance",
          "Trepas immortel",
          "Oracle",
          "Armure antique",
        ],
        embleme: "Embleme de tank",
        talent: "Choc",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "franco",
    nom: "Franco",
    titre: "Le Boucher gele",
    roles: ["Tank"],
    lanes: ["Roam"],
    specialites: ["Controle"],
    sortie: 2016,
    difficulte: 6,
    resume:
      "Tank d'initiation dont toute la partie tient dans un grappin : il retire un joueur de la carte.",
    analyse:
      "Franco ne joue pas la meme partie que les autres tanks. Il ne cherche pas a absorber des degats, il cherche a supprimer un adversaire du combat avant qu'il ne commence. Un grappin reussi sur le tireur adverse, suivi de l'ultime, c'est un joueur mort et un objectif gratuit.\n\nToute sa valeur repose donc sur la precision d'une competence a projectile lent, que la vision conditionne entierement. Franco se joue dans les buissons, pas dans la lane. Un Franco qui rate trois grappins de suite est un poids mort ; un Franco qui les touche gagne la partie a lui seul.",
    competences: [
      {
        type: "Passif",
        nom: "Vaillance",
        description:
          "Chaque coup recu augmente sa vitesse de deplacement pendant un court instant, cumulable.",
      },
      {
        type: "Competence 1",
        nom: "Grappin",
        description:
          "Lance un crochet qui tire le premier ennemi touche jusqu'a lui et l'immobilise brievement.",
        recharge: [11, 10.4, 9.8, 9.2, 8.6, 8],
        cout: [70, 80, 90, 100, 110, 120],
      },
      {
        type: "Competence 2",
        nom: "Fleau",
        description:
          "Frappe autour de lui, infligeant des degats et ralentissant fortement les ennemis proches.",
        recharge: [7, 6.4, 5.8, 5.2, 4.6, 4],
        cout: [50, 55, 60, 65, 70, 75],
      },
      {
        type: "Ultime",
        nom: "Deferlement",
        description:
          "Immobilise une cible et la frappe a repetition. Le controle dure assez longtemps pour que l'equipe conclue.",
        recharge: [50, 42, 34],
        cout: [100, 125, 150],
      },
    ],
    forces: [
      "Retire une cible cle du combat, quelle que soit sa resistance",
      "Excellent controle d'objectif autour du seigneur et de la tortue",
      "Recompense enormement la lecture de la carte",
    ],
    faiblesses: [
      "Un grappin rate le laisse sans rien pendant huit secondes",
      "Tres dependant de la vision et des buissons",
      "L'ultime est une cible unique : sans relais, il meurt apres",
    ],
    fortContre: ["layla", "estes", "cecilion", "kimmy"],
    faibleContre: ["diggie", "wanwan", "benedetta", "fanny"],
    builds: [
      {
        nom: "Roam de controle",
        contexte:
          "Franco n'a pas besoin de degats : il a besoin d'arriver a portee et de survivre au grappin.",
        objets: [
          "Bottes de guerre",
          "Trepas immortel",
          "Bouclier d'Athena",
          "Armure antique",
          "Cape de Radiance",
          "Blade Armor",
        ],
        embleme: "Embleme de tank",
        talent: "Choc",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "khufra",
    nom: "Khufra",
    titre: "Le Roi bandage",
    roles: ["Tank"],
    lanes: ["Roam"],
    specialites: ["Controle", "Charge"],
    sortie: 2019,
    difficulte: 6,
    resume:
      "Le tank qui punit la mobilite : sa competence 1 annule les dashs et les sauts adverses.",
    analyse:
      "Khufra existe pour repondre a une categorie precise de heros — ceux qui se deplacent constamment. Sa competence 1 pose un champ qui interrompt tout dash traverse, ce qui neutralise Fanny, Ling, Wanwan ou Benedetta d'une facon qu'aucun autre tank ne permet.\n\nEn dehors de ce role de reponse, il reste un excellent initiateur : la boule de l'ultime propulse les adversaires et permet de les repousser contre une tourelle ou un mur. Sa faiblesse est sa recharge : hors competences, Khufra est lent et facile a contourner.",
    competences: [
      {
        type: "Passif",
        nom: "Provocation",
        description:
          "Apres avoir utilise une competence, sa prochaine attaque de base inflige des degats supplementaires et le soigne.",
      },
      {
        type: "Competence 1",
        nom: "Bandage rebondissant",
        description:
          "Cree une zone qui projette en l'air les ennemis qui tentent de la traverser par un deplacement. Le principal outil anti-mobilite du jeu.",
        recharge: [12, 11.4, 10.8, 10.2, 9.6, 9],
        cout: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Competence 2",
        nom: "Bond de la boule",
        description:
          "Se transforme en boule et roule dans une direction, en poussant et ralentissant les ennemis heurtes.",
        recharge: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultime",
        nom: "Tempete du desert",
        description:
          "Frappe le sol : les ennemis pris dans la zone sont projetes et immobilises un instant.",
        recharge: [42, 38, 34],
        cout: [120, 140, 160],
      },
    ],
    forces: [
      "Reponse directe a toute composition mobile",
      "Enchainement de controles tres long une fois lance",
      "Peut isoler une cible contre un mur",
    ],
    faiblesses: [
      "Sans ses competences, il n'a aucune vitesse",
      "Recharges longues en debut de partie",
      "Peu utile face a une equipe sans deplacement",
    ],
    fortContre: ["fanny", "ling", "wanwan", "benedetta", "harith"],
    faibleContre: ["diggie", "cecilion", "yve"],
    builds: [
      {
        nom: "Roam anti-mobilite",
        contexte:
          "Le build standard, a prendre des que l'equipe adverse aligne un assassin mobile.",
        objets: [
          "Bottes de guerre",
          "Trepas immortel",
          "Bouclier d'Athena",
          "Armure antique",
          "Blade Armor",
          "Guardian Helmet",
        ],
        embleme: "Embleme de tank",
        talent: "Choc",
        sort: "Flicker",
      },
    ],
  },
];
