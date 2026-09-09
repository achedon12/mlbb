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
export interface Rarete {
  nom: string;
  couleur: string;
  halo: string;
  /** Rang, du plus commun au plus rare. Sert au tri et a la legende. */
  rang: number;
}

export const RARETES: Record<string, Rarete> = {
  Common: { nom: "Commun", couleur: "#9aa7c2", halo: "rgba(154,167,194,0.3)", rang: 1 },
  Exquisite: { nom: "Exquis", couleur: "#4da3ff", halo: "rgba(77,163,255,0.35)", rang: 2 },
  Exceptional: { nom: "Exceptionnel", couleur: "#3ddc97", halo: "rgba(61,220,151,0.35)", rang: 3 },
  Deluxe: { nom: "Deluxe", couleur: "#b06bff", halo: "rgba(176,107,255,0.4)", rang: 4 },
  Grand: { nom: "Grandiose", couleur: "#f5c451", halo: "rgba(245,196,81,0.45)", rang: 5 },
  Supreme: { nom: "Supreme", couleur: "#ff4d6d", halo: "rgba(255,77,109,0.5)", rang: 6 },
};

/** Le skin d'origine n'a pas de rarete : il n'a jamais ete achete. */
export const RARETE_ORIGINE: Rarete = {
  nom: "Origine",
  couleur: "#3a4767",
  halo: "rgba(58,71,103,0.4)",
  rang: 0,
};

export function rarete(nom: string | null | undefined): Rarete {
  if (!nom) return RARETE_ORIGINE;
  return (
    RARETES[nom] ?? {
      // Une rarete inconnue garde son libelle d'origine plutot que d'etre
      // fondue dans un fourre-tout : c'est le signal qu'il faut la traduire.
      nom,
      couleur: RARETE_ORIGINE.couleur,
      halo: RARETE_ORIGINE.halo,
      rang: 0,
    }
  );
}

/** Raretes presentes dans une liste de skins, triees du plus commun au plus rare. */
export function raretesPresentes(raretesBrutes: (string | null)[]): Rarete[] {
  const vues = new Map<string, Rarete>();
  for (const brute of raretesBrutes) {
    const r = rarete(brute);
    if (!vues.has(r.nom)) vues.set(r.nom, r);
  }
  return [...vues.values()].sort((a, b) => a.rang - b.rang);
}
