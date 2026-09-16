import type { Role, Skin } from "./types";
import { keySearch } from "./utils";

/**
 * Skins: types and computations shared by the hero page showcase, a hero's
 * gallery and the catalogue of all skins. Module without data, importable by
 * a client component.
 */

/** A catalogue skin, with its shop portrait and full-size illustration. */
export interface SkinFull extends Skin {
  portrait: string | null;
  illustration: string | null;
}

/** Game currencies, with unhelpful abbreviations: key of their label under `skinsUI`. */
export const CURRENCIES: Record<string, string> = {
  bp: "battlePoints",
  dm: "diamonds",
  ticket: "tickets",
  hf: "fragments",
  lg: "gems",
};

/**
 * File name of a skin, following the sync rule: "Night's
 * Edge" gives `night-s-edge`. Also used as an anchor in the gallery;
 * parentheses are kept, unlike `normalizeNameSkin`: "Ken (Outfit
 * 2)" must not be confused with "Ken".
 */
export function fileSkin(name: string): string {
  return keySearch(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Anchor of a skin in its hero's gallery: `skin-night-s-edge`. */
export const anchorSkin = (name: string) => `skin-${fileSkin(name) || "sans-nom"}`;

/** Anchors of a list of skins, made unique: two names that reduce to the same text get a suffix. */
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
 * Release date as the wiki gives it: to the day, month, year, or
 * approximate ("201X"), rendered in the locale's format when it is
 * complete and as is otherwise.
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

// ── Catalogue thumbnails ─────────────────────────────────────────

/**
 * Catalogue thumbnail, as a tuple: about a thousand skins are sent to the
 * browser, and repeated field names weighed more than the values.
 * The image is encoded as short as possible by `encodeImage`; the rarity is its rank
 * (0 to 6, see `RARITIES`).
 */
export type SkinThumb = [name: string, image: string | null, rarity: number];

export interface GroupSkins {
  slug: string;
  name: string;
  roles: Role[];
  skins: SkinThumb[];
}

/** Folder of a hero's visuals. */
export const heroFolder = (slug: string) => `/visuels/heros/${slug}/`;

/** Image path, shortened when it is under the hero folder (`skins/1091-duke-of-shards.webp`). */
export function shortenImage(slug: string, path: string | null): string | null {
  if (!path) return null;
  const folder = heroFolder(slug);
  return path.startsWith(folder) ? path.slice(folder.length) : path;
}

/** Path shortened by `shortenImage`, made absolute. */
export function imageThumb(slug: string, image: string | null): string | null {
  if (!image) return null;
  return image.startsWith("/") ? image : `${heroFolder(slug)}${image}`;
}

/** Shop portrait, as the sync stores it: `skins/1091-duke-of-shards.webp`. */
export const portraitSkin = (slug: string, id: string, name: string) =>
  `${heroFolder(slug)}skins/${id}-${fileSkin(name)}.webp`;
/** Illustration, as the sync stores it: `illustrations/duke-of-shards.webp`. */
export const illustrationSkin = (slug: string, name: string) => `${heroFolder(slug)}illustrations/${fileSkin(name)}.webp`;

/**
 * Image of a thumbnail, in its shortest form: the skin id when its
 * portrait follows the naming rule, "*" for an illustration that follows it,
 * the full path otherwise (a handful of names with an ampersand).
 */
export function encodeImage(slug: string, name: string, id: string | null, path: string | null): string | null {
  if (!path) return null;
  if (id && path === portraitSkin(slug, id, name)) return id;
  if (path === illustrationSkin(slug, name)) return "*";
  return path;
}

/** Image path of a thumbnail encoded by `encodeImage`. */
export function imageOfThumb(slug: string, [name, image]: SkinThumb): string | null {
  if (!image) return null;
  if (image === "*") return illustrationSkin(slug, name);
  return image.startsWith("/") ? image : portraitSkin(slug, image, name);
}

/**
 * Groups that pass the filters. A role keeps the heroes that have it. The
 * search keeps a whole hero when it matches their name, otherwise only their
 * skins whose name matches: "vessel" finds the Soul Vessels skins.
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
