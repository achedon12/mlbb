import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind classes, resolving conflicts. */
export function cn(...entries: ClassValue[]): string {
  return twMerge(clsx(entries));
}

const FORMATS_DATE: Record<string, Intl.DateTimeFormat> = {};
function formatDate(locale: string): Intl.DateTimeFormat {
  return (FORMATS_DATE[locale] ??= new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }));
}

/** Formats a date in the requested language (BCP-47), French by default. */
export function formatShortDate(iso: string, locale = "fr-FR"): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : formatDate(locale).format(d);
}

/**
 * Comparison key of a skin name. The wiki legend and the data module do not
 * always agree on casing or punctuation: "Vessel Of
 * Deceit" and "Vessel of Deceit" refer to the same skin. Same rule as
 * `scripts/gallery.mjs`.
 */
export function normalizeNameSkin(name: string): string {
  return keySearch(name.replace(/\(.*?\)/g, ""))
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Search key: case- and accent-insensitive. "Epique" finds "Épique", and
 * "chang" finds "Chang'e". Every search on the site goes through it.
 */
export function keySearch(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
