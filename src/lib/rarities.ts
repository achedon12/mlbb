/**
 * Raretes des skins.
 *
 * Le jeu encadre chaque skin d'une couleur qui dit immediatement sa rarete :
 * on reconnait un skin Supreme a son contour avant d'avoir lu son nom. On
 * reprend ce code.
 *
 * Les six paliers sont ceux employes par le jeu, du plus commun au plus rare.
 * Les couleurs sont ecrites en dur plutot qu'en classes Tailwind : elles
 * servent a la fois a une bordure et a une ombre portee, et une classe ne peut
 * pas etre composee dynamiquement sans casser la purge de Tailwind.
 */
export interface Rarity {
  /** Clef anglaise d'origine, pour la traduction. */
  key: string;
  name: string;
  color: string;
  halo: string;
  /** Rang, du plus commun au plus rare. Sert au tri et a la legende. */
  rank: number;
}

export const RARITIES: Record<string, Rarity> = {
  Common: { key: "Common", name: "Commun", color: "#9aa7c2", halo: "rgba(154,167,194,0.3)", rank: 1 },
  Exquisite: { key: "Exquisite", name: "Exquis", color: "#4da3ff", halo: "rgba(77,163,255,0.35)", rank: 2 },
  Exceptional: { key: "Exceptional", name: "Exceptionnel", color: "#3ddc97", halo: "rgba(61,220,151,0.35)", rank: 3 },
  Deluxe: { key: "Deluxe", name: "Deluxe", color: "#b06bff", halo: "rgba(176,107,255,0.4)", rank: 4 },
  Grand: { key: "Grand", name: "Grandiose", color: "#f5c451", halo: "rgba(245,196,81,0.45)", rank: 5 },
  Supreme: { key: "Supreme", name: "Supreme", color: "#ff4d6d", halo: "rgba(255,77,109,0.5)", rank: 6 },
};

/** Le skin d'origine n'a pas de rarete : il n'a jamais ete achete. */
export const RARITY_ORIGIN: Rarity = {
  key: "origin",
  name: "Origine",
  color: "#3a4767",
  halo: "rgba(58,71,103,0.4)",
  rank: 0,
};

export function rarity(name: string | null | undefined): Rarity {
  if (!name) return RARITY_ORIGIN;
  return (
    RARITIES[name] ?? {
      // Une rarete inconnue garde son libelle d'origine plutot que d'etre
      // fondue dans un fourre-tout : c'est le signal qu'il faut la traduire.
      name,
      color: RARITY_ORIGIN.color,
      halo: RARITY_ORIGIN.halo,
      rank: 0,
    }
  );
}

/** Raretes presentes dans une liste de skins, triees du plus commun au plus rare. */
export function presentRarities(raritiesRaw: (string | null)[]): Rarity[] {
  const views = new Map<string, Rarity>();
  for (const raw of raritiesRaw) {
    const r = rarity(raw);
    if (!views.has(r.name)) views.set(r.name, r);
  }
  return [...views.values()].sort((a, b) => a.rank - b.rank);
}
