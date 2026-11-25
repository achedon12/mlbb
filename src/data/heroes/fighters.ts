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
  {
    slug: "masha",
    summary:
      "Combattante à trois barres de PV : chaque barre brisée la libère des contrôles, et ses attaques de base deviennent des coups de griffe en zone qui la soignent.",
    analysis:
      "Masha joue sur ses trois barres de PV. Chacune reprend la moitié des PV apportés par ses objets, et chaque barre qui tombe lui retire ses effets de contrôle, bloque une attaque et réinitialise la recharge de Claw Strike. Les compétences qui touchent un héros ouvrent une plaie sur un côté de la cible ; briser cette plaie d'une attaque de base fait entrer Masha en état sauvage, avec résilience, vitesse d'attaque et vitesse de déplacement, et change ses trois attaques suivantes en coups de griffe en éventail qui infligent des dégâts selon les PV et la soignent. L'ultime la fait charger un héros adverse, l'étourdit et repousse les ennemis autour.\n\n" +
      "Ses chiffres mesurés sont les plus hauts du jeu : premier taux de victoire de tous les héros tous rangs confondus, au-dessus de cinquante-six pour cent quelle que soit la durée de partie, et un bannissement qui grimpe avec le rang, rare en Épique, dans deux parties sur trois en Gloire mythique. Le patch 2.2.23 a déplacé le ralentissement de sa compétence 1 vers sa compétence 2 et réduit les dégâts et le soin de ses coups de griffe ; son taux de victoire a légèrement reculé sur les trente derniers jours. Les mesures la placent en difficulté face à Freya, Estes, Bruno, Melissa et Floryn.",
    skills: [
      {
        type: "Passive",
        name: "Primal Pact",
        description:
          "Trois barres de PV, qui reprennent chacune la moitié des PV de ses objets. Une barre brisée retire ses effets de contrôle et bloque une attaque. Ses compétences ouvrent des plaies sur les héros touchés : en briser une d'une attaque de base déclenche l'état sauvage et des coups de griffe en zone qui la soignent.",
      },
      {
        type: "Skill 1",
        name: "Feral Swipe",
        description:
          "Une onde d'énergie vers l'avant qui blesse les ennemis sur son trajet et frappe plus fort les sbires : l'outil pour nettoyer une vague, et pour ouvrir une plaie à distance.",
      },
      {
        type: "Skill 2",
        name: "Claw Strike",
        description:
          "Un bond vers la cible qui ralentit les héros touchés. Sa recharge est réinitialisée chaque fois qu'une barre de PV tombe, ce qui lui rend aussitôt un moyen de poursuivre ou de s'échapper.",
      },
      {
        type: "Ultimate",
        name: "Savage Maul",
        description:
          "Charge un héros adverse, l'étourdit et repousse les ennemis proches. Ses dégâts augmentent avec les PV supplémentaires : c'est l'ouverture des combats d'équipe sur une cible fragile.",
      },
    ],
    strengths: [
      "Premier taux de victoire mesuré de tous les héros",
      "Trois barres de PV, chacune la libérant des contrôles",
      "Coups de griffe en zone qui la soignent",
      "Rendement mesuré stable quelle que soit la durée de partie",
    ],
    weaknesses: [
      "Bannie dans deux parties sur trois en Gloire mythique",
      "Coups de griffe et soin réduits par le patch 2.2.23",
      "En difficulté face à Freya, Estes et Bruno selon les mesures",
    ],
    strongAgainst: ["lesley", "eudora", "gloo", "aamon", "cici"],
    weakAgainst: ["freya", "estes", "bruno", "melissa", "floryn"],
    builds: [
      {
        name: "EXP lane",
        context:
          "Les trois builds les plus joués en EXP lane partagent ces objets : Thunder Belt et Guardian Helmet apportent les PV que reprennent ses trois barres et dont dépend son ultime, Corrosion Scythe la vitesse d'attaque pour briser les plaies et enchaîner les coups de griffe. Ils sont associés à l'emblème de tank, au talent War Cry et, le plus souvent, au sort Petrify.",
        items: ["Thunder Belt", "Corrosion Scythe", "Guardian Helmet"],
        emblem: "Emblème de tank",
        talent: "War Cry",
        spell: "Petrify",
      },
    ],
  },
  {
    slug: "argus",
    summary:
      "Combattant de critique dont l'ultime le rend impossible à tuer quelques secondes, puis le soigne de tous les dégâts infligés aux héros.",
    analysis:
      "Argus mise sur le coup critique : son passif lui donne d'emblée une chance de critique, et chaque critique devient une entaille démoniaque qui ignore une partie de l'armure et le soigne. Sa compétence 1 lance une main qui étourdit le premier ennemi touché et les rapproche l'un de l'autre, puis se relance en ruée suivie d'un large coup ; sa compétence 2 compte comme une attaque de base, étourdit brièvement le héros touché et lui donne de la vitesse d'attaque. L'ultime lui retire ses effets de contrôle et le rend immortel quelques secondes, puis lui rend des PV à hauteur des dégâts infligés aux héros pendant ce temps. Tant qu'il est disponible, il se déclenche seul face à un coup fatal.\n\n" +
      "C'est l'un des héros les plus efficaces selon les mesures et l'un des moins bannis : troisième taux de victoire de tous les héros, au-dessus de cinquante-cinq pour cent à chaque rang, pour un bannissement d'environ une partie sur cent. Son rendement grimpe avec la durée de partie, juste au-dessus de la moyenne avant la douzième minute et au-delà de soixante pour cent à partir de la seizième. Les mesures le placent en difficulté face à Barats, Terizla, Uranus, Ruby et Fredrinn.",
    skills: [
      {
        type: "Passive",
        name: "Warmonger",
        description:
          "Il commence avec une chance de critique. Ses critiques deviennent des entailles démoniaques, qui ignorent une partie de l'armure physique de la cible et le soignent, tout en déclenchant les effets liés au critique.",
      },
      {
        type: "Skill 1",
        name: "Demonic Grip",
        description:
          "Une main démoniaque qui étourdit le premier ennemi touché, le ralentit et les rapproche l'un de l'autre ; sans cible, Argus est tiré au bout de sa course. Relancée, elle devient une ruée suivie d'un large coup.",
      },
      {
        type: "Skill 2",
        name: "Meteoric Sword",
        description:
          "Après une courte charge, un coup d'épée qui compte comme une attaque de base. Sur un héros, il étourdit brièvement et donne de la vitesse d'attaque ; ses dégâts profitent de la chance et des dégâts critiques, et la vitesse d'attaque raccourcit la charge.",
      },
      {
        type: "Ultimate",
        name: "Eternal Evil",
        description:
          "Retire ses effets de contrôle, le rend immortel quelques secondes et blesse les ennemis proches, plus fort quand ses PV sont bas. À la fin, il récupère des PV à hauteur des dégâts infligés aux héros. Disponible, il se déclenche seul face à un coup fatal, sans les dégâts.",
      },
    ],
    strengths: [
      "Troisième taux de victoire mesuré de tous les héros",
      "Un ultime qui le rend immortel puis lui rend des PV",
      "Rendement mesuré au-delà de soixante pour cent dans les parties longues",
      "Rarement banni",
    ],
    weaknesses: [
      "Rendement mesuré proche de la moyenne dans les parties courtes",
      "Une fois l'ultime utilisé, plus rien ne le sauve d'un coup fatal",
      "En difficulté face à Barats, Terizla et Uranus selon les mesures",
    ],
    strongAgainst: ["karrie", "lunox", "helcurt", "guinevere", "arlott"],
    weakAgainst: ["barats", "terizla", "uranus", "ruby", "fredrinn"],
    builds: [
      {
        name: "Critique",
        context:
          "Le build le plus joué en EXP lane : vitesse d'attaque et chance de critique, que ses entailles démoniaques convertissent ; depuis le patch 2.2.16, ses critiques déclenchent toujours les effets de Berserker's Fury et de Windtalker. Haas' Claws ajoute le vol de vie. Il est associé à l'emblème de tireur, au talent War Cry et au sort Petrify.",
        items: ["Corrosion Scythe", "Windtalker", "Berserker's Fury", "Haas' Claws"],
        emblem: "Emblème de tireur",
        talent: "War Cry",
        spell: "Petrify",
      },
    ],
  },
  {
    slug: "lukas",
    summary:
      "Combattant qui se transforme en bête sacrée une fois sa jauge de résolution pleine ; sa compétence 1 change selon les attaques portées avant.",
    analysis:
      "Lukas remplit sa résolution avec le temps et, plus vite, en blessant des héros. Pleine, elle lui permet de se transformer en bête sacrée avec son ultime : tous ses attributs augmentent, ses compétences gagnent de nouveaux effets, et une relance tire une onde de choc ; la forme dure tant qu'il reste de la résolution. Dans les deux formes, tout passe par l'enchaînement : sa compétence 2 le fait bondir et renforce sa prochaine attaque, qui le replace derrière la cible et l'accélère ; chaque attaque de base charge sa compétence 1, qui étourdit brièvement et, à deux charges, le rend insensible aux contrôles pendant sa rotation.\n\n" +
      "Ses chiffres mesurés sont proches de la moyenne, avec un profil net selon la durée : très bas dans les parties de moins de douze minutes, au-dessus de la moyenne à partir de la quatorzième. Son taux de bannissement, qui monte avec le rang, a nettement reculé sur les trente derniers jours. Le patch 2.2.23 lui a donné plus de PV et d'armure de base et a reporté les dégâts de sa compétence 1 sur sa base plutôt que sur l'attaque physique, pour rendre les builds défensifs plus viables. Les mesures le placent en difficulté face à Phoveus, Balmond, Baxia, Valentina et Minsitthar.",
    skills: [
      {
        type: "Passive",
        name: "Hero's Resolve",
        description:
          "Gagne de la résolution avec le temps et en blessant des héros. Pleine, elle débloque la transformation en bête sacrée, qui consomme la résolution jusqu'à l'épuiser.",
      },
      {
        type: "Skill 1",
        name: "Flash Combo",
        description:
          "Ses attaques de base lui donnent jusqu'à deux charges de vigueur, que la compétence consomme pour un coup qui le soigne s'il touche un héros ou un sbire. Avec une charge, elle étourdit brièvement et attire la cible en tournoyant ; avec deux, elle ajoute deux coups et le rend insensible aux contrôles pendant la rotation.",
      },
      {
        type: "Skill 2",
        name: "Flash Step",
        description:
          "Un bond qui renforce sa prochaine attaque de base : elle le replace derrière l'ennemi, puis lui donne vitesse de déplacement et vitesse d'attaque, et allonge la portée de l'attaque suivante, qui déclenche un éclair.",
      },
      {
        type: "Ultimate",
        name: "Unleash the Beast",
        description:
          "Le transforme en bête sacrée, insensible aux contrôles un instant : vitesse accrue, attributs augmentés et nouveaux effets pour ses compétences. Relancé, il tire une onde de choc qui explose sur le premier héros touché.",
      },
    ],
    strengths: [
      "Une forme de bête sacrée qui augmente tous ses attributs",
      "Insensible aux contrôles pendant la rotation à deux charges",
      "Soin à chaque coup de la compétence 1",
      "Taux de victoire mesuré au-dessus de la moyenne dans les parties longues",
    ],
    weaknesses: [
      "Très faible dans les parties courtes selon les mesures",
      "Une transformation qui attend que sa résolution soit pleine",
      "En difficulté face à Phoveus, Balmond et Baxia selon les mesures",
    ],
    strongAgainst: ["ling", "natalia", "arlott", "helcurt", "fanny"],
    weakAgainst: ["phoveus", "balmond", "baxia", "valentina", "minsitthar"],
    builds: [
      {
        name: "Jungle",
        context:
          "Le build le plus joué en jungle, de très loin : Hunter Strike apporte attaque, réduction de recharge et pénétration physique, War Axe de l'attaque cumulée en combat, des PV et du vol de vie, Queen's Wings de la survie quand ses PV baissent.",
        items: ["Hunter Strike", "War Axe", "Queen's Wings"],
        emblem: "Emblème d'assassin",
        talent: "Temporal Reign",
        spell: "Retribution",
      },
      {
        name: "EXP lane",
        context:
          "Les trois mêmes objets en EXP lane, avec le sort Vengeance : c'est la version la plus jouée à cette position. La variante à l'emblème de combattant, moins jouée, affiche un taux de victoire mesuré plus élevé.",
        items: ["Hunter Strike", "War Axe", "Queen's Wings"],
        emblem: "Emblème d'assassin",
        talent: "Temporal Reign",
        spell: "Vengeance",
      },
    ],
  },
  {
    slug: "freya",
    summary:
      "Combattante à attaques de base, qui charge des orbes en frappant et les dépense en vitesse d'attaque, en PV et en ruées sans recharge de base.",
    analysis:
      "Freya tourne autour d'une ressource : chaque attaque de base lui donne un orbe sacré, et chaque orbe dépensé rend sa prochaine attaque beaucoup plus rapide et la soigne. Sa compétence 2 n'a pas de recharge de base mais coûte deux orbes : c'est une ruée qui blesse et ralentit, à alterner avec les attaques de base pour garder la réserve pleine. Sa compétence 1 la fait bondir sur une zone en lui donnant un bouclier et en projetant les ennemis en l'air. L'ultime est une plongée insensible aux contrôles qui ralentit les ennemis touchés, puis la fait entrer en état de Valkyrie : ses attaques de base infligent alors des dégâts de zone.\n\n" +
      "Ses chiffres mesurés dépendent du rang et de la durée : taux de victoire sous la moyenne de l'Épique à l'Honneur mythique, au-dessus en Gloire mythique, et nettement meilleur dans les parties de moins de douze minutes qu'au-delà de la quatorzième. Le patch 2.2.23 a fait rendre des PV à chaque orbe dépensé et allongé la recharge de son ultime. Son taux de bannissement a presque doublé sur les trente derniers jours. Les mesures la placent en difficulté face à Minsitthar, Phoveus, Baxia, Edith et Franco.",
    skills: [
      {
        type: "Passive",
        name: "Power of Einherjar",
        description:
          "Chaque attaque de base lui donne un orbe sacré, jusqu'à six. Dépenser un orbe rend sa prochaine attaque de base bien plus rapide et la soigne ; hors combat, les orbes se reconstituent peu à peu.",
      },
      {
        type: "Skill 1",
        name: "Leap of Faith",
        description:
          "Bondit sur une zone et frappe le sol de son bouclier : elle gagne un bouclier, blesse les ennemis et les projette brièvement en l'air. Son engagement et son principal contrôle.",
      },
      {
        type: "Skill 2",
        name: "Valkyrie Slash",
        description:
          "Une ruée suivie d'un coup qui ralentit brièvement. Pas de recharge de base, mais deux orbes par lancer, et des dégâts réduits contre les monstres.",
      },
      {
        type: "Ultimate",
        name: "Valkyrie Descent",
        description:
          "Plonge sur une zone en étant insensible aux contrôles, blesse et ralentit les ennemis touchés, puis entre en état de Valkyrie : vitesse accrue et attaques de base à dégâts de zone pendant plusieurs secondes.",
      },
    ],
    strengths: [
      "Une compétence 2 sans recharge de base",
      "Bouclier et projection sur la compétence 1",
      "Attaques de base à dégâts de zone sous l'ultime",
      "Fort taux de victoire mesuré dans les parties courtes",
    ],
    weaknesses: [
      "Taux de victoire mesuré sous la moyenne de l'Épique à l'Honneur mythique",
      "Rendement en baisse dans les parties longues",
      "En difficulté face à Minsitthar, Phoveus et Baxia selon les mesures",
    ],
    strongAgainst: ["masha", "yve", "lolita", "ling", "kagura"],
    weakAgainst: ["minsitthar", "phoveus", "baxia", "edith", "franco"],
    builds: [
      {
        name: "EXP lane",
        context:
          "Le build le plus joué en EXP lane : Golden Staff apporte attaque et vitesse d'attaque et accélère encore une attaque de base sur trois, War Axe cumule de l'attaque en combat avec du vol de vie, Rose Gold Meteor ajoute vol de vie et un bouclier quand ses PV tombent bas. Endless Battle à la place de Rose Gold Meteor est presque aussi jouée.",
        items: ["Golden Staff", "War Axe", "Rose Gold Meteor"],
        emblem: "Emblème de combattant",
        talent: "War Cry",
        spell: "Vengeance",
      },
      {
        name: "Jungle",
        context:
          "En jungle, Corrosion Scythe passe en premier pour la vitesse d'attaque et le ralentissement des attaques de base, avec Endless Battle, qui renforce l'attaque suivant chaque compétence : la version la plus jouée à cette position, avec l'emblème de tireur.",
        items: ["Corrosion Scythe", "War Axe", "Endless Battle"],
        emblem: "Emblème de tireur",
        talent: "Weakness Finder",
        spell: "Retribution",
      },
    ],
  },
  {
    slug: "aulus",
    summary:
      "Combattant simple à prendre en main : chaque compétence qui touche renforce ses attaques de base, et son ultime frappe à répétition autour de lui.",
    analysis:
      "Aulus combat par vagues de coups de hache. Chaque compétence qui inflige des dégâts lui donne quelques secondes d'attaques de base renforcées : elles frappent en ligne, le soignent, ralentissent légèrement et allongent un peu sa portée. Sa compétence 1 retire ses ralentissements et l'accélère ; s'il n'est pas contrôlé dans les deux secondes, il devient insensible aux contrôles. Sa compétence 2 frappe en éventail et étourdit brièvement, puis se relance en bond. L'ultime enchaîne quatre coups autour de lui puis un large coup final, en réduisant les dégâts qu'il subit.\n\n" +
      "Ses chiffres mesurés sont au-dessus de la moyenne, surtout dans les parties courtes : son taux de victoire est le plus haut avant la douzième minute et redescend vers la moyenne au-delà de la vingtième. Son taux de bannissement, qui monte avec le rang, a fortement baissé sur les trente derniers jours. Le patch 2.2.16a a affaibli ses attaques renforcées et allongé la recharge de sa compétence 1, tout en relevant les dégâts de base de son ultime. Les mesures le placent en difficulté face à Alice, Floryn, Estes, Yve et Zhuxin.",
    skills: [
      {
        type: "Passive",
        name: "Fighting Spirit",
        description:
          "Chaque compétence qui inflige des dégâts lui donne quelques secondes d'attaques de base renforcées : un coup de hache en ligne qui le soigne, ralentit légèrement, et lui donne un peu de portée et de vitesse d'attaque. Plus fortes encore contre les monstres.",
      },
      {
        type: "Skill 1",
        name: "Aulus, Charge!",
        description:
          "Retire ses ralentissements et l'accélère quelques secondes. S'il ne subit pas de contrôle majeur dans les deux secondes, il entre en rage et devient insensible aux contrôles : de quoi traverser une ligne adverse.",
      },
      {
        type: "Skill 2",
        name: "The Power of Axe",
        description:
          "Un coup de hache en éventail qui étourdit brièvement les ennemis. Relancé, il bondit vers l'avant et frappe le sol autour de lui.",
      },
      {
        type: "Ultimate",
        name: "Cleaving Axe",
        description:
          "Frappe quatre fois les ennemis autour de lui, puis lâche un coup plus large après une courte charge. Pendant la durée, il subit moins de dégâts et gagne un peu de vitesse à chaque coup.",
      },
    ],
    strengths: [
      "Taux de victoire mesuré au-dessus de la moyenne, surtout en début de partie",
      "Insensible aux contrôles grâce à la compétence 1, s'il n'est pas contrôlé à temps",
      "Attaques renforcées qui le soignent",
      "Kit simple, sans ressource à gérer",
    ],
    weaknesses: [
      "Rendement mesuré qui redescend vers la moyenne dans les parties longues",
      "Un contrôle subi dans les deux premières secondes le prive de son insensibilité",
      "En difficulté face à Alice, Floryn et Estes selon les mesures",
    ],
    strongAgainst: ["gloo", "minsitthar", "tigreal", "natalia", "sun"],
    weakAgainst: ["alice", "floryn", "estes", "yve", "zhuxin"],
    builds: [
      {
        name: "Jungle",
        context:
          "Le build le plus joué en jungle : War Axe apporte attaque cumulée, PV et vol de vie, Brute Force Breastplate PV, armure et réduction de recharge, Malefic Roar la pénétration physique. Le même trio avec l'emblème d'assassin est deux fois moins joué, avec un taux de victoire mesuré plus élevé.",
        items: ["War Axe", "Brute Force Breastplate", "Malefic Roar"],
        emblem: "Emblème de combattant",
        talent: "Killing Spree",
        spell: "Retribution",
      },
      {
        name: "EXP lane",
        context:
          "Les mêmes objets en EXP lane, avec l'emblème d'assassin et le sort Vengeance : la version la plus jouée à cette position.",
        items: ["War Axe", "Brute Force Breastplate", "Malefic Roar"],
        emblem: "Emblème d'assassin",
        talent: "Killing Spree",
        spell: "Vengeance",
      },
    ],
  },
  {
    slug: "alucard",
    summary:
      "Combattant de jungle qui bondit sur sa cible après chaque compétence, et dont l'ultime lui donne du vol de vie permanent et divise ses recharges.",
    analysis:
      "Alucard alterne compétences et attaques de base : après chaque compétence, sa prochaine attaque le fait bondir sur la cible. Sa compétence 1 le fait sauter sur une zone en ralentissant les ennemis, sa compétence 2 frappe tout autour de lui. Son ultime lui donne en permanence du vol de vie hybride ; lancé, il ralentit les ennemis de la zone et réduit leurs résistances, renforce les siennes pour chaque héros touché et divise par deux la recharge de ses autres compétences pendant quelques secondes, avant une relance qui envoie une onde de choc vers l'avant.\n\n" +
      "C'est l'un des héros les moins bannis, pour des chiffres mesurés légèrement sous la moyenne à tous les rangs. Il est faible dans les parties courtes et ne dépasse la moyenne qu'à partir de la quatorzième minute, sans grand écart ensuite. Les mesures le placent en difficulté face à Fredrinn, Phoveus, Khufra, Barats et Thamuz, et à l'aise face à Natalia, Sun, Mathilda et Saber.",
    skills: [
      {
        type: "Passive",
        name: "Pursuit",
        description:
          "Après chaque compétence lancée, sa prochaine attaque de base le fait bondir sur la cible avec des dégâts supplémentaires. Il frappe aussi plus fort les monstres.",
      },
      {
        type: "Skill 1",
        name: "Groundsplitter",
        description:
          "Saute sur une zone, blesse et ralentit les ennemis touchés : son engagement, suivi d'une attaque de base pour profiter du passif.",
      },
      {
        type: "Skill 2",
        name: "Whirling Smash",
        description:
          "Un coup tournoyant qui blesse tous les ennemis autour de lui, à recharge courte.",
      },
      {
        type: "Ultimate",
        name: "Fission Wave",
        description:
          "En permanence, lui donne du vol de vie hybride. Lancé, ralentit les ennemis d'une zone et réduit leurs résistances, augmente les siennes pour chaque héros touché et divise par deux la recharge de ses autres compétences quelques secondes ; relancé, envoie une onde de choc vers l'avant.",
      },
    ],
    strengths: [
      "Vol de vie hybride permanent grâce à l'ultime",
      "Recharges divisées par deux sous l'ultime",
      "Taux de victoire mesuré au-dessus de la moyenne dans les parties longues",
      "Bondit sur sa cible après chaque compétence",
    ],
    weaknesses: [
      "Faible dans les parties courtes selon les mesures",
      "Aucun contrôle au-delà de ralentissements",
      "En difficulté face à Fredrinn, Phoveus et Khufra selon les mesures",
    ],
    strongAgainst: ["natalia", "sun", "mathilda", "saber", "harith"],
    weakAgainst: ["fredrinn", "phoveus", "khufra", "barats", "thamuz"],
    builds: [
      {
        name: "Jungle",
        context:
          "Le build le plus joué en jungle : War Axe cumule de l'attaque en combat, Endless Battle renforce l'attaque de base qui suit chaque compétence, ce qui colle au rythme de son passif, et Blade of Despair apporte la plus grosse attaque physique, renforcée contre une cible sous la moitié de ses PV.",
        items: ["War Axe", "Endless Battle", "Blade of Despair"],
        emblem: "Emblème d'assassin",
        talent: "Temporal Reign",
        spell: "Retribution",
      },
    ],
  },
  {
    slug: "aldous",
    summary:
      "Combattant qui cumule des charges permanentes en achevant des unités, et dont l'ultime révèle tous les héros ennemis avant de le lancer sur l'un d'eux.",
    analysis:
      "Aldous se construit sur la durée. Sa compétence 1 renforce sa prochaine attaque de base, et chaque unité achevée ou héros touché avec cette attaque lui donne des charges permanentes qui augmentent ses dégâts, jusqu'à mille ; il en gagne aussi quand ses alliés achèvent des unités près de lui. Sa compétence 2 le met en posture défensive, avec une réduction des dégâts subis, puis inflige des dégâts autour de lui et les étourdit, d'autant plus longtemps que la posture a duré. L'ultime lui donne la vision de tous les héros ennemis quelques secondes, puis le fait foncer sur l'un d'eux pour le repousser, en interrompant un éventuel retour à la base.\n\n" +
      "Aucun héros n'a un écart aussi marqué selon la durée de partie : très bas dans les parties de moins de douze minutes, son taux de victoire mesuré approche soixante pour cent à partir de la dix-huitième. Tous rangs confondus, il est au-dessus de la moyenne et en hausse sur trente jours, pour un bannissement presque nul. Le patch 2.2.23 a raccourci la recharge de sa compétence 2 et augmenté sa réduction des dégâts en fin de partie. Les mesures le placent en difficulté face à Esmeralda, Karina, Cyclops, Estes et Popol and Kupa.",
    skills: [
      {
        type: "Passive",
        name: "Contract: Transform",
        description:
          "Toutes les quelques secondes, sa prochaine attaque de base lui donne un bouclier et une courte accélération.",
      },
      {
        type: "Skill 1",
        name: "Contract: Soul Steal",
        description:
          "Renforce sa prochaine attaque de base, qui frappe beaucoup plus fort les sbires et les monstres. Achever une unité ou toucher un héros avec elle donne des charges permanentes qui augmentent ses dégâts : le cœur de sa montée en puissance.",
      },
      {
        type: "Skill 2",
        name: "Contract: Explosion",
        description:
          "Une posture défensive qui réduit les dégâts subis jusqu'à deux secondes, puis blesse les ennemis proches et les étourdit, d'autant plus longtemps que la posture a été tenue.",
      },
      {
        type: "Ultimate",
        name: "Contract: Chase Fate",
        description:
          "Donne la vision de tous les héros ennemis quelques secondes. Relancé, il fonce sur l'un d'eux, le blesse selon ses PV et le repousse ; la ruée interrompt un retour à la base.",
      },
    ],
    strengths: [
      "Des charges permanentes qui augmentent ses dégâts toute la partie",
      "Taux de victoire mesuré proche de soixante pour cent dans les parties longues",
      "Un ultime qui révèle tous les héros ennemis et interrompt un retour à la base",
      "Rarement banni",
    ],
    weaknesses: [
      "Très faible dans les parties courtes selon les mesures",
      "Dépend des charges accumulées avant les combats",
      "En difficulté face à Esmeralda, Karina et Cyclops selon les mesures",
    ],
    strongAgainst: ["uranus", "xavier", "helcurt", "hanzo", "x-borg"],
    weakAgainst: ["esmeralda", "karina", "cyclops", "estes", "popol-and-kupa"],
    builds: [
      {
        name: "EXP lane",
        context:
          "Le build le plus joué en EXP lane, de loin : Blade of the Heptaseas renforce la première attaque après quelques secondes hors combat, Endless Battle l'attaque qui suit chaque compétence, et Malefic Roar ajoute la pénétration physique. Il est associé à l'emblème d'assassin, aux talents Wilderness Blessing et Quantum Charge et au sort Flicker.",
        items: ["Blade of the Heptaseas", "Endless Battle", "Malefic Roar"],
        emblem: "Emblème d'assassin",
        talent: "Quantum Charge",
        spell: "Flicker",
      },
      {
        name: "Version défensive",
        context:
          "Une version défensive, bien moins jouée, avec un taux de victoire mesuré plus élevé : Thunder Belt et Dominance Ice apportent PV et résistances, et Dominance Ice réduit aussi les soins et boucliers des ennemis proches.",
        items: ["Thunder Belt", "Dominance Ice", "Endless Battle"],
        emblem: "Emblème d'assassin",
        talent: "Quantum Charge",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "badang",
    summary:
      "Combattant d'obstacles : il crée un mur derrière sa cible et l'y projette pour l'étourdir, et se joue aussi bien en roam qu'en EXP lane.",
    analysis:
      "Badang joue avec les obstacles. Après quatre attaques de base, la suivante repousse, et les souffles de ses compétences repoussent directement : un ennemi projeté contre un obstacle est étourdi. Sa compétence 2 le fait foncer en gagnant un bouclier ; s'il touche un héros, il s'arrête et crée un obstacle juste derrière lui. Sa compétence 1, sur deux charges, envoie un souffle qui blesse, ralentit et repousse, de quoi plaquer la cible contre ce mur. L'ultime enchaîne une rafale de coups de poing dans une direction en le rendant insensible aux contrôles.\n\n" +
      "Ses chiffres mesurés sont dans la moyenne à tous les rangs, avec un léger avantage dans les parties courtes, et il est assez souvent choisi. Joué en roam comme en EXP lane, il prend surtout des objets de défense : PV, armure et résistances plutôt que dégâts. Les mesures le placent en difficulté face à Karina, Lolita, Esmeralda, Khufra et Phoveus, et à l'aise face à Fanny, Sun et Zilong.",
    skills: [
      {
        type: "Passive",
        name: "Chivalry Fist",
        description:
          "Après quatre attaques de base, la suivante blesse davantage et repousse ; un ennemi projeté contre un obstacle est étourdi. Les souffles de ses compétences déclenchent directement cet effet, et celui de l'ultime étourdit plus longtemps.",
      },
      {
        type: "Skill 1",
        name: "Fist Wind",
        description:
          "Un souffle de poing qui blesse, ralentit et repousse les ennemis, et explose contre un obstacle. Deux charges, à garder pour plaquer la cible contre l'obstacle de la compétence 2.",
      },
      {
        type: "Skill 2",
        name: "Fist Break",
        description:
          "Fonce dans une direction en gagnant un bouclier. S'il touche un héros, il s'arrête, le repousse légèrement et crée un obstacle derrière lui pendant quelques secondes ; relancée, elle retire l'obstacle.",
      },
      {
        type: "Ultimate",
        name: "Fist Crack",
        description:
          "Une rafale de coups de poing dans une direction, insensible aux contrôles pendant la durée. Les souffles explosent contre les obstacles : lancée sur des ennemis coincés contre un mur, elle les y frappe à répétition.",
      },
    ],
    strengths: [
      "Étourdissements répétés contre ses propres obstacles",
      "Bouclier sur la compétence 2",
      "Insensible aux contrôles pendant l'ultime",
      "Jouable en roam comme en EXP lane",
    ],
    weaknesses: [
      "Taux de victoire mesuré dans la moyenne, sans point fort marqué",
      "Des contrôles qui demandent un obstacle bien placé",
      "En difficulté face à Karina, Lolita et Esmeralda selon les mesures",
    ],
    strongAgainst: ["fanny", "sun", "zilong", "hayabusa", "joy"],
    weakAgainst: ["karina", "lolita", "esmeralda", "khufra", "phoveus"],
    builds: [
      {
        name: "Roam",
        context:
          "Le build le plus joué en roam : Thunder Belt pour les PV, les résistances et le ralentissement de ses attaques, Dominance Ice pour les résistances et la réduction des soins des ennemis proches, Chastise Pauldron pour réduire la vitesse d'attaque de ceux qui le frappent. Antique Cuirass à la place de Chastise Pauldron est presque aussi jouée.",
        items: ["Thunder Belt", "Dominance Ice", "Chastise Pauldron"],
        emblem: "Emblème de soutien",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
      {
        name: "EXP lane",
        context:
          "Les mêmes objets en EXP lane : c'est aussi la version la plus jouée à cette position.",
        items: ["Thunder Belt", "Dominance Ice", "Chastise Pauldron"],
        emblem: "Emblème de soutien",
        talent: "Concussive Blast",
        spell: "Flicker",
      },
    ],
  },
  {
    slug: "alpha",
    summary:
      "Combattant à la difficulté officielle la plus basse, qui se bat avec un drone : chaque compétence fait intervenir Beta, dont les tirs infligent des dégâts bruts.",
    analysis:
      "Alpha se bat en duo avec Beta. Chaque compétence lancée fait intervenir le drone, qui inflige des dégâts bruts ; un ennemi touché deux fois par Beta est verrouillé, et chaque coup d'Alpha sur lui déclenche alors un laser qui le ralentit fortement. Sa compétence 1 envoie une onde qui ralentit, sa compétence 2 frappe en éventail après un court délai et le soigne sur le premier ennemi touché. L'ultime envoie Beta étourdir une zone, puis Alpha y bondit en projetant en l'air les ennemis sur son passage pour les emporter jusqu'au point d'impact.\n\n" +
      "Ses chiffres mesurés sont un peu sous la moyenne, sans écart notable selon la durée de partie. Il est surtout joué aux rangs bas : son taux de sélection baisse à chaque rang de l'Épique à la Gloire mythique, et il est très rarement banni. Le patch 2.2.16 a renforcé le soin de sa compétence 2. Les mesures le placent en difficulté face à Benedetta, X.Borg, Valir, Lylia et Wanwan.",
    skills: [
      {
        type: "Passive",
        name: "Beta, Advance!",
        description:
          "Chaque compétence fait attaquer Beta. Un ennemi touché deux fois par le drone est verrouillé : chaque fois qu'Alpha le blesse, Beta tire un laser qui inflige des dégâts bruts et le ralentit fortement un instant.",
      },
      {
        type: "Skill 1",
        name: "Rotary Impact",
        description:
          "Une onde d'énergie qui blesse et ralentit les ennemis sur sa trajectoire, suivie d'une rafale de Beta sur le même trajet.",
      },
      {
        type: "Skill 2",
        name: "Force Swing",
        description:
          "Après un court délai, un coup en éventail ; le premier ennemi touché le soigne, les suivants de moins en moins. Beta mitraille ensuite la zone.",
      },
      {
        type: "Ultimate",
        name: "Spear of Alpha",
        description:
          "Beta plonge sur la zone choisie et étourdit les ennemis touchés ; Alpha bondit à sa suite en projetant en l'air ceux qu'il croise, les emporte jusqu'au point d'impact et les ralentit en retombant.",
      },
    ],
    strengths: [
      "Dégâts bruts de Beta à chaque compétence",
      "Un ultime qui étourdit et regroupe les ennemis",
      "Soin sur la compétence 2",
      "Difficulté officielle au plus bas de l'échelle",
    ],
    weaknesses: [
      "Taux de victoire mesuré un peu sous la moyenne",
      "Peu joué dans les rangs élevés",
      "En difficulté face à Benedetta, X.Borg et Valir selon les mesures",
    ],
    strongAgainst: ["phoveus", "saber", "odette", "barats", "fredrinn"],
    weakAgainst: ["benedetta", "x-borg", "valir", "lylia", "wanwan"],
    builds: [
      {
        name: "Jungle",
        context:
          "Le build le plus joué en jungle : War Axe cumule de l'attaque en combat avec PV et vol de vie, Sky Piercer apporte attaque, vitesse et une exécution des héros tombés très bas, Queen's Wings de la survie quand ses PV baissent.",
        items: ["War Axe", "Sky Piercer", "Queen's Wings"],
        emblem: "Emblème de combattant",
        talent: "Impure Rage",
        spell: "Retribution",
      },
      {
        name: "EXP lane",
        context:
          "Les trois mêmes objets en EXP lane, avec le sort Vengeance : c'est la version la plus jouée à cette position.",
        items: ["War Axe", "Sky Piercer", "Queen's Wings"],
        emblem: "Emblème de combattant",
        talent: "Impure Rage",
        spell: "Vengeance",
      },
    ],
  },
];
