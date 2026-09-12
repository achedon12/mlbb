import type { AnalyseHeros } from "@/lib/types";

/**
 * Modele d'analyse de heros.
 *
 * A recopier dans le fichier du role du heros (`src/data/heros/tanks.ts`,
 * `fighters.ts`, `assassins.ts`, `mages.ts`, `marksmen.ts` ou `supports.ts`),
 * a remplir, puis a debarrasser de ses commentaires. Il n'est importe nulle
 * part : `npm run typecheck` le verifie seulement, ce qui le garde conforme au
 * type `AnalyseHeros`.
 *
 * Le texte affiche s'ecrit en francais, avec ses accents. Les noms d'objets,
 * de competences, de talents et de sorts restent en anglais, comme en jeu.
 * Rien ne se recopie d'un autre site. Guide complet : /fr/contribute.
 */
export const modele: AnalyseHeros = {
  // Slug exact, tel qu'il figure dans src/data/jeu/heros.json.
  slug: "slug-du-heros",

  // Une phrase : ce que le heros a de singulier. Reprise en meta description.
  summary: "Une phrase qui dit ce que le héros a de singulier.",

  // Deux paragraphes separes par une ligne vide : ce que le heros fait
  // reellement, puis ses limites. Des faits observables, pas de superlatifs.
  analysis:
    "Premier paragraphe : le plan de jeu du héros, ce qu'il fait réellement en partie.\n\n" +
    "Second paragraphe : ses limites, et ce qui les expose.",

  // Ordre du jeu : passif, competence 1, competence 2, ultime. C'est l'ordre
  // qui apparie chaque description a la competence du wiki, dont le nom est
  // celui qui s'affiche.
  skills: [
    {
      type: "Passif",
      // Nom anglais, comme en jeu.
      name: "Passive Name",
      // L'effet et son usage, sans valeurs de degats : elles changent presque
      // a chaque patch. Ni recharge ni cout pour un passif.
      description: "Ce que le passif change à la façon de jouer le héros.",
    },
    {
      type: "Competence 1",
      name: "First Skill Name",
      description: "Ce que la compétence permet, et quand s'en servir.",
      // Recharge par niveau, en secondes.
      cooldown: [8, 7.5, 7, 6.5, 6, 5.5],
      // Cout par niveau ; a omettre si le heros n'utilise pas de mana.
      cost: [60, 65, 70, 75, 80, 85],
    },
    {
      type: "Competence 2",
      name: "Second Skill Name",
      description: "Ce que la compétence permet, et ce qui la rend dangereuse ou fragile.",
      cooldown: [12, 11, 10, 9, 8, 7],
      cost: [70, 75, 80, 85, 90, 95],
    },
    {
      type: "Ultime",
      name: "Ultimate Name",
      description: "Ce que l'ultime change à un combat, et le bon moment pour le lancer.",
      cooldown: [40, 35, 30],
      cost: [120, 140, 160],
    },
  ],

  // Trois a cinq points courts, observables en partie.
  strengths: ["Une force concrète, visible en partie"],
  // Trois a cinq points courts, avec ce qui les exploite.
  weaknesses: ["Une faiblesse concrète, et ce qui la punit"],

  // Des slugs, pas des noms : heros face auxquels il est a l'aise…
  strongAgainst: ["slug-adverse"],
  // … et heros qui le mettent en difficulte.
  weakAgainst: ["autre-slug"],

  builds: [
    {
      name: "Nom court du build",
      // Quand choisir ce build : un build sans contexte n'apprend rien.
      context: "La situation dans laquelle ce build s'impose, et ce qu'il sacrifie.",
      // Six objets, noms anglais du jeu, dans l'ordre d'achat.
      items: ["Item One", "Item Two", "Item Three", "Item Four", "Item Five", "Item Six"],
      // Emblemes nommes comme dans les analyses existantes.
      emblem: "Emblème de mage",
      // Talent principal et sort de combat, noms anglais.
      talent: "Lethal Ignition",
      spell: "Flicker",
    },
  ],
};
