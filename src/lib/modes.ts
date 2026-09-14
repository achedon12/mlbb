/**
 * Accent colour of each game mode. The editorial tagline and summary live in
 * the translation catalogue (`modeSheet.<slug>`), so they exist in every
 * language; only what does not get translated is kept here.
 */

/** Two shades, darkest to lightest, for the accent gradient. */
export const ACCENTS_MODES: Record<string, [string, string]> = {
  classic: ["#1b4f96", "#4da3ff"],
  ranked: ["#8a6415", "#f5c451"],
  brawl: ["#8f2626", "#ff6b6b"],
  "vs-ai": ["#146b62", "#4de0d0"],
  custom: ["#4b3a99", "#a98bff"],
  "arcade-mode": ["#8f2f74", "#ff77c2"],
};

export const ACCENT_MODE_DEFAULT: [string, string] = ["#1c2742", "#2a3758"];
