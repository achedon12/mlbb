import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { allHeroes, illustrations } from "./data";
import { RARITIES } from "./rarities";
import { uniqueAnchors, encodeImage, type GroupSkins, type SkinFull, type SkinThumb } from "./skins";
import type { Hero } from "./types";
import { normalizeNameSkin } from "./utils";

/**
 * Galerie des skins d'un heros, cote serveur : jointure du catalogue (id, nom,
 * rarete, prix), des portraits de boutique (par id) et des illustrations du
 * wiki (par nom).
 *
 * Le wiki a souvent une illustration d'avance sur le catalogue : un skin sorti
 * depuis la derniere mise a jour du module de donnees n'a encore ni rarete ni
 * prix, mais deja son illustration. Ces illustrations seules sont gardees a
 * part plutot que perdues.
 */

/** Illustration qu'aucun skin du catalogue ne reclame : un skin plus recent que le catalogue. */
export interface IllustrationSingle {
  name: string;
  illustration: string;
}

export interface HeroGallery {
  skins: SkinFull[];
  others: IllustrationSingle[];
  /** Skins du catalogue et illustrations seules. */
  total: number;
}

/**
 * Jointure du catalogue et des visuels. L'illustration se retrouve aussi par
 * nom normalise : la legende du wiki n'a pas toujours la casse du module
 * (« Vessel Of Deceit »).
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
  // Une illustration deja portee par un skin du catalogue n'est pas une illustration seule.
  const taken = new Set(skins.map((s) => s.illustration));
  const others = Object.entries(illustrations[h.slug] ?? {})
    .filter(([, path]) => !taken.has(path))
    .map(([name, illustration]) => ({ name, illustration }));
  const gallery = { skins, others, total: skins.length + others.length };
  cache.set(h.slug, gallery);
  return gallery;
}

/** Heros qui ont au moins un skin ou une illustration : chacun a sa galerie. */
export const heroesWithSkins = allHeroes.filter((h) => heroGallery(h).total > 0);

/** Nombre de skins recenses, illustrations seules comprises. */
export const gallerySkinCount = heroesWithSkins.reduce((n, h) => n + heroGallery(h).total, 0);

/** Le francais elide devant une voyelle : « Skins d'Aamon », mais « Skins de Balmond ». */
export const elide = (locale: Locale, name: string) => locale === "fr" && /^[aeiouàâäéèêëîïôöùûü]/i.test(name);

/** Titre de la galerie d'un heros, dans la langue de la page. */
export function titleGallery(t: T, locale: Locale, name: string): string {
  const e = elide(locale, name);
  return t(e ? "pages.heroSkins.titleElision" : "pages.heroSkins.title", { nom: name });
}

/** Ancres des skins d'une galerie, dans l'ordre d'affichage : catalogue, puis illustrations seules. */
export function anchorsGallery(g: HeroGallery): string[] {
  return uniqueAnchors([...g.skins.map((s) => s.name), ...g.others.map((a) => a.name)]);
}

/**
 * Groupes du catalogue de tous les skins, par ordre alphabetique de heros, en
 * vignettes compactes : le portrait de boutique, a defaut l'illustration.
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

/** Skins du catalogue dates au jour pres, du plus recent au plus ancien, avec leur heros. */
export function lastSkins(count: number): { hero: Hero; skin: SkinFull }[] {
  return heroesWithSkins
    .flatMap((h) => heroGallery(h).skins.map((skin) => ({ hero: h, skin })))
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.skin.release ?? ""))
    .sort((a, b) => b.skin.release!.localeCompare(a.skin.release!) || a.skin.name.localeCompare(b.skin.name, "en"))
    .slice(0, count);
}
