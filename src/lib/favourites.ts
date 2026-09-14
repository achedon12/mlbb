/**
 * Favourites.
 *
 * They live in the browser, no longer in a database: the site no longer has
 * accounts of its own, identity is the game's. A favourite is therefore a
 * local convenience — the list of heroes kept close at hand — not data to
 * sync across devices.
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

/** Adds or removes a hero, and returns the new state. */
export function toggleFavourite(slug: string): boolean {
  const current = readFavourites();
  const present = current.includes(slug);
  const next = present ? current.filter((s) => s !== slug) : [...current, slug];

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    // Notify the other components of the page (button and account list).
    window.dispatchEvent(new CustomEvent("mlbb:favoris"));
  } catch {
    /* storage unavailable: the favourite does not persist, without breaking the page */
  }

  return !present;
}

/**
 * Subscription to the favourites store for React.
 *
 * `useSyncExternalStore` is made for this: reading a source outside React —
 * here the browser storage — and resubscribing to its changes without
 * triggering cascading renders. The "mlbb:favoris" event links the components
 * of a single page; "storage" links the tabs.
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
 * Shared empty array.
 *
 * `useSyncExternalStore` compares snapshots by reference: returning a fresh
 * `[]` on every call — server side as in the fallback — triggers a render
 * loop. A single frozen reference avoids it.
 */
const EMPTY: readonly string[] = Object.freeze([]);

/** Server snapshot: no favourite is known outside the browser. */
export function serverFavourites(): readonly string[] {
  return EMPTY;
}

/** Stable snapshot: the same content returns the same reference. */
let cache: { raw: string; list: string[] } = { raw: "", list: [] };
export function snapshotFavourites(): string[] {
  try {
    const raw = localStorage.getItem(KEY) ?? "";
    if (raw !== cache.raw) cache = { raw, list: raw ? JSON.parse(raw) : [] };
    // Same frozen reference as the server snapshot when there is nothing.
    return cache.list.length ? cache.list : (EMPTY as string[]);
  } catch {
    return cache.list;
  }
}

