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

/**
 * Cle de comparaison d'un nom de skin. Legende du wiki et module de donnees ne
 * s'accordent pas toujours sur la casse ou la ponctuation : « Vessel Of
 * Deceit » et « Vessel of Deceit » designent le meme skin. Meme regle que
 * `scripts/galerie.mjs`.
 */
export function normaliserNomSkin(nom: string): string {
  return cleRecherche(nom.replace(/\(.*?\)/g, ""))
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Cle de recherche : sans casse ni accents. « Epique » trouve « Épique », et
 * « chang » trouve « Chang'e ». Toutes les recherches du site passent par la.
 */
export function cleRecherche(texte: string): string {
  return texte.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
