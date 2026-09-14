import type { Role, Skin } from "./types";
import { keySearch } from "./utils";

/**
 * Skins : types et calculs communs a la vitrine de la fiche, a la galerie d'un
 * heros et au catalogue de tous les skins. Module sans donnees, importable par
 * un composant client.
 */

/** Un skin du catalogue, avec son portrait de boutique et son illustration pleine taille. */
export interface SkinFull extends Skin {
  portrait: string | null;
  illustration: string | null;
}

/** Monnaies du jeu, aux sigles peu parlants : cle de leur libelle sous `skinsUI`. */
export const CURRENCIES: Record<string, string> = {
  bp: "battlePoints",
  dm: "diamonds",
  ticket: "tickets",
  hf: "fragments",
  lg: "gems",
};

/**
 * Nom de fichier d'un skin, selon la regle de la synchronisation : « Night's
 * Edge » donne `night-s-edge`. Sert aussi d'ancre dans la galerie ; les
 * parentheses restent, a la difference de `normaliserNomSkin` : « Ken (Outfit
 * 2) » ne doit pas se confondre avec « Ken ».
 */
export function fileSkin(name: string): string {
  return keySearch(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Ancre d'un skin dans la galerie de son heros : `skin-night-s-edge`. */
export const anchorSkin = (name: string) => `skin-${fileSkin(name) || "sans-nom"}`;

/** Ancres d'une liste de skins, rendues uniques : deux noms qui se reduisent au meme texte prennent un suffixe. */
export function uniqueAnchors(names: readonly string[]): string[] {
  const views = new Map<string, number>();
  return names.map((name) => {
    const base = anchorSkin(name);
    const n = (views.get(base) ?? 0) + 1;
    views.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/**
 * Date de sortie telle que le wiki la donne : au jour, au mois, a l'annee, ou
 * approximative (« 201X »), rendue au format de la langue quand elle est
 * complete et telle quelle sinon.
 */
export function formatRelease(release: string, locale: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(release)) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${release}T00:00:00Z`));
  }
  if (/^\d{4}-\d{2}$/.test(release)) {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${release}-01T00:00:00Z`),
    );
  }
  return release;
}

// ── Vignettes du catalogue ─────────────────────────────────────────

/**
 * Vignette du catalogue, en tuple : un millier de skins partent au
 * navigateur, et les noms de champs repetes pesaient plus que les valeurs.
 * L'image est codee au plus court par `coderImage` ; la rarete est son rang
 * (0 a 6, voir `RARETES`).
 */
export type SkinThumb = [name: string, image: string | null, rarity: number];

export interface GroupSkins {
  slug: string;
  name: string;
  roles: Role[];
  skins: SkinThumb[];
}

/** Dossier des visuels d'un heros. */
export const heroFolder = (slug: string) => `/visuels/heros/${slug}/`;

/** Chemin d'une image, raccourci quand il est sous le dossier du heros (`skins/1091-duke-of-shards.png`). */
export function shortenImage(slug: string, path: string | null): string | null {
  if (!path) return null;
  const folder = heroFolder(slug);
  return path.startsWith(folder) ? path.slice(folder.length) : path;
}

/** Chemin raccourci par `raccourcirImage`, rendu absolu. */
export function imageThumb(slug: string, image: string | null): string | null {
  if (!image) return null;
  return image.startsWith("/") ? image : `${heroFolder(slug)}${image}`;
}

/** Portrait de boutique, tel que la synchronisation le range : `skins/1091-duke-of-shards.png`. */
export const portraitSkin = (slug: string, id: string, name: string) =>
  `${heroFolder(slug)}skins/${id}-${fileSkin(name)}.png`;
/** Illustration, telle que la synchronisation la range : `illustrations/duke-of-shards.webp`. */
export const illustrationSkin = (slug: string, name: string) => `${heroFolder(slug)}illustrations/${fileSkin(name)}.webp`;

/**
 * Image d'une vignette, sous sa forme la plus courte : l'id du skin quand son
 * portrait suit la regle de nommage, « * » pour une illustration qui la suit,
 * le chemin complet sinon (une poignee de noms a esperluette).
 */
export function encodeImage(slug: string, name: string, id: string | null, path: string | null): string | null {
  if (!path) return null;
  if (id && path === portraitSkin(slug, id, name)) return id;
  if (path === illustrationSkin(slug, name)) return "*";
  return path;
}

/** Chemin de l'image d'une vignette codee par `coderImage`. */
export function imageOfThumb(slug: string, [name, image]: SkinThumb): string | null {
  if (!image) return null;
  if (image === "*") return illustrationSkin(slug, name);
  return image.startsWith("/") ? image : portraitSkin(slug, image, name);
}

/**
 * Groupes qui passent les filtres. Un role garde les heros qui l'ont. La
 * recherche garde un heros entier quand elle trouve son nom, sinon ses seuls
 * skins dont le nom correspond : « vessel » trouve les skins Soul Vessels.
 */
export function filterGroups(
  groups: readonly GroupSkins[],
  f: { role: Role | null; search: string },
): GroupSkins[] {
  const term = keySearch(f.search.trim());
  return groups.flatMap((g) => {
    if (f.role && !g.roles.includes(f.role)) return [];
    if (!term || keySearch(g.name).includes(term)) return [g];
    const skins = g.skins.filter(([name]) => keySearch(name).includes(term));
    return skins.length > 0 ? [{ ...g, skins }] : [];
  });
}
