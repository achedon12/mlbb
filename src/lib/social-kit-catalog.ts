import { allHeroes, illustrations, patchDetails } from "./data";
import { patchCurrent } from "./freshness";
import { heroGallery } from "./hero-skins";
import type { KitCatalog } from "./social-kit";
import type { SkinFull } from "./skins";
import { rankingOfRank } from "./tier-list";
import type { Hero } from "./types";

/**
 * What a social kit visual may name, on the server, and the brand page's
 * defaults. Heroes and skins only with an official artwork the site shows
 * (`illustrations`, `heroGallery`: `shownIllustrations` and
 * `isPublishedArtwork` already applied), never a fan or provisional copy.
 */

/** Heroes with at least one official artwork. */
export const kitHeroes: Hero[] = allHeroes.filter((h) => Object.keys(illustrations[h.slug] ?? {}).length > 0);

/** A release dated to the month at least ("2026-11", "2026-10-16"): the skins the catalogue dates precisely, the recent ones. */
const DATED = /^\d{4}-\d{2}(-\d{2})?$/;

export interface KitSkin {
  hero: Hero;
  skin: SkinFull & { illustration: string; release: string };
}

/** Skins with their official artwork and a release month, newest first. */
export const kitSkins: KitSkin[] = allHeroes
  .flatMap((hero) => heroGallery(hero).skins.map((skin) => ({ hero, skin })))
  .filter((e): e is KitSkin => !!e.skin.illustration && DATED.test(e.skin.release ?? ""))
  .sort((a, b) => b.skin.release.localeCompare(a.skin.release) || a.skin.name.localeCompare(b.skin.name, "en"));

export const kitSkinById = new Map(kitSkins.map((e) => [e.skin.id, e]));

export const kitCatalog: KitCatalog = {
  heroes: new Set(kitHeroes.map((h) => h.slug)),
  versions: new Set(Object.keys(patchDetails)),
  skins: new Set(kitSkinById.keys()),
};

const released = (h: Hero) => (h.release ? Date.parse(`${h.release} UTC`) : Number.NaN);

/** The brand page's defaults: the current patch, the newest hero, the meta's number one, the newest skin. */
export const kitDefaults = {
  version: patchCurrent?.version ?? null,
  newHero: [...kitHeroes].filter((h) => !Number.isNaN(released(h))).sort((a, b) => released(b) - released(a))[0]?.slug ?? null,
  spotlight: rankingOfRank("all").find((e) => kitCatalog.heroes.has(e.hero.slug))?.hero.slug ?? null,
  skin: kitSkins[0]?.skin.id ?? null,
};
