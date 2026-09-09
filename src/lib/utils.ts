import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Fusionne des classes Tailwind en resolvant les conflits. */
export function cn(...entrees: ClassValue[]): string {
  return twMerge(clsx(entrees));
}

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formaterDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : FORMAT_DATE.format(d);
}
