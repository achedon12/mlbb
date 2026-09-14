/**
 * Favoris.
 *
 * Ils vivent dans le navigateur, plus dans une base : le site n'a plus de
 * compte a lui, l'identite est celle du jeu. Un favori est donc une commodite
 * locale — la liste des heros qu'on garde sous la main — pas une donnee a
 * synchroniser entre appareils.
 */
const KEY = "mlbb_favoris";

export function readFavourites(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isFavourite(slug: string): boolean {
  return readFavourites().includes(slug);
}

/** Ajoute ou retire un heros, et renvoie le nouvel etat. */
export function toggleFavourite(slug: string): boolean {
  const current = readFavourites();
  const present = current.includes(slug);
  const next = present ? current.filter((s) => s !== slug) : [...current, slug];

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
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
export function subscribeToFavourites(reminder: () => void): () => void {
  window.addEventListener("mlbb:favoris", reminder);
  window.addEventListener("storage", reminder);
  return () => {
    window.removeEventListener("mlbb:favoris", reminder);
    window.removeEventListener("storage", reminder);
  };
}

/**
 * Tableau vide partage.
 *
 * `useSyncExternalStore` compare les instantanes par reference : renvoyer un
 * `[]` neuf a chaque appel — cote serveur comme en repli — declenche une
 * boucle de rendu. Une seule reference gelee l'evite.
 */
const EMPTY: readonly string[] = Object.freeze([]);

/** Instantane serveur : aucun favori connu hors du navigateur. */
export function serverFavourites(): readonly string[] {
  return EMPTY;
}

/** Instantane stable : le meme contenu renvoie la meme reference. */
let cache: { raw: string; list: string[] } = { raw: "", list: [] };
export function snapshotFavourites(): string[] {
  try {
    const raw = localStorage.getItem(KEY) ?? "";
    if (raw !== cache.raw) cache = { raw, list: raw ? JSON.parse(raw) : [] };
    // Meme reference gelee que l'instantane serveur quand il n'y a rien.
    return cache.list.length ? cache.list : (EMPTY as string[]);
  } catch {
    return cache.list;
  }
}

