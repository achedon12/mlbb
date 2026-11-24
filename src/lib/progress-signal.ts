/**
 * "The player's progress changed in this browser": the daily games' stats,
 * the practice records and the reminder months call `signalProgress` after
 * writing (favourites have their own "mlbb:favoris" event). The account sync
 * listens, to send the change. Its own writes, which only copy what the
 * account brought, are made inside `quietly` so they are not sent back.
 */
export const PROGRESS_EVENT = "mlbb:progress";
/** Fired once the account's copy was written into this browser: pages showing the stats read them again. */
export const SYNCED_EVENT = "mlbb:account-synced";

let quiet = 0;

export function signalProgress() {
  if (quiet > 0 || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
}

export function quietly(write: () => void) {
  quiet += 1;
  try {
    write();
  } finally {
    quiet -= 1;
  }
}

export const isQuiet = () => quiet > 0;
