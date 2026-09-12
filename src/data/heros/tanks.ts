import type { AnalyseHeros } from "@/lib/types";

/** Analyses des tanks. Donnees factuelles : voir la synchronisation. */
export const tanks: AnalyseHeros[] = [

  {
    slug: "tigreal",
    summary:
      "Tank d'engagement historique, capable de regrouper une équipe entière dans un seul ultime.",
    analysis:
      "Tigreal fait une chose, et il la fait mieux que presque personne : ramasser plusieurs adversaires d'un coup. Le combo classique consiste à se ruer avec la compétence 2, puis à enchaîner immédiatement l'ultime avant que les cibles ne se dispersent — l'annulation de l'animation par un sort de Flicker reste la technique la plus rentable à apprendre sur lui.\n\nSa limite est nette : hors de son ultime, il n'apporte presque rien. Un Tigreal qui a raté son engagement laisse son équipe à quatre pendant une dizaine de secondes. C'est un héros de timing, pas de présence continue.",
    skills: [
      {
        type: "Passif",
        name: "Forteresse",
        description:
          "Les attaques de base de Tigreal chargent son armure. À pleine charge, sa prochaine attaque inflige des dégâts supplémentaires et le protège brièvement.",
      },
      {
        type: "Competence 1",
        name: "Onde de choc",
        description:
          "Frappe le sol devant lui, infligeant des dégâts et ralentissant les ennemis touchés.",
        cooldown: [7, 6.6, 6.2, 5.8, 5.4, 5],
        cost: [40, 45, 50, 55, 60, 65],
      },
      {
        type: "Competence 2",
        name: "Charge sacrée",
        description:
          "Se rue vers l'avant en poussant les ennemis rencontrés, puis les projette en l'air à la fin de la course.",
        cooldown: [11, 10.4, 9.8, 9.2, 8.6, 8],
        cost: [60, 65, 70, 75, 80, 85],
      },
      {
        type: "Ultime",
        name: "Implosion",
        description:
          "Attire tous les ennemis proches vers lui, puis les étourdit. La référence en matière d'engagement de groupe.",
        cooldown: [42, 36, 30],
        cost: [100, 120, 140],
      },
    ],
    strengths: [
      "Le meilleur regroupement du jeu sur plusieurs cibles",
      "Très résistant même avec un budget d'objets modeste",
      "Lisible : facile à prendre en main en file classée basse",
    ],
    weaknesses: [
      "Inutile quand son ultime est en recharge",
      "L'engagement est télégraphié sans Flicker",
      "Aucune mobilité pour se désengager s'il rate",
    ],
    strongAgainst: ["cecilion", "layla", "pharsa", "estes"],
    weakAgainst: ["diggie", "khufra", "wanwan", "benedetta"],
    builds: [
      {
        name: "Roam d'engagement",
        context:
          "Le build par défaut. On sacrifie tous les dégâts pour arriver au contact et survivre à l'ouverture du combat.",
        items: [
          "Warrior Boots",
          "Athena's Shield",
          "Antique Cuirass",
          "Immortality",
          "Guardian Helmet",
          "Blade Armor",
        ],
        emblem: "Emblème de tank",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
      {
        name: "Front résistant au magique",
        context:
          "Contre une composition adverse à deux mages ou plus, ou quand le dommage magique adverse dépasse le physique.",
        items: [
          "Tough Boots",
          "Athena's Shield",
          "Radiant Armor",
          "Immortality",
          "Oracle",
          "Antique Cuirass",
        ],
        emblem: "Emblème de tank",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "franco",
    summary:
      "Tank d'initiation dont toute la partie tient dans un grappin : il retire un joueur de la carte.",
    analysis:
      "Franco ne joue pas la même partie que les autres tanks. Il ne cherche pas à absorber des dégâts, il cherche à supprimer un adversaire du combat avant qu'il ne commence. Un grappin réussi sur le tireur adverse, suivi de l'ultime, c'est un joueur mort et un objectif gratuit.\n\nToute sa valeur repose donc sur la précision d'une compétence à projectile lent, que la vision conditionne entièrement. Franco se joue dans les buissons, pas dans la lane. Un Franco qui rate trois grappins de suite est un poids mort ; un Franco qui les touche gagne la partie à lui seul.",
    skills: [
      {
        type: "Passif",
        name: "Vaillance",
        description:
          "Chaque coup reçu augmente sa vitesse de déplacement pendant un court instant, cumulable.",
      },
      {
        type: "Competence 1",
        name: "Grappin",
        description:
          "Lance un crochet qui tire le premier ennemi touché jusqu'à lui et l'immobilise brièvement.",
        cooldown: [11, 10.4, 9.8, 9.2, 8.6, 8],
        cost: [70, 80, 90, 100, 110, 120],
      },
      {
        type: "Competence 2",
        name: "Fléau",
        description:
          "Frappe autour de lui, infligeant des dégâts et ralentissant fortement les ennemis proches.",
        cooldown: [7, 6.4, 5.8, 5.2, 4.6, 4],
        cost: [50, 55, 60, 65, 70, 75],
      },
      {
        type: "Ultime",
        name: "Déferlement",
        description:
          "Immobilise une cible et la frappe à répétition. Le contrôle dure assez longtemps pour que l'équipe conclue.",
        cooldown: [50, 42, 34],
        cost: [100, 125, 150],
      },
    ],
    strengths: [
      "Retire une cible clé du combat, quelle que soit sa résistance",
      "Excellent contrôle d'objectif autour du seigneur et de la tortue",
      "Récompense énormément la lecture de la carte",
    ],
    weaknesses: [
      "Un grappin raté le laisse sans rien pendant huit secondes",
      "Très dépendant de la vision et des buissons",
      "L'ultime est une cible unique : sans relais, il meurt après",
    ],
    strongAgainst: ["layla", "estes", "cecilion", "kimmy"],
    weakAgainst: ["diggie", "wanwan", "benedetta", "fanny"],
    builds: [
      {
        name: "Roam de contrôle",
        context:
          "Franco n'a pas besoin de dégâts : il a besoin d'arriver à portée et de survivre au grappin.",
        items: [
          "Warrior Boots",
          "Immortality",
          "Athena's Shield",
          "Antique Cuirass",
          "Radiant Armor",
          "Blade Armor",
        ],
        emblem: "Emblème de tank",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "khufra",
    summary:
      "Le tank qui punit la mobilité : sa compétence 1 annule les dashs et les sauts adverses.",
    analysis:
      "Khufra existe pour répondre à une catégorie précise de héros — ceux qui se déplacent constamment. Sa compétence 1 pose un champ qui interrompt tout dash traversé, ce qui neutralise Fanny, Ling, Wanwan ou Benedetta d'une façon qu'aucun autre tank ne permet.\n\nEn dehors de ce rôle de réponse, il reste un excellent initiateur : la boule de l'ultime propulse les adversaires et permet de les repousser contre une tourelle ou un mur. Sa faiblesse est sa recharge : hors compétences, Khufra est lent et facile à contourner.",
    skills: [
      {
        type: "Passif",
        name: "Provocation",
        description:
          "Après avoir utilisé une compétence, sa prochaine attaque de base inflige des dégâts supplémentaires et le soigne.",
      },
      {
        type: "Competence 1",
        name: "Bandage rebondissant",
        description:
          "Crée une zone qui projette en l'air les ennemis qui tentent de la traverser par un déplacement. Le principal outil anti-mobilité du jeu.",
        cooldown: [12, 11.4, 10.8, 10.2, 9.6, 9],
        cost: [80, 85, 90, 95, 100, 105],
      },
      {
        type: "Competence 2",
        name: "Bond de la boule",
        description:
          "Se transforme en boule et roule dans une direction, en poussant et ralentissant les ennemis heurtés.",
        cooldown: [9, 8.4, 7.8, 7.2, 6.6, 6],
        cost: [70, 75, 80, 85, 90, 95],
      },
      {
        type: "Ultime",
        name: "Tempête du désert",
        description:
          "Frappe le sol : les ennemis pris dans la zone sont projetés et immobilisés un instant.",
        cooldown: [42, 38, 34],
        cost: [120, 140, 160],
      },
    ],
    strengths: [
      "Réponse directe à toute composition mobile",
      "Enchaînement de contrôles très long une fois lancé",
      "Peut isoler une cible contre un mur",
    ],
    weaknesses: [
      "Sans ses compétences, il n'a aucune vitesse",
      "Recharges longues en début de partie",
      "Peu utile face à une équipe sans déplacement",
    ],
    strongAgainst: ["fanny", "ling", "wanwan", "benedetta", "harith"],
    weakAgainst: ["diggie", "cecilion", "yve"],
    builds: [
      {
        name: "Roam anti-mobilité",
        context:
          "Le build standard, à prendre dès que l'équipe adverse aligne un assassin mobile.",
        items: [
          "Warrior Boots",
          "Immortality",
          "Athena's Shield",
          "Antique Cuirass",
          "Blade Armor",
          "Guardian Helmet",
        ],
        emblem: "Emblème de tank",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
    ],
  },
];
