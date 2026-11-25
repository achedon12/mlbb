/**
 * Light or dark: the visitor's choice of theme.
 *
 * By default ("auto") the site follows the system, through CSS alone
 * (`prefers-color-scheme`, globals.css): no script is needed for it, and
 * nothing flashes. A visitor who forces a theme in the footer has it kept in
 * `localStorage`; a tiny inline script (`THEME_SCRIPT`, in the <head>) writes
 * it as `data-theme` on <html> before the first paint, so a forced theme
 * does not flash either.
 *
 * The decisions are pure functions, tested without a browser; the storage
 * access is guarded: with storage blocked, the choice holds for the open
 * page only.
 */

import type { CSSProperties } from "react";

export type ThemePreference = "auto" | "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["auto", "light", "dark"];
export const THEME_KEY = "mlbb_theme";

/** The browser bar's colour (`theme-color`), the ground of each theme. */
export const THEME_COLORS = { dark: "#06080f", light: "#f4f1ea" } as const;

/** A stored value, read back: anything but "light" or "dark" means "auto". */
export function parseTheme(raw: unknown): ThemePreference {
  return raw === "light" || raw === "dark" ? raw : "auto";
}

/** The value of `data-theme` on <html> for a preference: none for "auto". */
export function themeAttribute(preference: ThemePreference): "light" | "dark" | null {
  return preference === "auto" ? null : preference;
}

/**
 * `theme-color` for one of the page's media-bound tags: the forced theme's
 * ground, or, on "auto", the ground of the scheme its media query names.
 */
export function themeColorFor(preference: ThemePreference, media: string | null): string {
  if (preference !== "auto") return THEME_COLORS[preference];
  return media && /prefers-color-scheme:\s*light/.test(media) ? THEME_COLORS.light : THEME_COLORS.dark;
}

/**
 * Run first in the <body>, before anything is painted: applies a forced
 * theme, `data-theme` and the `theme-color` tags of the head. Kept tiny and
 * self-contained (no import can run there); it mirrors `parseTheme` and
 * `applyTheme`. On "auto" it does nothing: CSS follows the system.
 */
export const THEME_SCRIPT =
  `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark"){` +
  `document.documentElement.setAttribute("data-theme",t);` +
  `var c=t==="light"?${JSON.stringify(THEME_COLORS.light)}:${JSON.stringify(THEME_COLORS.dark)};` +
  `document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=c})}}catch(e){}`;

/** The stored preference; "auto" when there is none or storage is blocked. */
export function readTheme(): ThemePreference {
  try {
    return parseTheme(window.localStorage.getItem(THEME_KEY));
  } catch {
    return "auto";
  }
}

const listeners = new Set<() => void>();
let current: ThemePreference | null = null;

/** Applies a preference to the page: `data-theme` and the `theme-color` tags. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  const attribute = themeAttribute(preference);
  if (attribute) root.setAttribute("data-theme", attribute);
  else root.removeAttribute("data-theme");
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = themeColorFor(preference, meta.getAttribute("media"));
  }
}

/** Stores and applies a preference ("auto" forgets the stored one). */
export function setTheme(preference: ThemePreference): void {
  try {
    if (preference === "auto") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Storage blocked: the choice holds for this page only.
  }
  current = preference;
  applyTheme(preference);
  for (const listener of listeners) listener();
}

/** For `useSyncExternalStore`: the preference, as stored. */
export function getTheme(): ThemePreference {
  if (current === null) current = readTheme();
  return current;
}

/** The server knows no preference: it renders "auto". */
export function getServerTheme(): ThemePreference {
  return "auto";
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    // Another tab changed it.
    if (e.key !== THEME_KEY) return;
    current = parseTheme(e.newValue);
    applyTheme(current);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * A colour given by the data (a rarity, a rank) used as text: drawn as is on
 * the night, deepened towards the ink on paper so that it keeps a text
 * contrast (`.ink`, globals.css). Goes with the `ink` class.
 */
export function inkStyle(color: string): CSSProperties {
  return { "--ink": color } as CSSProperties;
}
