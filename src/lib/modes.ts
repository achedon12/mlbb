/**
 * Couleur d'accent de chaque mode de jeu. L'accroche et le résumé éditoriaux
 * vivent dans le catalogue de traductions (`modeSheet.<slug>`), pour exister
 * dans chaque langue ; ici on ne garde que ce qui ne se traduit pas.
 */

/** Deux teintes, du plus sombre au plus clair, pour le dégradé d'accent. */
export const ACCENTS_MODES: Record<string, [string, string]> = {
  classic: ["#1b4f96", "#4da3ff"],
  ranked: ["#8a6415", "#f5c451"],
  brawl: ["#8f2626", "#ff6b6b"],
  "vs-ai": ["#146b62", "#4de0d0"],
  custom: ["#4b3a99", "#a98bff"],
  "arcade-mode": ["#8f2f74", "#ff77c2"],
};

export const ACCENT_MODE_DEFAUT: [string, string] = ["#1c2742", "#2a3758"];
