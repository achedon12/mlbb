/** Une entree de la recherche globale. */
export interface EntreeRecherche {
  type: "heros" | "objet" | "patch" | "page";
  titre: string;
  /** Precision affichee sous le titre : epithete, categorie, sous-titre. */
  detail?: string;
  /** Adresse sans langue ; le lien ajoute celle de la page. */
  href: string;
  image?: string | null;
}

/** Ordre des groupes de resultats. */
export const ORDRE_TYPES: EntreeRecherche["type"][] = ["heros", "objet", "patch", "page"];
