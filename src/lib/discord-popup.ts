/**
 * The community Discord invitation: when the small card may show.
 *
 * The card asks for attention the visitor did not come for, so it waits
 * until they have shown some interest — a second page in the session, or a
 * while spent reading one — and it keeps its distance afterwards: closed, it
 * stays away for a month; followed, it never comes back; and it shows at
 * most once per session, whatever happens to it.
 *
 * The decision is a pure function of what the browser remembers, so it can
 * be tested without one; reading and writing the storage is kept apart, and
 * every access is guarded: in private mode, or with storage blocked, the
 * card simply never shows rather than breaking the page.
 */

/** Second page view of the session: the visitor is browsing, not bouncing. */
export const PAGE_VIEWS_BEFORE_SHOWING = 2;
/** Or this long on one page: they are reading. */
export const DWELL_BEFORE_SHOWING_MS = 25_000;
/** Closed with ×: left alone for a month. */
export const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;

/** Remembered across visits. */
export type DiscordPopupMemory = { dismissedUntil?: number; joined?: boolean };
/** Remembered for the tab's session only. */
export type DiscordPopupSession = { views: number; shown: boolean };

export type DiscordPopupContext = {
  invite: string | null;
  /** Locale-prefixed path of the current page. */
  pathname: string;
  /** The page rendered is the 404 page. */
  notFound: boolean;
  /** Page views in this session, the current one included. */
  pageViews: number;
  /** Time spent on the current page. */
  dwellMs: number;
  now: number;
  memory: DiscordPopupMemory;
  shownThisSession: boolean;
};

/**
 * The bot's own pages already invite to the server, at length: the card
 * would repeat them. `/bot` with or without the locale, and its sub-pages.
 */
export function isExcludedPath(pathname: string): boolean {
  return /^(?:\/[a-z]{2,3})?\/bot(?:\/|$)/.test(pathname);
}

/** Whether the card may show now. */
export function shouldShowDiscordPopup(c: DiscordPopupContext): boolean {
  if (!c.invite || c.notFound || isExcludedPath(c.pathname)) return false;
  if (c.memory.joined || c.shownThisSession) return false;
  if (c.memory.dismissedUntil !== undefined && c.now < c.memory.dismissedUntil) return false;
  return c.pageViews >= PAGE_VIEWS_BEFORE_SHOWING || c.dwellMs >= DWELL_BEFORE_SHOWING_MS;
}

const MEMORY_KEY = "mlbb_discord_popup";
const SESSION_KEY = "mlbb_discord_popup_session";

/** null when the storage itself refuses; a corrupted value reads as nothing remembered. */
function read<T>(storage: () => Storage, key: string): Partial<T> | null {
  let raw: string | null;
  try {
    raw = storage().getItem(key);
  } catch {
    return null;
  }
  try {
    const value: unknown = raw ? JSON.parse(raw) : {};
    return value && typeof value === "object" ? (value as Partial<T>) : {};
  } catch {
    return {};
  }
}

function write(storage: () => Storage, key: string, value: unknown) {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the card has already decided not to show */
  }
}

/**
 * What the browser remembers, or null when its storage cannot be read: the
 * card would then come back on every page, so it stays hidden instead.
 */
export function readDiscordPopupMemory(): DiscordPopupMemory | null {
  const value = read<DiscordPopupMemory>(() => localStorage, MEMORY_KEY);
  if (!value) return null;
  return {
    dismissedUntil: typeof value.dismissedUntil === "number" ? value.dismissedUntil : undefined,
    joined: value.joined === true,
  };
}

export function readDiscordPopupSession(): DiscordPopupSession | null {
  const value = read<DiscordPopupSession>(() => sessionStorage, SESSION_KEY);
  if (!value) return null;
  return { views: typeof value.views === "number" ? value.views : 0, shown: value.shown === true };
}

export function writeDiscordPopupSession(session: DiscordPopupSession) {
  write(() => sessionStorage, SESSION_KEY, session);
}

export function rememberDiscordPopupDismissed(now: number) {
  write(() => localStorage, MEMORY_KEY, { dismissedUntil: now + DISMISS_FOR_MS });
}

export function rememberDiscordPopupJoined() {
  write(() => localStorage, MEMORY_KEY, { joined: true });
}
