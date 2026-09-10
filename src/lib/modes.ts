/**
 * Habillage editorial des modes de jeu, ecrit a la main : accroche, resume et
 * couleur d'accent propres a chaque mode. Le catalogue synchronise (`modes`)
 * fournit le nom, le visuel et les sections detaillees ; ceci vient par-dessus.
 */
export type FicheMode = {
  accroche: string;
  texte: string;
  /** Deux teintes, du plus sombre au plus clair, pour le degrade d'accent. */
  accent: [string, string];
};

export const FICHES_MODES: Record<string, FicheMode> = {
  classic: {
    accroche: "Le 5 contre 5 de reference",
    texte:
      "Deux equipes de cinq, trois voies, un Nexus a detruire. Le mode fondateur, sans enjeu de classement : l'ideal pour decouvrir un heros ou s'echauffer.",
    accent: ["#1b4f96", "#4da3ff"],
  },
  ranked: {
    accroche: "Grimpez les rangs",
    texte:
      "La file competitive. Chaque victoire rapporte des etoiles et fait monter d'Avertissement jusqu'a Gloire Mythique, avec bannissements et selection en draft a partir d'Epique.",
    accent: ["#8a6415", "#f5c451"],
  },
  brawl: {
    accroche: "Une seule voie, tout de suite",
    texte:
      "Carte unique a une lane, heros tire au sort. Des parties courtes et nerveuses, sans jungle ni longue phase de retour a la base.",
    accent: ["#8f2626", "#ff6b6b"],
  },
  "vs-ai": {
    accroche: "Affrontez l'ordinateur",
    texte:
      "Des adversaires controles par l'IA, a difficulte reglable. Pour tester un build ou apprivoiser un nouveau heros sans la pression du classement.",
    accent: ["#146b62", "#4de0d0"],
  },
  custom: {
    accroche: "Vos regles",
    texte:
      "Creez une partie sur mesure : composition des equipes, spectateurs, carte et parametres libres. Le mode des tournois et des matchs entre amis.",
    accent: ["#4b3a99", "#a98bff"],
  },
  "arcade-mode": {
    accroche: "Les modes ephemeres",
    texte:
      "Une rotation de modes speciaux et festifs — Chasse Magique, Survie et autres variantes — proposes pour une duree limitee.",
    accent: ["#8f2f74", "#ff77c2"],
  },
};

export const ACCENT_MODE_DEFAUT: [string, string] = ["#1c2742", "#2a3758"];
