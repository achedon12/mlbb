import type { HeroAnalysis } from "@/lib/types";

/** Analyses of the marksmen. Factual data: see the sync. */
export const marksmen: HeroAnalysis[] = [
  {
    slug: "granger",
    summary:
      "Tireur à chargeur : ses dégâts viennent de ses compétences, pas de sa vitesse d'attaque.",
    analysis:
      "Granger ne se construit pas comme un tireur classique. Sa compétence 1 tire six balles dont la dernière est toujours critique, et son passif convertit la réduction de recharge en attaque physique, ce qui rend la vitesse d'attaque presque inutile sur lui : on achète des dégâts d'attaque et de la pénétration.\n\nCela lui donne un pic de puissance très précoce, exploitable en jungle dès le premier objet. Sa fragilité reste celle d'un tireur, aggravée par l'absence de contrôle, hormis le bref ralentissement de son ultime : mal positionné, il n'a que sa compétence 2 et les roulades de son ultime pour espérer sortir.",
    skills: [
      {
        type: "Passive",
        name: "Capriccio",
        description:
          "Son fusil et son canon fonctionnent à l'énergie démoniaque, qui se régénère et augmente à chaque sbire, monstre ou héros tué. Chaque point de réduction de recharge devient de l'attaque physique.",
      },
      {
        type: "Skill 1",
        name: "Rhapsody",
        description:
          "Tire six balles d'affilée, dont la dernière est toujours critique, en gagnant un peu de vitesse. Sans recharge : elle ne dépend que de l'énergie de son fusil.",
      },
      {
        type: "Skill 2",
        name: "Rondo",
        description:
          "Dash dans une direction en rendant de l'énergie à son fusil, même pendant la compétence 1. Chaque balle qui touche réduit sa recharge.",
      },
      {
        type: "Ultimate",
        name: "Death Sonata",
        description:
          "Tire au canon sur le premier héros touché et autour de lui, en ralentissant brièvement les cibles. Après chaque tir, il peut faire une roulade.",
      },
    ],
    strengths: [
      "Pic de puissance très précoce",
      "Dégâts à longue portée avec l'ultime",
      "Fonctionne en jungle comme en Gold lane",
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
        name: "Gold lane, dégâts bruts",
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
        emblem: "Marksman Emblem",
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
      "Beatrix est en réalité quatre héros. Elle porte deux armes à la fois parmi quatre, et chacune redéfinit sa portée, sa cadence et son ultime : un fusil de précision à très longue portée, un fusil à pompe explosif, un fusil d'assaut à cadence rapide, un lance-grenades de zone.\n\nLe niveau de jeu consiste à choisir la bonne paire avant la partie, puis à alterner en combat. C'est ce qui la rend à la fois très forte en compétition et très punitive en partie classée : une mauvaise paire, ou un mauvais changement au mauvais moment, et elle n'a plus de dégâts du tout.",
    skills: [
      {
        type: "Passive",
        name: "Mechanical Genius",
        description:
          "Beatrix porte deux armes parmi quatre. Chaque arme modifie ses attaques de base et remplace son ultime.",
      },
      {
        type: "Skill 1",
        name: "Masterful Gunner",
        description:
          "Échange l'arme active contre la seconde arme portée, ce qui change son attaque de base et son ultime. En passif, porter deux armes augmente son attaque physique.",
      },
      {
        type: "Skill 2",
        name: "Tactical Reposition",
        description:
          "Une roulade vers l'avant qui recharge entièrement l'arme active.",
      },
      {
        type: "Ultimate",
        name: "Renner's Apathy",
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
        name: "Gold lane, longue portée",
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
        emblem: "Marksman Emblem",
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
      "Melissa résout le problème classique du tireur — se faire plonger — par une réponse directe. Son ultime lui donne un bouclier et pose un cercle qui repousse les adversaires présents et tous ceux qui tentent d'y entrer, en interrompant leurs déplacements, ce qui lui permet de continuer à tirer pendant qu'un assassin s'épuise à essayer d'entrer.\n\nElle reste une tireuse standard sur le reste : bonne montée en puissance, dégâts corrects, aucune menace hors de sa portée. Contre une équipe à distance qui l'ignore et frappe à travers la zone, l'ultime perd l'essentiel de sa valeur.",
    skills: [
      {
        type: "Passive",
        name: "Doll Buster",
        description:
          "Ses dégâts sont augmentés contre les sbires, les monstres et les unités invoquées.",
      },
      {
        type: "Skill 1",
        name: "Falling!",
        description:
          "Glisse vers l'avant et gagne de la vitesse d'attaque pendant quelques secondes.",
      },
      {
        type: "Skill 2",
        name: "Eyes on You!",
        description:
          "Lance Muddles, qui blesse le premier ennemi touché puis lie les ennemis proches et les ralentit tant qu'ils restent à portée. Ses attaques sur Muddles blessent aussi les ennemis liés.",
      },
      {
        type: "Ultimate",
        name: "Go Away!",
        description:
          "Lui donne un bouclier et crée autour d'elle une zone qui repousse les ennemis présents ; ceux qui tentent d'y entrer sont repoussés, ralentis, et leurs compétences de déplacement interrompues.",
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
        name: "Gold lane standard",
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
        emblem: "Marksman Emblem",
        talent: "Bargain Hunter",
        spell: "Inspiration",
      },
    ],
  },
  {
    slug: "miya",
    summary:
      "Tireuse d'attaques de base pure : elle gagne en cadence tant qu'elle frappe, et son ultime la fait disparaître au moment où on la vise.",
    analysis:
      "Miya fonde tout sur l'attaque de base. Son passif empile de la vitesse d'attaque à chaque tir qui touche, la compétence 1 ajoute des flèches supplémentaires qui blessent aussi les cibles voisines, et la compétence 2 immobilise une zone avant de ralentir ce qui l'entoure. Son ultime retire les effets négatifs, la rend invisible et la fait sortir de cet état avec son passif déjà à pleine charge : il sert autant à fuir qu'à revenir dans l'échange en pleine cadence. Son taux de victoire mesuré progresse légèrement avec la durée de la partie.\n\n" +
      "Elle n'a aucun déplacement instantané. Une fois l'ultime utilisé, il ne lui reste que la compétence 2 pour ralentir un assaillant, et sa cadence retombe dès qu'elle cesse de toucher une cible. Les mesures de contres la placent en difficulté face à Beatrix, Granger, Gatotkaca, Karina et Belerick, avec un écart qui se retrouve du rang Mythic au rang Mythical Glory.",
    skills: [
      {
        type: "Passive",
        name: "Moon Blessing",
        description:
          "Chaque attaque de base qui touche ajoute un palier de vitesse d'attaque, jusqu'à cinq. À pleine charge, chaque tir fait apparaître une ombre qui frappe avec elle : tout l'intérêt est de ne jamais laisser retomber les paliers.",
      },
      {
        type: "Skill 1",
        name: "Moon Arrow",
        description:
          "Pendant quelques secondes, chaque attaque de base part avec deux flèches en plus, et une partie des dégâts touche les ennemis proches de la cible. À lancer au début d'un échange ou sur une vague de sbires.",
      },
      {
        type: "Skill 2",
        name: "Arrow of Eclipse",
        description:
          "Une flèche tombe sur une zone et immobilise les ennemis présents, puis éclate en projectiles qui ralentissent. C'est son seul contrôle : mieux vaut le garder pour stopper un assaillant que pour ajouter des dégâts.",
      },
      {
        type: "Ultimate",
        name: "Hidden Moonlight",
        description:
          "Retire les effets négatifs, la rend invisible et accélère son déplacement jusqu'à sa prochaine attaque. Elle en ressort avec son passif à pleine charge : l'ultime sert aussi bien à se sortir d'un engagement qu'à reprendre un combat immédiatement.",
      },
    ],
    strengths: [
      "Dégâts soutenus qui augmentent tant qu'elle frappe sans interruption",
      "Un ultime qui retire les effets négatifs et la rend invisible",
      "Dégâts sur les cibles voisines avec la compétence 1",
      "Taux de victoire mesuré qui tient dans les parties longues",
    ],
    weaknesses: [
      "Aucun déplacement instantané pour sortir d'un engagement",
      "Plus aucune échappatoire une fois l'ultime utilisé",
      "Sa cadence retombe dès qu'elle cesse de toucher une cible",
      "En difficulté face à Beatrix et Granger selon les mesures",
    ],
    strongAgainst: ["saber", "gloo", "selena", "silvanna"],
    weakAgainst: ["beatrix", "granger", "gatotkaca", "karina", "belerick"],
    builds: [
      {
        name: "Critique",
        context:
          "Le build le plus joué en Gold lane, tous rangs confondus comme en Mythical Glory : la chance de critique alimente Berserker's Fury et déclenche la vitesse d'attaque de Haas' Claws, qui apporte aussi le vol de vie.",
        items: ["Windtalker", "Berserker's Fury", "Haas' Claws"],
        emblem: "Marksman Emblem",
        talent: "Weakness Finder",
        spell: "Inspire",
      },
      {
        name: "Dégâts à l'impact",
        context:
          "Moins joué que la version critique, avec un taux de victoire mesuré un peu supérieur : Corrosion Scythe et Demon Hunter Sword ajoutent des dégâts à chaque attaque de base, ce qui convient face à des cibles à beaucoup de PV.",
        items: ["Corrosion Scythe", "Demon Hunter Sword", "Golden Staff"],
        emblem: "Marksman Emblem",
        talent: "Quantum Charge",
        spell: "Inspire",
      },
    ],
  },
  {
    slug: "hanabi",
    summary:
      "Tireuse de dégâts en rebond, que les contrôles ne touchent pas tant qu'elle porte un bouclier.",
    analysis:
      "Hanabi inflige ses dégâts par ricochet : chaque attaque de base ou compétence qui touche renvoie des lames sur les ennemis voisins, ce qui la rend efficace dans les combats groupés et sur les vagues. Sa compétence 1 lui donne un bouclier, et tant qu'un bouclier la protège, les effets de contrôle n'ont aucune prise sur elle ; une partie des dégâts qu'elle inflige vient en plus recharger ce bouclier. Son ultime immobilise le premier héros touché avant d'exploser autour de lui.\n\n" +
      "Elle n'a en revanche aucun déplacement instantané : si le bouclier tombe, elle redevient une cible facile à atteindre. Son taux de victoire mesuré est le plus haut dans les parties courtes et recule nettement à mesure qu'elles s'allongent, jusqu'à passer sous les cinquante pour cent après la dix-huitième minute. Au rang Mythical Glory, les mesures la placent en difficulté face à Lolita, Joy, Beatrix, Wanwan et Ixia.",
    skills: [
      {
        type: "Passive",
        name: "Ninjutsu: Petal Barrage",
        description:
          "Chaque attaque de base ou compétence qui touche renvoie des lames vers plusieurs ennemis proches, avec des dégâts qui diminuent à chaque rebond. Les rebonds de l'attaque de base reprennent une partie de ses effets d'attaque.",
      },
      {
        type: "Skill 1",
        name: "Ninjutsu: Equinox",
        description:
          "Tant qu'elle porte un bouclier, quelle qu'en soit la source, Hanabi ignore les contrôles. En l'activant, elle se protège elle-même, gagne en vitesse de déplacement et d'attaque, et une partie des dégâts infligés renforce ce bouclier dans une certaine limite.",
      },
      {
        type: "Skill 2",
        name: "Ninjutsu: Soul Scroll",
        description:
          "Lance un kunaï qui ralentit fortement les ennemis traversés et les marque : ses prochains rebonds sur ces cibles ne perdent pas de puissance. Utile pour préparer un combat de groupe.",
      },
      {
        type: "Ultimate",
        name: "Forbidden Jutsu: Higanbana",
        description:
          "Projette une fleur qui immobilise le premier héros touché, puis éclot après un court délai et blesse les ennemis proches. Son seul contrôle : à lancer sur la cible que l'équipe peut suivre.",
      },
    ],
    strengths: [
      "Dégâts répartis sur plusieurs cibles grâce aux rebonds",
      "Insensible aux contrôles tant qu'un bouclier la protège",
      "Un bouclier qui se recharge avec les dégâts qu'elle inflige",
      "Un contrôle à l'ultime pour ouvrir un combat",
    ],
    weaknesses: [
      "Aucun déplacement instantané pour se replacer",
      "Vulnérable dès que son bouclier est brisé",
      "Taux de victoire mesuré en baisse nette dans les parties longues",
      "En difficulté face à Lolita et Beatrix selon les mesures",
    ],
    strongAgainst: ["popol-and-kupa", "kaja", "chip"],
    weakAgainst: ["lolita", "joy", "beatrix", "wanwan", "ixia"],
    builds: [
      {
        name: "Attaques renforcées",
        context:
          "Le build de loin le plus joué en Gold lane : Corrosion Scythe, Demon Hunter Sword et Golden Staff renforcent chaque attaque de base, dont les rebonds reprennent une partie des effets. Il est le plus souvent associé au Fighter Emblem et au sort Aegis, dont le bouclier la rend aussi insensible aux contrôles.",
        items: ["Corrosion Scythe", "Demon Hunter Sword", "Golden Staff"],
        emblem: "Fighter Emblem",
        talent: "Weakness Finder",
        spell: "Aegis",
      },
    ],
  },
  {
    slug: "lesley",
    summary:
      "Tireuse de critique à distance, dont le taux de victoire mesuré passe de très bas à élevé selon la durée de la partie.",
    analysis:
      "Lesley joue sur la portée et le coup critique. Si elle n'a pas subi de dégâts depuis quelques secondes, son passif rallonge sa prochaine attaque de base et lui donne une forte chance de critique, et toute la pénétration physique qu'elle achète se transforme en dégâts critiques. La compétence 1 la camoufle et renforce son attaque, la compétence 2 repousse les ennemis devant elle tout en la faisant reculer, et l'ultime verrouille un héros adverse pour lui tirer quatre balles de suite.\n\n" +
      "Le prix de ce profil se lit dans les mesures : son taux de victoire tous rangs confondus est sous la moyenne, avec un point très bas dans les parties de moins de quatorze minutes, et ne dépasse cinquante pour cent qu'à partir de la dix-huitième minute. Son passif se coupe dès qu'elle est touchée, et les balles de l'ultime peuvent être interceptées par un autre héros ennemi placé devant la cible. Les mesures la placent en difficulté face à Sun, Gloo, Estes, Tigreal et Mathilda.",
    skills: [
      {
        type: "Passive",
        name: "Lethal Shot",
        description:
          "Après quelques secondes sans subir de dégâts, sa prochaine attaque de base porte plus loin et a une forte chance de critique. La pénétration physique achetée devient des dégâts critiques, et ce tir rend deux fois plus d'énergie qu'une attaque normale.",
      },
      {
        type: "Skill 1",
        name: "Master of Camouflage",
        description:
          "La camoufle quelques secondes, avec plus de vitesse, plus d'attaque physique et une régénération d'énergie doublée. L'état prend fin dès qu'elle inflige ou subit des dégâts, et les ennemis attentifs peuvent repérer sa position.",
      },
      {
        type: "Skill 2",
        name: "Tactical Grenade",
        description:
          "Lance une grenade en cône qui repousse les ennemis pendant qu'elle fait un petit bond en arrière. Pendant l'ultime, elle annule la canalisation pour tirer immédiatement une balle restante.",
      },
      {
        type: "Ultimate",
        name: "Ultimate Snipe",
        description:
          "Verrouille un héros adverse et lui tire quatre balles d'affilée, qui rendent de l'énergie. Un autre héros ennemi peut les bloquer, et une interruption rembourse une partie de la recharge. Donne aussi, en permanence, un peu de chance de critique.",
      },
    ],
    strengths: [
      "Portée et coups critiques élevés sans avoir à s'exposer",
      "Taux de victoire mesuré en forte hausse dans les parties longues",
      "Un ultime qui achève une cible à distance",
      "Une compétence 2 qui repousse un assaillant tout en la faisant reculer",
    ],
    weaknesses: [
      "Très faible dans les parties courtes selon les mesures",
      "Son passif se coupe dès qu'elle subit des dégâts",
      "Les balles de l'ultime peuvent être bloquées par un autre héros",
      "En difficulté face à Sun, Gloo et Estes",
    ],
    strongAgainst: ["marcel", "claude", "gatotkaca", "belerick", "baxia"],
    weakAgainst: ["sun", "gloo", "estes", "tigreal", "mathilda"],
    builds: [
      {
        name: "Critique et pénétration",
        context:
          "Le build le plus joué, de loin : Malefic Gun apporte la pénétration que son passif convertit en dégâts critiques, et Sea Halberd réduit les soins et boucliers des cibles touchées.",
        items: ["Berserker's Fury", "Malefic Gun", "Sea Halberd"],
        emblem: "Marksman Emblem",
        talent: "Quantum Charge",
        spell: "Flicker",
      },
      {
        name: "Sans réduction de soins",
        context:
          "La même base avec Blade of Despair à la place de Sea Halberd : bien moins joué, avec un meilleur taux de victoire mesuré. À réserver aux parties où l'équipe adverse ne compte ni sur les soins ni sur les boucliers.",
        items: ["Berserker's Fury", "Malefic Gun", "Blade of Despair"],
        emblem: "Marksman Emblem",
        talent: "Quantum Charge",
        spell: "Flicker",
      },
    ],
  },
];
