/**
 * Favoris.
 *
 * Ils vivent dans le navigateur, plus dans une base : le site n'a plus de
 * compte a lui, l'identite est celle du jeu. Un favori est donc une commodite
 * locale — la liste des heros qu'on garde sous la main — pas une donnee a
 * synchroniser entre appareils.
 */
const CLE = "mlbb_favoris";

export function lireFavoris(): string[] {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as string[]) : [];
  } catch {
    return [];
  }
}

export function estFavori(slug: string): boolean {
  return lireFavoris().includes(slug);
}

/** Ajoute ou retire un heros, et renvoie le nouvel etat. */
export function basculerFavori(slug: string): boolean {
  const actuels = lireFavoris();
  const present = actuels.includes(slug);
  const suivants = present ? actuels.filter((s) => s !== slug) : [...actuels, slug];

  try {
    localStorage.setItem(CLE, JSON.stringify(suivants));
    // Prevenir les autres composants de la page (bouton et liste du compte).
    window.dispatchEvent(new CustomEvent("mlbb:favoris"));
  } catch {
    /* stockage indisponible : le favori ne persiste pas, sans casser la page */
  }

  return !present;
}

/**
 * Abonnement au store des favoris pour React.
 *
 * `useSyncExternalStore` est fait pour ca : lire une source exterieure a React
 * — ici le stockage du navigateur — et se reabonner a ses changements sans
 * declencher de rendu en cascade. L'evenement « mlbb:favoris » relie les
 * composants d'une meme page ; « storage » relie les onglets.
 */
export function abonnerFavoris(rappel: () => void): () => void {
  window.addEventListener("mlbb:favoris", rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener("mlbb:favoris", rappel);
    window.removeEventListener("storage", rappel);
  };
}

/**
 * Tableau vide partage.
 *
 * `useSyncExternalStore` compare les instantanes par reference : renvoyer un
 * `[]` neuf a chaque appel — cote serveur comme en repli — declenche une
 * boucle de rendu. Une seule reference gelee l'evite.
 */
const VIDE: readonly string[] = Object.freeze([]);

/** Instantane serveur : aucun favori connu hors du navigateur. */
export function favorisServeur(): readonly string[] {
  return VIDE;
}

/** Instantane stable : le meme contenu renvoie la meme reference. */
let cache: { brut: string; liste: string[] } = { brut: "", liste: [] };
export function instantaneFavoris(): string[] {
  try {
    const brut = localStorage.getItem(CLE) ?? "";
    if (brut !== cache.brut) cache = { brut, liste: brut ? JSON.parse(brut) : [] };
    // Meme reference gelee que l'instantane serveur quand il n'y a rien.
    return cache.liste.length ? cache.liste : (VIDE as string[]);
  } catch {
    return cache.liste;
  }
}

