import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { allHeroes, illustrations } from "./data";
import { RARITIES } from "./rarities";
import { uniqueAnchors, encodeImage, type GroupSkins, type SkinFull, type SkinThumb } from "./skins";
import type { Hero } from "./types";
import { normalizeNameSkin } from "./utils";

/**
 * A hero's skin gallery, server side: join of the catalogue (id, name,
 * rarity, price), the shop portraits (by id) and the wiki artwork (by name).
 *
 * The wiki often has an artwork ahead of the catalogue: a skin released since
 * the last update of the data module has neither rarity nor price yet, but
 * already has its artwork. These lone artworks are kept aside rather than
 * lost.
 */

/** Artwork no catalogue skin claims: a skin newer than the catalogue. */
export interface IllustrationSingle {
  name: string;
  illustration: string;
}

export interface HeroGallery {
  skins: SkinFull[];
  others: IllustrationSingle[];
  /** Catalogue skins and lone artworks. */
  total: number;
}

/**
 * Join of the catalogue and the visuals. The artwork is also matched by
 * normalised name: the wiki caption does not always have the module's casing
 * ("Vessel Of Deceit").
 */
export function skinsFull(h: Hero): SkinFull[] {
  const byHero = illustrations[h.slug] ?? {};
  const byName = new Map(Object.entries(byHero).map(([name, path]) => [normalizeNameSkin(name), path]));
  return h.skins.map((s) => ({
    ...s,
    portrait: h.images.skins[s.id] ?? null,
    illustration: byHero[s.name] ?? byName.get(normalizeNameSkin(s.name)) ?? null,
  }));
}

const cache = new Map<string, HeroGallery>();

export function heroGallery(h: Hero): HeroGallery {
  const already = cache.get(h.slug);
  if (already) return already;
  const skins = skinsFull(h);
  // An artwork already carried by a catalogue skin is not a lone artwork.
  const taken = new Set(skins.map((s) => s.illustration));
  const others = Object.entries(illustrations[h.slug] ?? {})
    .filter(([, path]) => !taken.has(path))
    .map(([name, illustration]) => ({ name, illustration }));
  const gallery = { skins, others, total: skins.length + others.length };
  cache.set(h.slug, gallery);
  return gallery;
}

/** Heroes with at least one skin or artwork: each gets its gallery. */
export const heroesWithSkins = allHeroes.filter((h) => heroGallery(h).total > 0);

/** Number of listed skins, lone artworks included. */
export const gallerySkinCount = heroesWithSkins.reduce((n, h) => n + heroGallery(h).total, 0);

/** French elides before a vowel: "Skins d'Aamon", but "Skins de Balmond". */
export const elide = (locale: Locale, name: string) => locale === "fr" && /^[aeiouàâäéèêëîïôöùûü]/i.test(name);

/** Title of a hero's gallery, in the page's language. */
export function titleGallery(t: T, locale: Locale, name: string): string {
  const e = elide(locale, name);
  return t(e ? "pages.heroSkins.titleElision" : "pages.heroSkins.title", { name: name });
}

/** Skin anchors of a gallery, in display order: catalogue, then lone artworks. */
export function anchorsGallery(g: HeroGallery): string[] {
  return uniqueAnchors([...g.skins.map((s) => s.name), ...g.others.map((a) => a.name)]);
}

/**
 * Groups of the all-skins catalogue, in alphabetical hero order, as compact
 * thumbnails: the shop portrait, else the artwork.
 */
export function groupsSkins(): GroupSkins[] {
  return [...heroesWithSkins]
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((h) => {
      const g = heroGallery(h);
      return {
        slug: h.slug,
        name: h.name,
        roles: h.roles,
        skins: [
          ...g.skins.map((s): SkinThumb => [
            s.name,
            encodeImage(h.slug, s.name, s.portrait ? s.id : null, s.portrait ?? s.illustration),
            s.rarity ? (RARITIES[s.rarity]?.rank ?? 0) : 0,
          ]),
          ...g.others.map((a): SkinThumb => [a.name, encodeImage(h.slug, a.name, null, a.illustration), 0]),
        ],
      };
    });
}

/** Catalogue skins dated to the day, newest to oldest, with their hero. */
export function lastSkins(count: number): { hero: Hero; skin: SkinFull }[] {
  return heroesWithSkins
    .flatMap((h) => heroGallery(h).skins.map((skin) => ({ hero: h, skin })))
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.skin.release ?? ""))
    .sort((a, b) => b.skin.release!.localeCompare(a.skin.release!) || a.skin.name.localeCompare(b.skin.name, "en"))
    .slice(0, count);
}
