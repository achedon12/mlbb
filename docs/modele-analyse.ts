import type { HeroAnalysis } from "@/lib/types";

/**
 * Hero analysis template.
 *
 * Copy it into the file of the hero's role (`src/data/heroes/tanks.ts`,
 * `fighters.ts`, `assassins.ts`, `mages.ts`, `marksmen.ts` or `supports.ts`),
 * fill it in, then strip its comments. It is imported nowhere:
 * `npm run typecheck` only checks it, which keeps it in line with the
 * `HeroAnalysis` type.
 *
 * Displayed text is written in French, with its accents. Item, skill, talent
 * and spell names stay in English, as in the game.
 * Nothing is copied from another site. Full guide: /fr/contribute.
 */
export const template: HeroAnalysis = {
  // Exact slug, as it appears in src/data/game/heroes.json.
  slug: "slug-du-heros",

  // One sentence: what sets the hero apart. Reused as the meta description.
  summary: "Une phrase qui dit ce que le héros a de singulier.",

  // Two paragraphs separated by a blank line: what the hero actually does,
  // then its limits. Observable facts, no superlatives.
  analysis:
    "Premier paragraphe : le plan de jeu du héros, ce qu'il fait réellement en partie.\n\n" +
    "Second paragraphe : ses limites, et ce qui les expose.",

  // Game order: passive, skill 1, skill 2, ultimate. The order is what pairs
  // each description with the wiki skill, whose name is the one that is
  // displayed.
  skills: [
    {
      type: "Passive",
      // English name, as in the game.
      name: "Passive Name",
      // The effect and how to use it, without damage values: they change
      // almost every patch. No cooldown or cost for a passive.
      description: "Ce que le passif change à la façon de jouer le héros.",
    },
    {
      type: "Skill 1",
      name: "First Skill Name",
      description: "Ce que la compétence permet, et quand s'en servir.",
      // Cooldown per level, in seconds.
      cooldown: [8, 7.5, 7, 6.5, 6, 5.5],
      // Cost per level; omit it if the hero does not use mana.
      cost: [60, 65, 70, 75, 80, 85],
    },
    {
      type: "Skill 2",
      name: "Second Skill Name",
      description: "Ce que la compétence permet, et ce qui la rend dangereuse ou fragile.",
      cooldown: [12, 11, 10, 9, 8, 7],
      cost: [70, 75, 80, 85, 90, 95],
    },
    {
      type: "Ultimate",
      name: "Ultimate Name",
      description: "Ce que l'ultime change à un combat, et le bon moment pour le lancer.",
      cooldown: [40, 35, 30],
      cost: [120, 140, 160],
    },
  ],

  // Three to five short points, observable in a match.
  strengths: ["Une force concrète, visible en partie"],
  // Three to five short points, with what exploits them.
  weaknesses: ["Une faiblesse concrète, et ce qui la punit"],

  // Slugs, not names: heroes it is comfortable against…
  strongAgainst: ["slug-adverse"],
  // … and heroes that give it trouble.
  weakAgainst: ["autre-slug"],

  builds: [
    {
      name: "Nom court du build",
      // When to pick this build: a build without context teaches nothing.
      context: "La situation dans laquelle ce build s'impose, et ce qu'il sacrifie.",
      // Six items, English in-game names, in purchase order.
      items: ["Item One", "Item Two", "Item Three", "Item Four", "Item Five", "Item Six"],
      // Emblems named as in the existing analyses.
      emblem: "Emblème de mage",
      // Main talent and battle spell, English names.
      talent: "Lethal Ignition",
      spell: "Flicker",
    },
  ],
};
