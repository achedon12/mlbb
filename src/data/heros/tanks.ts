import type { AnalyseHeros } from "@/lib/types";

/** Analyses des tanks. Donnees factuelles : voir la synchronisation. */
export const tanks: AnalyseHeros[] = [

  {
    slug: "tigreal",
    resume:
      "Tank d'engagement historique, capable de regrouper une équipe entière dans un seul ultime.",
    analyse:
      "Tigreal fait une chose, et il la fait mieux que presque personne : ramasser plusieurs adversaires d'un coup. Le combo classique consiste à se ruer avec la compétence 2, puis à enchaîner immédiatement l'ultime avant que les cibles ne se dispersent — l'annulation de l'animation par un sort de Flicker reste la technique la plus rentable à apprendre sur lui.\n\nSa limite est nette : hors de son ultime, il n'apporte presque rien. Un Tigreal qui a raté son engagement laisse son équipe à quatre pendant une dizaine de secondes. C'est un héros de timing, pas de présence continue.",
    competences: [
      {
        type: "Passif",
        nom: "Forteresse",
        description:
          "Les attaques de base de Tigreal chargent son armure. À pleine charge, sa prochaine attaque inflige des dégâts supplémentaires et le protège brièvement.",
      },
      {
        type: "Competence 1",
        nom: "Onde de choc",
        description:
          "Frappe le sol devant lui, infligeant des dégâts et ralentissant les ennemis touchés.",
        recharge: [7, 6.6, 6.2, 5.8, 5.4, 5],
        cout: [40, 45, 50, 55, 60, 65],
      },
      {
        type: "Competence 2",
        nom: "Charge sacrée",
        description:
          "Se rue vers l'avant en poussant les ennemis rencontrés, puis les projette en l'air à la fin de la course.",
        recharge: [11, 10.4, 9.8, 9.2, 8.6, 8],
        cout: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultime",
        nom: "Implosion",
        description:
          "Attire tous les ennemis proches vers lui, puis les étourdit. La référence en matière d'engagement de groupe.",
        recharge: [42, 36, 30],
        cout: [100, 120, 140],
      },
    ],
    forces: [
      "Le meilleur regroupement du jeu sur plusieurs cibles",
      "Très résistant même avec un budget d'objets modeste",
      "Lisible : facile à prendre en main en file classée basse",
    ],
    faiblesses: [
      "Inutile quand son ultime est en recharge",
      "L'engagement est télégraphié sans Flicker",
      "Aucune mobilité pour se désengager s'il rate",
    ],
    fortContre: ["cecilion", "layla", "pharsa", "estes"],
    faibleContre: ["diggie", "khufra", "wanwan", "benedetta"],
    builds: [
      {
        nom: "Roam d'engagement",
        contexte:
          "Le build par défaut. On sacrifie tous les dégâts pour arriver au contact et survivre à l'ouverture du combat.",
        objets: [
          "Warrior Boots",
          "Athena's Shield",
          "Antique Cuirass",
          "Immortality",
          "Guardian Helmet",
          "Blade Armor",
        ],
        embleme: "Emblème de tank",
        talent: "Concussive Blast",
        sort: "Flicker",
      },
      {
        nom: "Front résistant au magique",
        contexte:
          "Contre une composition adverse à deux mages ou plus, ou quand le dommage magique adverse dépasse le physique.",
        objets: [
          "Tough Boots",
          "Athena's Shield",
          "Radiant Armor",
          "Immortality",
          "Oracle",
          "Antique Cuirass",
        ],
        embleme: "Emblème de tank",
        talent: "Concussive Blast",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "franco",
    resume:
      "Tank d'initiation dont toute la partie tient dans un grappin : il retire un joueur de la carte.",
    analyse:
      "Franco ne joue pas la même partie que les autres tanks. Il ne cherche pas à absorber des dégâts, il cherche à supprimer un adversaire du combat avant qu'il ne commence. Un grappin réussi sur le tireur adverse, suivi de l'ultime, c'est un joueur mort et un objectif gratuit.\n\nToute sa valeur repose donc sur la précision d'une compétence à projectile lent, que la vision conditionne entièrement. Franco se joue dans les buissons, pas dans la lane. Un Franco qui rate trois grappins de suite est un poids mort ; un Franco qui les touche gagne la partie à lui seul.",
    competences: [
      {
        type: "Passif",
        nom: "Vaillance",
        description:
          "Chaque coup reçu augmente sa vitesse de déplacement pendant un court instant, cumulable.",
      },
      {
        type: "Competence 1",
        nom: "Grappin",
        description:
          "Lance un crochet qui tire le premier ennemi touché jusqu'à lui et l'immobilise brièvement.",
        recharge: [11, 10.4, 9.8, 9.2, 8.6, 8],
        cout: [70, 80, 90, 100, 110, 120],
      },
      {
        type: "Competence 2",
        nom: "Fléau",
        description:
          "Frappe autour de lui, infligeant des dégâts et ralentissant fortement les ennemis proches.",
        recharge: [7, 6.4, 5.8, 5.2, 4.6, 4],
        cout: [50, 55, 60, 65, 70, 75],
      },
      {
        type: "Ultime",
        nom: "Déferlement",
        description:
          "Immobilise une cible et la frappe à répétition. Le contrôle dure assez longtemps pour que l'équipe conclue.",
        recharge: [50, 42, 34],
        cout: [100, 125, 150],
      },
    ],
    forces: [
      "Retire une cible clé du combat, quelle que soit sa résistance",
      "Excellent contrôle d'objectif autour du seigneur et de la tortue",
      "Récompense énormément la lecture de la carte",
    ],
    faiblesses: [
      "Un grappin raté le laisse sans rien pendant huit secondes",
      "Très dépendant de la vision et des buissons",
      "L'ultime est une cible unique : sans relais, il meurt après",
    ],
    fortContre: ["layla", "estes", "cecilion", "kimmy"],
    faibleContre: ["diggie", "wanwan", "benedetta", "fanny"],
    builds: [
      {
        nom: "Roam de contrôle",
        contexte:
          "Franco n'a pas besoin de dégâts : il a besoin d'arriver à portée et de survivre au grappin.",
        objets: [
          "Warrior Boots",
          "Immortality",
          "Athena's Shield",
          "Antique Cuirass",
          "Radiant Armor",
          "Blade Armor",
        ],
        embleme: "Emblème de tank",
        talent: "Concussive Blast",
        sort: "Flicker",
      },
    ],
  },
  {
    slug: "khufra",
    resume:
      "Le tank qui punit la mobilité : sa compétence 1 annule les dashs et les sauts adverses.",
    analyse:
      "Khufra existe pour répondre à une catégorie précise de héros — ceux qui se déplacent constamment. Sa compétence 1 pose un champ qui interrompt tout dash traversé, ce qui neutralise Fanny, Ling, Wanwan ou Benedetta d'une façon qu'aucun autre tank ne permet.\n\nEn dehors de ce rôle de réponse, il reste un excellent initiateur : la boule de l'ultime propulse les adversaires et permet de les repousser contre une tourelle ou un mur. Sa faiblesse est sa recharge : hors compétences, Khufra est lent et facile à contourner.",
    competences: [
      {
        type: "Passif",
        nom: "Provocation",
        description:
          "Après avoir utilisé une compétence, sa prochaine attaque de base inflige des dégâts supplémentaires et le soigne.",
      },
      {
        type: "Competence 1",
        nom: "Bandage rebondissant",
        description:
          "Crée une zone qui projette en l'air les ennemis qui tentent de la traverser par un déplacement. Le principal outil anti-mobilité du jeu.",
        recharge: [12, 11.4, 10.8, 10.2, 9.6, 9],
        cout: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Competence 2",
        nom: "Bond de la boule",
        description:
          "Se transforme en boule et roule dans une direction, en poussant et ralentissant les ennemis heurtés.",
        recharge: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cout: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultime",
        nom: "Tempête du désert",
        description:
          "Frappe le sol : les ennemis pris dans la zone sont projetés et immobilisés un instant.",
        recharge: [42, 38, 34],
        cout: [120, 140, 160],
      },
    ],
    forces: [
      "Réponse directe à toute composition mobile",
      "Enchaînement de contrôles très long une fois lancé",
      "Peut isoler une cible contre un mur",
    ],
    faiblesses: [
      "Sans ses compétences, il n'a aucune vitesse",
      "Recharges longues en début de partie",
      "Peu utile face à une équipe sans déplacement",
    ],
    fortContre: ["fanny", "ling", "wanwan", "benedetta", "harith"],
    faibleContre: ["diggie", "cecilion", "yve"],
    builds: [
      {
        nom: "Roam anti-mobilité",
        contexte:
          "Le build standard, à prendre dès que l'équipe adverse aligne un assassin mobile.",
        objets: [
          "Warrior Boots",
          "Immortality",
          "Athena's Shield",
          "Antique Cuirass",
          "Blade Armor",
          "Guardian Helmet",
        ],
        embleme: "Emblème de tank",
        talent: "Concussive Blast",
        sort: "Flicker",
      },
    ],
  },
];
