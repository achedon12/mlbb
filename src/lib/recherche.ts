/** Une entree de la recherche globale. */
export interface EntreeRecherche {
  type: "heros" | "objet" | "competence" | "skin" | "patch" | "page";
  titre: string;
  /** Precision affichee sous le titre : epithete, categorie, heros, sous-titre. */
  detail?: string;
  /** Adresse sans langue ; le lien ajoute celle de la page. */
  href: string;
  image?: string | null;
}

/**
 * Ordre des groupes de resultats. Les heros d'abord : le nom d'un heros figure
 * aussi dans le detail de ses skins et competences, qu'il ne doit pas
 * preceder.
 */
export const ORDRE_TYPES: EntreeRecherche["type"][] = ["heros", "objet", "competence", "skin", "patch", "page"];
