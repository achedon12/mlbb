import type { HeroAnalysis } from "@/lib/types";

/** Analyses of the fighters. Factual data: see the sync. */
export const fighters: HeroAnalysis[] = [
  {
    slug: "chou",
    summary:
      "Combattant d'isolement : il extrait une cible du groupe adverse et la tue avant que son équipe ne réagisse.",
    analysis:
      "Chou est le héros du roam au plafond de maîtrise le plus élevé. L'idée est simple — l'ultime repousse une cible et la poursuit — mais son exécution repose sur des annulations d'animation que le jeu n'explique nulle part. Le combo de référence enchaîne compétence 1, saut annulé, ultime, puis compétence 2 pour retenir la cible à l'atterrissage.\n\nSon intérêt en équipe organisée vient de là : il choisit qui meurt. Contre un joueur qui garde son Purify, en revanche, l'ultime perd la moitié de sa valeur, et Chou redevient un combattant moyen.",
    skills: [
      {
        type: "Passive",
        name: "Only Fast",
        description:
          "Après avoir parcouru une certaine distance, sa prochaine attaque de base inflige des dégâts accrus, ralentit brièvement la cible et réduit sa défense physique.",
      },
      {
        type: "Skill 1",
        name: "Jeet Kune Do",
        description:
          "Trois frappes successives. La dernière projette les ennemis touchés en l'air.",
      },
      {
        type: "Skill 2",
        name: "Shunpo",
        description:
          "Se rue dans une direction en devenant insensible aux contrôles et gagne un bouclier.",
      },
      {
        type: "Ultimate",
        name: "The Way of Dragon",
        description:
          "Frappe un héros adverse et le repousse ; relancée, elle le poursuit pour de nouveaux dégâts. Déplace un adversaire loin de son équipe.",
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
          "Valkyrie's Shield",
          "Antique Cuirass",
          "Blade Armor",
          "Guardian Helmet",
        ],
        emblem: "Emblème de soutien",
        talent: "Focusing Mark",
        spell: "Flicker",
      },
      {
        name: "EXP lane offensif",
        context:
          "En EXP lane, quand Chou doit gagner son duel plutôt que servir son équipe.",
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
      "Combattant d'EXP lane qui se soigne en frappant et devient très difficile à tuer en combat prolongé.",
    analysis:
      "Yu Zhong gagne les combats qui durent. Son passif pose des cumuls de Sha Residue sur les héros qu'il frappe ; à cinq, ils éclatent, le soignent à chaque cumul consommé et l'accélèrent, ce qui le rend excellent dès qu'il y a plusieurs cibles à portée — un affrontement à cinq lui donne bien plus de retour qu'un duel.\n\nSon ultime le rend immunisé aux contrôles pendant qu'il avance, ce qui en fait aussi un initiateur crédible. Le contrer passe presque toujours par la réduction de soins : sans elle, un Yu Zhong bien équipé absorbe une équipe entière.",
    skills: [
      {
        type: "Passive",
        name: "Cursing Touch",
        description:
          "Ses dégâts physiques posent des cumuls de Sha Residue sur les héros adverses. À cinq cumuls, ils éclatent : chaque cumul consommé blesse la cible et rend à Yu Zhong une partie de ses PV perdus, et il gagne de la vitesse.",
      },
      {
        type: "Skill 1",
        name: "Dragon Tail",
        description:
          "Sa cape devient une arme qui frappe les ennemis proches après un court délai. Le bord tranchant inflige bien plus de dégâts et pose deux cumuls de Sha Residue.",
      },
      {
        type: "Skill 2",
        name: "Soul Grip",
        description:
          "Libère l'âme du dragon devant lui, qui blesse et ralentit les ennemis. S'il touche, sa prochaine attaque de base est renforcée, d'autant plus qu'il a touché plusieurs ennemis.",
      },
      {
        type: "Ultimate",
        name: "Black Dragon Form",
        description:
          "Après une courte canalisation, prend sa forme de dragon noir : immunisé aux contrôles, avec des PV supplémentaires, il se déplace librement en repoussant les héros sur son passage. En sortant de cette forme, ses compétences gagnent de la portée.",
      },
    ],
    strengths: [
      "Régénération très forte dans les combats à cinq",
      "Immunité aux contrôles pendant l'ultime",
      "Bonne poussée de lane et bon contrôle de vague",
    ],
    weaknesses: [
      "Très affaibli par la réduction de soins",
      "Début de partie fragile avant le troisième objet",
      "Peu de dégâts sur cible unique isolée",
    ],
    strongAgainst: ["balmond", "alucard", "sun", "hilda"],
    weakAgainst: ["baxia", "dyrroth", "esmeralda", "phoveus"],
    builds: [
      {
        name: "EXP lane régénération",
        context:
          "Le build de référence : de la résistance et du vol de vie, puisque le passif le soigne déjà à chaque cumul consommé.",
        items: [
          "Warrior Boots",
          "Bloodlust Axe",
          "Immortality",
          "Antique Cuirass",
          "Valkyrie's Shield",
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
      "Combattant à fenêtres : toutes les trois compétences, la suivante est améliorée, pour un pic de dégâts très court.",
    analysis:
      "Paquito ne se joue pas compétence par compétence mais par séquences. Toutes les trois compétences lancées, il passe en Champ Stance et obtient une version améliorée d'une compétence, même en recharge : tout son intérêt consiste à choisir la bonne et à la placer au bon moment.\n\nBien joué, il supprime une cible fragile en deux secondes depuis une distance considérable. Mal joué, il gaspille ses versions améliorées sur des sbires et n'a plus rien. C'est un héros de rythme, très sensible au niveau du joueur.",
    skills: [
      {
        type: "Passive",
        name: "Champ Stance",
        description:
          "Toutes les trois compétences lancées, il entre en Champ Stance : sa prochaine compétence est améliorée, même en recharge, et il gagne de la vitesse après l'avoir lancée.",
      },
      {
        type: "Skill 1",
        name: "Heavy Left Punch",
        description:
          "Frappe droit devant et lui donne un bouclier. Version améliorée : dégâts et bouclier accrus.",
      },
      {
        type: "Skill 2",
        name: "Jab",
        description:
          "Se rue vers l'avant en frappant les ennemis sur son passage. Version améliorée : dégâts accrus, et la ruée s'arrête sur le premier héros ou monstre touché.",
      },
      {
        type: "Ultimate",
        name: "Knockout Strike",
        description:
          "Repousse les ennemis devant lui, les frappe en les ralentissant, puis recule. Version améliorée : un uppercut final, plus fort, les projette en l'air.",
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
      "Puni par les héros qui gardent leur contrôle",
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
  {
    slug: "dyrroth",
    summary:
      "Combattant de rage qui retire l'armure physique de sa cible avant de la frapper, joué en EXP lane comme en jungle.",
    analysis:
      "Dyrroth accumule de la rage en combattant ; à mi-jauge, ses deux premières compétences passent en version renforcée, avec plus de portée ou plus de dégâts. Toutes les deux attaques de base, il frappe en cercle autour de lui et se soigne, et chaque héros touché raccourcit ses recharges. La compétence 2 le lance sur une cible puis, relancée, lui retire une grande partie de son armure physique pendant quelques secondes : c'est l'ouverture qui rend le reste de ses dégâts efficaces. L'ultime part après un court délai, ne peut pas être interrompu et ralentit tout ce qu'il traverse.\n\n" +
      "Il vit sur ses échanges de début de partie : son taux de victoire mesuré est au plus haut dans les parties courtes et passe sous la moyenne après la dix-huitième minute. Ses chiffres varient aussi selon le rang, plus bas en Mythique qu'en Gloire mythique. Les mesures le placent en difficulté face à Masha, Benedetta et Thamuz.",
    skills: [
      {
        type: "Passive",
        name: "Wrath of the Abyss",
        description:
          "À partir de la moitié de sa jauge de rage, ses compétences 1 et 2 sont renforcées. Toutes les deux attaques de base, il frappe en cercle et récupère des PV, et chaque héros touché réduit les recharges de ses deux premières compétences.",
      },
      {
        type: "Skill 1",
        name: "Burst Strike",
        description:
          "Frappe en ligne qui ralentit les ennemis touchés. Renforcée, elle porte plus loin, frappe plus fort et ralentit davantage : un bon moyen d'empêcher une cible de sortir de portée.",
      },
      {
        type: "Skill 2",
        name: "Spectre Step",
        description:
          "Une ruée qui s'arrête sur le premier ennemi hors sbires, puis une seconde frappe verrouillée qui réduit fortement l'armure physique de la cible. Renforcée, la réduction est plus forte et la cible est très fortement ralentie un instant.",
      },
      {
        type: "Ultimate",
        name: "Abysm Strike",
        description:
          "Après un court délai, un coup dévastateur part droit devant, impossible à interrompre, et ralentit les ennemis sur son passage. Le délai se voit : il se lance de préférence sur une cible déjà ralentie.",
      },
    ],
    strengths: [
      "Réduction d'armure physique intégrée à la compétence 2",
      "Soin régulier en combat grâce à son passif",
      "Recharges raccourcies à chaque héros touché",
      "Deux positions possibles : EXP lane ou jungle",
    ],
    weaknesses: [
      "Taux de victoire mesuré en baisse dans les parties longues",
      "Compétences renforcées seulement à partir de la mi-jauge de rage",
      "Un ultime lancé après un délai, que la cible peut anticiper",
      "En difficulté face à Masha, Benedetta et Thamuz selon les mesures",
    ],
    strongAgainst: ["uranus", "esmeralda", "alice", "aldous", "natalia"],
    weakAgainst: ["masha", "benedetta", "thamuz"],
    builds: [
      {
        name: "EXP lane",
        context:
          "Le build le plus joué en EXP lane tous rangs confondus : War Axe et Queen's Wings pour le vol de vie et la survie, Rose Gold Meteor pour le bouclier quand ses PV tombent bas. Les choix restent très dispersés à cette position, et en Gloire mythique c'est une version à pénétration (Blade of the Heptaseas, Hunter Strike, Rose Gold Meteor) qui passe devant.",
        items: ["War Axe", "Rose Gold Meteor", "Queen's Wings"],
        emblem: "Emblème d'assassin",
        talent: "Lethal Ignition",
        spell: "Petrify",
      },
      {
        name: "Jungle",
        context:
          "Le build le plus joué en jungle : Brute Force Breastplate ajoute des PV, de l'attaque et une réduction de la durée des contrôles quand il enchaîne les dégâts, War Axe et Rose Gold Meteor gardent le vol de vie.",
        items: ["War Axe", "Brute Force Breastplate", "Rose Gold Meteor"],
        emblem: "Emblème d'assassin",
        talent: "Killing Spree",
        spell: "Retribution",
      },
    ],
  },
  {
    slug: "sun",
    summary:
      "Combattant qui se multiplie : ses doubles frappent avec lui, le soignent et rongent l'armure des cibles.",
    analysis:
      "Sun combat en invoquant des doubles. Ses deux premières compétences lancent son bâton, qui laisse un double temporaire ; la seconde le cache en plus pendant qu'il se déplace avec le bâton. L'ultime invoque un double plus durable, plus proche de ses propres statistiques. Chaque coup porté par Sun ou ses doubles réduit un peu l'armure physique de la cible, et chaque coup d'un double le soigne : plus il y a de doubles sur une cible, plus elle fond vite et plus il tient.\n\n" +
      "Son profil mesuré est celui d'un héros de fin de partie : taux de victoire sous la moyenne dans les parties de moins de quatorze minutes, puis nettement au-dessus au-delà de la seizième. Il est aussi très souvent banni, surtout au rang Mythique. Le double de l'ultime subit des dégâts accrus, et les mesures placent Sun en difficulté face à Aldous, Natan, Alucard, Joy et Ruby.",
    skills: [
      {
        type: "Passive",
        name: "Simian God",
        description:
          "Chaque coup de Sun ou d'un double réduit l'armure physique de la cible, en se cumulant. Chaque fois qu'un double inflige des dégâts, Sun récupère des PV. Ses attaques et celles de ses doubles frappent aussi plus fort les monstres.",
      },
      {
        type: "Skill 1",
        name: "Endless Variety",
        description:
          "Lance le bâton en ligne ; à l'impact ou en bout de course, il se change en double qui reprend une partie de ses statistiques. Partage sa recharge et ses niveaux avec la compétence 2.",
      },
      {
        type: "Skill 2",
        name: "Swift Exchange",
        description:
          "Lance le bâton en laissant un double à sa place, pendant que Sun se dissimule et voyage avec le bâton. Il peut ainsi changer de position sans être vu, en laissant le double derrière lui.",
      },
      {
        type: "Ultimate",
        name: "Clone Techniques",
        description:
          "Invoque un double plus durable qui reprend l'essentiel de ses statistiques et de ses effets d'attaque. Ce double subit en revanche des dégâts accrus.",
      },
    ],
    strengths: [
      "Réduction d'armure cumulée par lui et ses doubles",
      "Soin à chaque coup d'un double",
      "Taux de victoire mesuré en forte hausse dans les parties longues",
      "La compétence 2 le dissimule pendant son déplacement",
    ],
    weaknesses: [
      "Faible dans les parties courtes selon les mesures",
      "Le double de l'ultime subit des dégâts accrus",
      "En difficulté face à Aldous, Natan et Alucard selon les mesures",
    ],
    strongAgainst: ["masha", "cici", "jawhead", "karrie", "diggie", "lesley"],
    weakAgainst: ["aldous", "natan", "alucard", "joy", "ruby"],
    builds: [
      {
        name: "EXP lane",
        context:
          "Le build le plus joué en EXP lane : vitesse d'attaque et critique, dont ses doubles profitent en reprenant une partie de ses effets d'attaque, et Great Dragon Spear pour la vitesse après l'ultime. Il est le plus souvent associé à l'emblème de soutien et au sort Petrify.",
        items: ["Windtalker", "Corrosion Scythe", "Great Dragon Spear"],
        emblem: "Emblème de soutien",
        talent: "Temporal Reign",
        spell: "Petrify",
      },
      {
        name: "Jungle",
        context:
          "Les trois mêmes objets en jungle, Corrosion Scythe en premier, avec l'emblème de tireur et Retribution : c'est la version la plus jouée à cette position.",
        items: ["Corrosion Scythe", "Windtalker", "Great Dragon Spear"],
        emblem: "Emblème de tireur",
        talent: "Quantum Charge",
        spell: "Retribution",
      },
    ],
  },
  {
    slug: "guinevere",
    summary:
      "Combattante à dégâts magiques qui projette ses cibles en l'air, puis les y maintient sous son ultime.",
    analysis:
      "Guinevere est construite autour de la projection. Sa compétence 2 la fait bondir sur une zone en envoyant les ennemis en l'air, puis peut se relancer pour une courte téléportation qui laisse une illusion derrière elle. Elle inflige des dégâts supplémentaires aux cibles en l'air, et ses coups marquent les ennemis : une cible à trois marques est projetée par son ultime, qui relance en l'air à chaque coup les ennemis qui y sont déjà, pendant que Guinevere reste insensible aux contrôles.\n\n" +
      "Tout dépend donc de la compétence 2 : si le bond rate et que les marques manquent, l'ultime perd l'essentiel de son contrôle. Ses chiffres mesurés sont proches de la moyenne, un peu meilleurs dans les parties courtes, et son taux de bannissement a reculé sur les trente derniers jours. Les mesures la placent en difficulté face à Masha, Wanwan, Khufra, Diggie et Fanny.",
    skills: [
      {
        type: "Passive",
        name: "Super Magic",
        description:
          "Ses attaques de base infligent des dégâts magiques et chargent une jauge ; pleine, elle rend la prochaine attaque de base guidée. Ses coups marquent les ennemis, et elle frappe plus fort les cibles en l'air.",
      },
      {
        type: "Skill 1",
        name: "Energy Wave",
        description:
          "Un orbe qui blesse et ralentit le premier ennemi touché. Chaque touche réduit toutes ses recharges : c'est la compétence à lancer le plus souvent pour préparer les marques.",
      },
      {
        type: "Skill 2",
        name: "Spatial Migration",
        description:
          "Bond sur une zone qui étourdit brièvement puis projette en l'air les héros et monstres touchés. Relancée dans les secondes qui suivent, elle la téléporte en la rendant invisible un instant et laisse une illusion qui explose si on la frappe.",
      },
      {
        type: "Ultimate",
        name: "Violet Requiem",
        description:
          "Crée un champ de force qui frappe les ennemis proches à répétition. Les cibles déjà en l'air, ou marquées trois fois, y sont relancées plusieurs fois. Elle est insensible aux contrôles pendant la durée.",
      },
    ],
    strengths: [
      "Contrôle de zone répété sous l'ultime",
      "Insensible aux contrôles pendant l'ultime",
      "Une relance de la compétence 2 pour se repositionner",
      "Recharges réduites quand la compétence 1 touche",
    ],
    weaknesses: [
      "Un ultime qui dépend d'une projection ou de marques posées avant",
      "Taux de victoire mesuré proche de la moyenne, sans pic marqué",
      "En difficulté face à Masha, Wanwan et Khufra selon les mesures",
    ],
    strongAgainst: ["julian", "karrie", "esmeralda", "thamuz"],
    weakAgainst: ["masha", "wanwan", "khufra", "diggie", "fanny"],
    builds: [
      {
        name: "Vol de vie magique",
        context:
          "Le build le plus joué : Concentrated Energy apporte puissance magique et vol de vie hybride, Queen's Wings de la survie et de la recharge quand ses PV baissent, Divine Glaive la pénétration magique.",
        items: ["Concentrated Energy", "Queen's Wings", "Divine Glaive"],
        emblem: "Emblème de mage",
        talent: "Temporal Reign",
        spell: "Flicker",
      },
      {
        name: "Dégâts après compétence",
        context:
          "Starlium Scythe à la place de Queen's Wings, pour des dégâts supplémentaires sur l'attaque qui suit chaque compétence : moins joué, avec un taux de victoire mesuré comparable.",
        items: ["Concentrated Energy", "Starlium Scythe", "Divine Glaive"],
        emblem: "Emblème de mage",
        talent: "Impure Rage",
        spell: "Flicker",
      },
    ],
  },
];
