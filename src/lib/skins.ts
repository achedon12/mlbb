import type { Role, Skin } from "./types";
import { cleRecherche } from "./utils";

/**
 * Skins : types et calculs communs a la vitrine de la fiche, a la galerie d'un
 * heros et au catalogue de tous les skins. Module sans donnees, importable par
 * un composant client.
 */

/** Un skin du catalogue, avec son portrait de boutique et son illustration pleine taille. */
export interface SkinComplet extends Skin {
  portrait: string | null;
  illustration: string | null;
}

/** Monnaies du jeu, aux sigles peu parlants : cle de leur libelle sous `skinsUI`. */
export const MONNAIES: Record<string, string> = {
  bp: "pointsBataille",
  dm: "diamants",
  ticket: "tickets",
  hf: "fragments",
  lg: "gemmes",
};

/**
 * Nom de fichier d'un skin, selon la regle de la synchronisation : « Night's
 * Edge » donne `night-s-edge`. Sert aussi d'ancre dans la galerie ; les
 * parentheses restent, a la difference de `normaliserNomSkin` : « Ken (Outfit
 * 2) » ne doit pas se confondre avec « Ken ».
 */
export function fichierSkin(nom: string): string {
  return cleRecherche(nom)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Ancre d'un skin dans la galerie de son heros : `skin-night-s-edge`. */
export const ancreSkin = (nom: string) => `skin-${fichierSkin(nom) || "sans-nom"}`;

/** Ancres d'une liste de skins, rendues uniques : deux noms qui se reduisent au meme texte prennent un suffixe. */
export function ancresUniques(noms: readonly string[]): string[] {
  const vues = new Map<string, number>();
  return noms.map((nom) => {
    const base = ancreSkin(nom);
    const n = (vues.get(base) ?? 0) + 1;
    vues.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/**
 * Date de sortie telle que le wiki la donne : au jour, au mois, a l'annee, ou
 * approximative (« 201X »), rendue au format de la langue quand elle est
 * complete et telle quelle sinon.
 */
export function formaterSortie(sortie: string, langue: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(sortie)) {
    return new Intl.DateTimeFormat(langue, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${sortie}T00:00:00Z`));
  }
  if (/^\d{4}-\d{2}$/.test(sortie)) {
    return new Intl.DateTimeFormat(langue, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${sortie}-01T00:00:00Z`),
    );
  }
  return sortie;
}

// ── Vignettes du catalogue ─────────────────────────────────────────

/**
 * Vignette du catalogue, en tuple : un millier de skins partent au
 * navigateur, et les noms de champs repetes pesaient plus que les valeurs.
 * L'image est codee au plus court par `coderImage` ; la rarete est son rang
 * (0 a 6, voir `RARETES`).
 */
export type VignetteSkin = [nom: string, image: string | null, rarete: number];

export interface GroupeSkins {
  slug: string;
  nom: string;
  roles: Role[];
  skins: VignetteSkin[];
}

/** Dossier des visuels d'un heros. */
export const dossierHeros = (slug: string) => `/visuels/heros/${slug}/`;

/** Chemin d'une image, raccourci quand il est sous le dossier du heros (`skins/1091-duke-of-shards.png`). */
export function raccourcirImage(slug: string, chemin: string | null): string | null {
  if (!chemin) return null;
  const dossier = dossierHeros(slug);
  return chemin.startsWith(dossier) ? chemin.slice(dossier.length) : chemin;
}

/** Chemin raccourci par `raccourcirImage`, rendu absolu. */
export function imageVignette(slug: string, image: string | null): string | null {
  if (!image) return null;
  return image.startsWith("/") ? image : `${dossierHeros(slug)}${image}`;
}

/** Portrait de boutique, tel que la synchronisation le range : `skins/1091-duke-of-shards.png`. */
export const portraitSkin = (slug: string, id: string, nom: string) =>
  `${dossierHeros(slug)}skins/${id}-${fichierSkin(nom)}.png`;
/** Illustration, telle que la synchronisation la range : `illustrations/duke-of-shards.webp`. */
export const illustrationSkin = (slug: string, nom: string) => `${dossierHeros(slug)}illustrations/${fichierSkin(nom)}.webp`;

/**
 * Image d'une vignette, sous sa forme la plus courte : l'id du skin quand son
 * portrait suit la regle de nommage, « * » pour une illustration qui la suit,
 * le chemin complet sinon (une poignee de noms a esperluette).
 */
export function coderImage(slug: string, nom: string, id: string | null, chemin: string | null): string | null {
  if (!chemin) return null;
  if (id && chemin === portraitSkin(slug, id, nom)) return id;
  if (chemin === illustrationSkin(slug, nom)) return "*";
  return chemin;
}

/** Chemin de l'image d'une vignette codee par `coderImage`. */
export function imageDeVignette(slug: string, [nom, image]: VignetteSkin): string | null {
  if (!image) return null;
  if (image === "*") return illustrationSkin(slug, nom);
  return image.startsWith("/") ? image : portraitSkin(slug, image, nom);
}

/**
 * Groupes qui passent les filtres. Un role garde les heros qui l'ont. La
 * recherche garde un heros entier quand elle trouve son nom, sinon ses seuls
 * skins dont le nom correspond : « vessel » trouve les skins Soul Vessels.
 */
export function filtrerGroupes(
  groupes: readonly GroupeSkins[],
  f: { role: Role | null; recherche: string },
): GroupeSkins[] {
  const terme = cleRecherche(f.recherche.trim());
  return groupes.flatMap((g) => {
    if (f.role && !g.roles.includes(f.role)) return [];
    if (!terme || cleRecherche(g.nom).includes(terme)) return [g];
    const skins = g.skins.filter(([nom]) => cleRecherche(nom).includes(terme));
    return skins.length > 0 ? [{ ...g, skins }] : [];
  });
}
