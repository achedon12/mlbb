import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Fusionne des classes Tailwind en resolvant les conflits. */
export function cn(...entrees: ClassValue[]): string {
  return twMerge(clsx(entrees));
}

const FORMATS_DATE: Record<string, Intl.DateTimeFormat> = {};
function formatDate(locale: string): Intl.DateTimeFormat {
  return (FORMATS_DATE[locale] ??= new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }));
}

/** Formate une date dans la langue demandee (BCP-47), francais par defaut. */
export function formaterDate(iso: string, locale = "fr-FR"): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : formatDate(locale).format(d);
}
