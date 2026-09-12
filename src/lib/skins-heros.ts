import type { Langue } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { heros, illustrations } from "./donnees";
import { RARETES } from "./raretes";
import { ancresUniques, coderImage, type GroupeSkins, type SkinComplet, type VignetteSkin } from "./skins";
import type { Heros } from "./types";
import { normaliserNomSkin } from "./utils";

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
export interface IllustrationSeule {
  nom: string;
  illustration: string;
}

export interface GalerieHeros {
  skins: SkinComplet[];
  autres: IllustrationSeule[];
  /** Skins du catalogue et illustrations seules. */
  total: number;
}

/**
 * Jointure du catalogue et des visuels. L'illustration se retrouve aussi par
 * nom normalise : la legende du wiki n'a pas toujours la casse du module
 * (« Vessel Of Deceit »).
 */
export function skinsComplets(h: Heros): SkinComplet[] {
  const parHeros = illustrations[h.slug] ?? {};
  const parNom = new Map(Object.entries(parHeros).map(([nom, chemin]) => [normaliserNomSkin(nom), chemin]));
  return h.skins.map((s) => ({
    ...s,
    portrait: h.images.skins[s.id] ?? null,
    illustration: parHeros[s.name] ?? parNom.get(normaliserNomSkin(s.name)) ?? null,
  }));
}

const cache = new Map<string, GalerieHeros>();

export function galerieHeros(h: Heros): GalerieHeros {
  const deja = cache.get(h.slug);
  if (deja) return deja;
  const skins = skinsComplets(h);
  // Une illustration deja portee par un skin du catalogue n'est pas une illustration seule.
  const prises = new Set(skins.map((s) => s.illustration));
  const autres = Object.entries(illustrations[h.slug] ?? {})
    .filter(([, chemin]) => !prises.has(chemin))
    .map(([nom, illustration]) => ({ nom, illustration }));
  const galerie = { skins, autres, total: skins.length + autres.length };
  cache.set(h.slug, galerie);
  return galerie;
}

/** Heros qui ont au moins un skin ou une illustration : chacun a sa galerie. */
export const herosAvecSkins = heros.filter((h) => galerieHeros(h).total > 0);

/** Nombre de skins recenses, illustrations seules comprises. */
export const nombreSkinsGaleries = herosAvecSkins.reduce((n, h) => n + galerieHeros(h).total, 0);

/** Le francais elide devant une voyelle : « Skins d'Aamon », mais « Skins de Balmond ». */
export const elide = (locale: Langue, nom: string) => locale === "fr" && /^[aeiouàâäéèêëîïôöùûü]/i.test(nom);

/** Titre de la galerie d'un heros, dans la langue de la page. */
export function titreGalerie(t: T, locale: Langue, nom: string): string {
  const e = elide(locale, nom);
  return t(e ? "pages.heroSkins.titreElision" : "pages.heroSkins.titre", { nom });
}

/** Ancres des skins d'une galerie, dans l'ordre d'affichage : catalogue, puis illustrations seules. */
export function ancresGalerie(g: GalerieHeros): string[] {
  return ancresUniques([...g.skins.map((s) => s.name), ...g.autres.map((a) => a.nom)]);
}

/**
 * Groupes du catalogue de tous les skins, par ordre alphabetique de heros, en
 * vignettes compactes : le portrait de boutique, a defaut l'illustration.
 */
export function groupesSkins(): GroupeSkins[] {
  return [...herosAvecSkins]
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((h) => {
      const g = galerieHeros(h);
      return {
        slug: h.slug,
        nom: h.name,
        roles: h.roles,
        skins: [
          ...g.skins.map((s): VignetteSkin => [
            s.name,
            coderImage(h.slug, s.name, s.portrait ? s.id : null, s.portrait ?? s.illustration),
            s.rarity ? (RARETES[s.rarity]?.rang ?? 0) : 0,
          ]),
          ...g.autres.map((a): VignetteSkin => [a.nom, coderImage(h.slug, a.nom, null, a.illustration), 0]),
        ],
      };
    });
}

/** Skins du catalogue dates au jour pres, du plus recent au plus ancien, avec leur heros. */
export function derniersSkins(nombre: number): { heros: Heros; skin: SkinComplet }[] {
  return herosAvecSkins
    .flatMap((h) => galerieHeros(h).skins.map((skin) => ({ heros: h, skin })))
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.skin.release ?? ""))
    .sort((a, b) => b.skin.release!.localeCompare(a.skin.release!) || a.skin.name.localeCompare(b.skin.name, "en"))
    .slice(0, nombre);
}
