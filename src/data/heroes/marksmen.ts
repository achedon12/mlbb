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
        emblem: "Emblème de tireur",
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
      "Elle n'a aucun déplacement instantané. Une fois l'ultime utilisé, il ne lui reste que la compétence 2 pour ralentir un assaillant, et sa cadence retombe dès qu'elle cesse de toucher une cible. Les mesures de contres la placent en difficulté face à Beatrix, Granger, Gatotkaca, Karina et Belerick, avec un écart qui se retrouve du rang Mythique au rang Gloire mythique.",
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
          "Le build le plus joué en Gold lane, tous rangs confondus comme en Gloire mythique : la chance de critique alimente Berserker's Fury et déclenche la vitesse d'attaque de Haas' Claws, qui apporte aussi le vol de vie.",
        items: ["Windtalker", "Berserker's Fury", "Haas' Claws"],
        emblem: "Emblème de tireur",
        talent: "Weakness Finder",
        spell: "Inspire",
      },
      {
        name: "Dégâts à l'impact",
        context:
          "Moins joué que la version critique, avec un taux de victoire mesuré un peu supérieur : Corrosion Scythe et Demon Hunter Sword ajoutent des dégâts à chaque attaque de base, ce qui convient face à des cibles à beaucoup de PV.",
        items: ["Corrosion Scythe", "Demon Hunter Sword", "Golden Staff"],
        emblem: "Emblème de tireur",
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
      "Elle n'a en revanche aucun déplacement instantané : si le bouclier tombe, elle redevient une cible facile à atteindre. Son taux de victoire mesuré est le plus haut dans les parties courtes et recule nettement à mesure qu'elles s'allongent, jusqu'à passer sous les cinquante pour cent après la dix-huitième minute. Au rang Gloire mythique, les mesures la placent en difficulté face à Lolita, Joy, Beatrix, Wanwan et Ixia.",
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
          "Le build de loin le plus joué en Gold lane : Corrosion Scythe, Demon Hunter Sword et Golden Staff renforcent chaque attaque de base, dont les rebonds reprennent une partie des effets. Il est le plus souvent associé à l'emblème de combattant et au sort Aegis, dont le bouclier la rend aussi insensible aux contrôles.",
        items: ["Corrosion Scythe", "Demon Hunter Sword", "Golden Staff"],
        emblem: "Emblème de combattant",
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
        emblem: "Emblème de tireur",
        talent: "Quantum Charge",
        spell: "Flicker",
      },
      {
        name: "Sans réduction de soins",
        context:
          "La même base avec Blade of Despair à la place de Sea Halberd : bien moins joué, avec un meilleur taux de victoire mesuré. À réserver aux parties où l'équipe adverse ne compte ni sur les soins ni sur les boucliers.",
        items: ["Berserker's Fury", "Malefic Gun", "Blade of Despair"],
        emblem: "Emblème de tireur",
        talent: "Quantum Charge",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "obsidia",
    summary:
      "Tireuse qui accumule des éclats d'os à chaque coup, et dont l'ultime l'attache à sa cible en lui interdisant toute fuite par une compétence de déplacement.",
    analysis:
      "Obsidia charge son passif en touchant : chaque attaque ou compétence sur un ennemi remplit une énergie qui forme des éclats d'os, jusqu'à vingt-cinq, et chacune de ses attaques de base envoie tous les éclats frapper la cible. Sa compétence 1, une aiguille lancée à distance, rapporte trois fois plus d'énergie qu'une attaque et déclenche les éclats sur le premier héros touché ; sa compétence 2 lui donne une brève accélération. L'ultime étourdit brièvement le premier héros touché, la tire jusqu'à lui et les relie pendant trois secondes : la cible ne peut plus utiliser de compétence de déplacement, Obsidia gagne un bouclier et des éclats temporaires, et peut attaquer en se déplaçant.\n\n" +
      "C'est l'une des héroïnes les plus disputées du moment : troisième taux de bannissement et quatrième taux de sélection de tous les héros, avec un bannissement qui dépasse la moitié des parties à partir de l'Honneur mythique et qui a encore monté sur les trente derniers jours. Son taux de victoire mesuré est au-dessus de la moyenne, plus haut dans les parties de moins de seize minutes qu'au-delà de la dix-huitième. Les mesures la placent en difficulté face à Baxia, Diggie, Estes, Miya et Bruno.",
    skills: [
      {
        type: "Passive",
        name: "Return to Bone",
        description:
          "Toucher un ennemi lui donne de l'énergie, davantage sur un héros et trois fois plus avec une compétence ; les monstres n'en donnent pas. L'énergie forme des éclats d'os, et chaque attaque de base envoie tous les éclats frapper la cible.",
      },
      {
        type: "Skill 1",
        name: "Abyssal Bone Needle",
        description:
          "Une aiguille lancée à distance qui blesse les ennemis touchés et déclenche les éclats sur le premier héros atteint : à lancer souvent en lane pour charger le passif.",
      },
      {
        type: "Skill 2",
        name: "Phantom Shadowmeld",
        description:
          "Plonge dans l'ombre et gagne une très forte vitesse de déplacement pendant un instant : son outil de repositionnement. Renforcée pendant l'ultime, elle dure plus longtemps et revient beaucoup plus vite.",
      },
      {
        type: "Ultimate",
        name: "Hunt of Bone",
        description:
          "Étourdit brièvement le premier héros touché et se tire jusqu'à lui pour s'y attacher. Pendant trois secondes, la cible ne peut plus utiliser de compétence de déplacement et l'entraîne en bougeant ; Obsidia gagne un bouclier et des éclats temporaires, traverse les obstacles et attaque en se déplaçant.",
      },
    ],
    strengths: [
      "Un ultime qui empêche la cible de fuir par une compétence de déplacement",
      "Des éclats qui renforcent chaque attaque de base",
      "Taux de victoire mesuré au-dessus de la moyenne, surtout avant la seizième minute",
      "Bouclier et attaque en mouvement pendant l'ultime",
    ],
    weaknesses: [
      "Bannie dans plus de la moitié des parties à partir de l'Honneur mythique",
      "Rendement mesuré en baisse dans les parties longues",
      "En difficulté face à Baxia, Diggie et Estes selon les mesures",
    ],
    strongAgainst: ["helcurt", "benedetta", "aldous", "natalia", "yin"],
    weakAgainst: ["baxia", "diggie", "estes", "miya", "bruno"],
    builds: [
      {
        name: "Gold lane critique",
        context:
          "Le build le plus joué en Gold lane : Windtalker et Haas' Claws apportent vitesse d'attaque et chance de critique pour multiplier les attaques de base qui envoient les éclats, Haas' Claws le vol de vie, et Sky Piercer exécute un héros tombé très bas. Il est associé à l'emblème de combattant et au talent Weakness Finder.",
        items: ["Windtalker", "Haas' Claws", "Sky Piercer"],
        emblem: "Emblème de combattant",
        talent: "Weakness Finder",
        spell: "Flicker",
      },
      {
        name: "Attaques lourdes",
        context:
          "Corrosion Scythe et Demon Hunter Sword à la place de Windtalker et Haas' Claws : des attaques de base qui ralentissent, infligent des dégâts selon les PV actuels de la cible et la soignent. Moins joué, avec un taux de victoire mesuré un peu plus élevé.",
        items: ["Corrosion Scythe", "Sky Piercer", "Demon Hunter Sword"],
        emblem: "Emblème de combattant",
        talent: "Weakness Finder",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "bruno",
    summary:
      "Tireur de critique qui joue avec un ballon : ses compétences lui donnent de la chance de critique, et son ultime rebondit d'ennemi en ennemi.",
    analysis:
      "Bruno gagne de la chance de critique chaque fois qu'une compétence inflige des dégâts, en se cumulant ; en contrepartie, il a plus d'attaque physique mais profite moins de la vitesse d'attaque. Sa compétence 1 renforce sa prochaine attaque d'un tir de ballon qui ralentit, puis le ballon retombe au sol : le récupérer donne une nouvelle attaque et réduit la recharge de sa compétence 2. Celle-ci est une glissade qui étourdit brièvement les ennemis sur son passage et lui rend un ballon. L'ultime frappe un héros, le repousse au bout de sa portée, l'étourdit et le ralentit fortement, puis rebondit sur d'autres ennemis en visant d'abord les héros.\n\n" +
      "Ses chiffres mesurés sont solides et réguliers : taux de victoire au-dessus de la moyenne à chaque rang et quelle que soit la durée de partie, meilleur en Gloire mythique, pour un bannissement presque nul. Son meilleur partenaire mesuré est Harith. Les mesures le placent en difficulté face à Lolita, nettement, puis à Lesley, Aamon, Karina et Saber.",
    skills: [
      {
        type: "Passive",
        name: "Mecha Legs",
        description:
          "Chaque compétence qui inflige des dégâts lui donne un peu de chance de critique, cumulable. Il a plus d'attaque physique que la normale, mais ne profite que d'une partie des bonus de vitesse d'attaque.",
      },
      {
        type: "Skill 1",
        name: "Volley Shot",
        description:
          "Sa prochaine attaque de base tire un ballon qui blesse et ralentit la cible, puis retombe au sol. Le ramasser, lui ou un allié, permet une nouvelle attaque et réduit la recharge de la glissade.",
      },
      {
        type: "Skill 2",
        name: "Slide",
        description:
          "Une glissade qui étourdit brièvement les ennemis sur son passage et lui donne un ballon à l'arrivée : son outil de fuite comme d'achèvement.",
      },
      {
        type: "Ultimate",
        name: "Worldie",
        description:
          "Frappe un héros ennemi, le repousse au bout de sa portée, l'étourdit et le ralentit fortement, puis rebondit plusieurs fois entre les ennemis en visant d'abord les héros.",
      },
    ],
    strengths: [
      "Taux de victoire mesuré au-dessus de la moyenne à chaque rang",
      "Une glissade qui étourdit et sert de fuite",
      "Un ultime qui repousse, étourdit puis rebondit",
      "Rarement banni",
    ],
    weaknesses: [
      "Ne profite que d'une partie des bonus de vitesse d'attaque",
      "Dépend de ballons à ramasser pour enchaîner",
      "En difficulté face à Lolita, Lesley et Aamon selon les mesures",
    ],
    strongAgainst: ["wanwan", "ling", "fanny", "benedetta", "joy"],
    weakAgainst: ["lolita", "lesley", "aamon", "karina", "saber"],
    builds: [
      {
        name: "Gold lane critique",
        context:
          "Le build le plus joué en Gold lane : Haas' Claws et Berserker's Fury misent sur le critique, que son passif alimente, Haas' Claws ajoute le vol de vie et Malefic Gun la pénétration physique et de la portée. Les trois versions les plus jouées partagent ces objets ; celle à l'emblème de combattant avec Flicker affiche le meilleur taux de victoire mesuré.",
        items: ["Haas' Claws", "Berserker's Fury", "Malefic Gun"],
        emblem: "Emblème de tireur",
        talent: "Quantum Charge",
        spell: "Aegis",
      },
    ],
  },
  {
    slug: "layla",
    summary:
      "Tireuse de portée dont les dégâts augmentent avec la distance, très jouée aux premiers rangs et de moins en moins à mesure qu'on monte.",
    analysis:
      "Layla tire de loin et a intérêt à y rester : son passif augmente ses dégâts avec la distance, jusqu'à un maximum à longue portée. Sa compétence 1 lance une bombe qui, si elle touche, allonge pour quelques secondes la portée de ses attaques de base et de sa compétence 2 et l'accélère. Sa compétence 2 marque la cible ; toucher ensuite une cible marquée inflige des dégâts autour d'elle et l'étourdit très brièvement. L'ultime allonge en permanence la portée de ses attaques et de sa compétence 2, et se lance en un tir puissant en ligne droite.\n\n" +
      "Son taux de sélection mesuré est élevé aux rangs Épique et Légende et baisse à chaque rang jusqu'à la Gloire mythique, où son taux de victoire est aussi le plus bas. Elle est très faible dans les parties de moins de douze minutes, puis au-dessus de la moyenne entre la quatorzième et la vingtième. Elle n'a ni bond ni téléportation. Les mesures la placent en difficulté face à Atlas, Johnson, Sun, Khufra et Hylos.",
    skills: [
      {
        type: "Passive",
        name: "Malefic Gun",
        description:
          "Ses dégâts augmentent avec la distance qui la sépare de la cible, jusqu'à un maximum à longue portée. L'effet ne s'applique pas aux tourelles.",
      },
      {
        type: "Skill 1",
        name: "Malefic Bomb",
        description:
          "Une bombe qui blesse le premier ennemi touché et peut faire un coup critique. Si elle touche, ses attaques de base et sa compétence 2 portent plus loin quelques secondes, et elle gagne une accélération qui dure deux fois plus longtemps sur un héros.",
      },
      {
        type: "Skill 2",
        name: "Void Projectile",
        description:
          "Un orbe qui blesse la cible et ses voisins et la marque quelques secondes. Toucher ensuite une cible marquée inflige des dégâts autour d'elle et l'étourdit très brièvement.",
      },
      {
        type: "Ultimate",
        name: "Destruction Rush",
        description:
          "En permanence, allonge la portée de ses attaques de base et de sa compétence 2, et un peu sa vision. Lancé, un tir puissant en ligne droite qui blesse tous les ennemis traversés.",
      },
    ],
    strengths: [
      "Portée longue, encore allongée par la compétence 1 et l'ultime",
      "Dégâts accrus à distance",
      "Taux de victoire mesuré au-dessus de la moyenne entre la quatorzième et la vingtième minute",
    ],
    weaknesses: [
      "Ni bond ni téléportation pour se dégager",
      "Très faible dans les parties courtes selon les mesures",
      "Taux de victoire mesuré le plus bas en Gloire mythique",
      "En difficulté face à Atlas, Johnson et Sun selon les mesures",
    ],
    strongAgainst: ["diggie", "rafaela", "phoveus", "edith", "bruno"],
    weakAgainst: ["atlas", "johnson", "sun", "khufra", "hylos"],
    builds: [
      {
        name: "Gold lane critique",
        context:
          "Le build le plus joué en Gold lane, de loin : Windtalker apporte vitesse d'attaque, critique et vitesse de déplacement, Berserker's Fury les dégâts critiques, Haas' Claws le vol de vie et de la vitesse d'attaque sur critique. Il est associé à l'emblème d'assassin, au talent Quantum Charge et au sort Flicker.",
        items: ["Windtalker", "Berserker's Fury", "Haas' Claws"],
        emblem: "Emblème d'assassin",
        talent: "Quantum Charge",
        spell: "Flicker",
      },
    ],
  },
];
