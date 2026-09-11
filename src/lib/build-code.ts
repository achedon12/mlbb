/**
 * Code d'un build dans l'adresse du simulateur.
 *
 * Un build partage tient tout entier dans les parametres de requete de
 * `/tools/build` : pas de base, pas d'identifiant a resoudre, et un lien colle
 * dans un salon de discussion reste lisible. Tous les parametres sont
 * facultatifs et leur ordre n'importe pas :
 *
 * | param | contenu                                                        | exemple              |
 * |-------|----------------------------------------------------------------|----------------------|
 * | `h`   | slug du heros                                                  | `h=aamon`            |
 * | `n`   | niveau, de 1 a 15 ; absent = 15                                | `n=12`               |
 * | `o`   | jusqu'a six slugs d'objets, ordre d'achat, separes par `,` ;   | `o=genius-wand,holy-crystal` |
 * |       | un meme objet peut revenir (le jeu permet de l'acheter deux fois) |                   |
 * | `e`   | ensemble d'emblemes (`common`, `tank`, `mage`…)                | `e=mage`             |
 * | `t`   | trois talents, un par etage, separes par `,` ; etage vide permis | `t=rupture,,killing-spree` |
 * | `s`   | sort de combat                                                 | `s=flicker`          |
 *
 * Exemple complet : `/en/tools/build?h=aamon&n=15&o=genius-wand,holy-crystal&e=mage&t=rupture,weapon-master,killing-spree&s=retribution`.
 *
 * Deux lectures : `decoderBuild`, tolerante, pour une adresse — ce qui ne se
 * reconnait pas est ecarte et signale, le reste s'affiche ; `validerBuild`,
 * stricte, pour un corps de requete — la moindre valeur inconnue rejette tout.
 * Les deux verifient chaque slug contre le catalogue fourni : ce module ne
 * charge aucune donnee, le navigateur et le serveur lui passent la leur.
 */

export const NIVEAU_MIN = 1;
export const NIVEAU_MAX = 15;
export const OBJETS_MAX = 6;
export const ETAGES = 3;

/** Au-dela, l'adresse n'a pas ete fabriquee par le site : inutile de la lire. */
const LONGUEUR_MAX = 800;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 48;

export const PARAMS = { heros: "h", niveau: "n", objets: "o", embleme: "e", talents: "t", sort: "s" } as const;

export type Talents = [string | null, string | null, string | null];

export interface BuildCode {
  heros: string | null;
  niveau: number;
  objets: string[];
  embleme: string | null;
  talents: Talents;
  sort: string | null;
}

export interface CatalogueCode {
  heros: ReadonlySet<string>;
  objets: ReadonlySet<string>;
  emblemes: ReadonlySet<string>;
  /** Talents permis a chaque etage, dans l'ordre. */
  etages: readonly [ReadonlySet<string>, ReadonlySet<string>, ReadonlySet<string>];
  sorts: ReadonlySet<string>;
}

export const BUILD_VIDE: BuildCode = {
  heros: null,
  niveau: NIVEAU_MAX,
  objets: [],
  embleme: null,
  talents: [null, null, null],
  sort: null,
};

const estSlug = (v: unknown): v is string => typeof v === "string" && v.length <= SLUG_MAX && SLUG.test(v);

/** Parametres de requete du build, sans `?` ; les parties vides sont omises. */
export function encoderBuild(b: BuildCode): string {
  const parties: string[] = [];
  // Slugs en [a-z0-9-] : rien a echapper, et les virgules restent lisibles.
  if (b.heros) parties.push(`${PARAMS.heros}=${b.heros}`);
  if (b.niveau !== NIVEAU_MAX) parties.push(`${PARAMS.niveau}=${b.niveau}`);
  if (b.objets.length) parties.push(`${PARAMS.objets}=${b.objets.join(",")}`);
  if (b.embleme) parties.push(`${PARAMS.embleme}=${b.embleme}`);
  if (b.talents.some(Boolean)) parties.push(`${PARAMS.talents}=${b.talents.map((t) => t ?? "").join(",")}`);
  if (b.sort) parties.push(`${PARAMS.sort}=${b.sort}`);
  return parties.join("&");
}

type Entree = URLSearchParams | string | Record<string, string | string[] | undefined>;

function lecteur(entree: Entree): (cle: string) => string | null {
  if (typeof entree === "string") {
    const texte = entree.length > LONGUEUR_MAX ? "" : entree.replace(/^\?/, "");
    const p = new URLSearchParams(texte);
    return (cle) => p.get(cle);
  }
  if (entree instanceof URLSearchParams) return (cle) => entree.get(cle);
  return (cle) => {
    const v = entree[cle];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
}

export interface LectureBuild {
  build: BuildCode;
  /** Parametres ecartes, pour prevenir le visiteur que le lien etait abime. */
  ignores: (keyof typeof PARAMS)[];
}

/**
 * Lecture tolerante d'une adresse. Un objet inconnu disparait sans emporter
 * les autres ; un talent place au mauvais etage laisse l'etage vide.
 */
export function decoderBuild(entree: Entree, catalogue: CatalogueCode): LectureBuild {
  const lire = lecteur(entree);
  const ignores = new Set<keyof typeof PARAMS>();
  const build: BuildCode = { ...BUILD_VIDE, talents: [null, null, null] };

  const h = lire(PARAMS.heros);
  if (h !== null) {
    if (estSlug(h) && catalogue.heros.has(h)) build.heros = h;
    else ignores.add("heros");
  }

  const n = lire(PARAMS.niveau);
  if (n !== null) {
    const niveau = /^\d{1,2}$/.test(n) ? Number(n) : Number.NaN;
    if (niveau >= NIVEAU_MIN && niveau <= NIVEAU_MAX) build.niveau = niveau;
    else ignores.add("niveau");
  }

  const o = lire(PARAMS.objets);
  if (o !== null && o !== "") {
    const slugs = o.split(",");
    const valides = slugs.filter((s) => estSlug(s) && catalogue.objets.has(s));
    if (valides.length !== slugs.length || valides.length > OBJETS_MAX) ignores.add("objets");
    build.objets = valides.slice(0, OBJETS_MAX);
  }

  const e = lire(PARAMS.embleme);
  if (e !== null) {
    if (estSlug(e) && catalogue.emblemes.has(e)) build.embleme = e;
    else ignores.add("embleme");
  }

  const t = lire(PARAMS.talents);
  if (t !== null && t !== "") {
    const slots = t.split(",");
    if (slots.length > ETAGES) ignores.add("talents");
    for (let i = 0; i < ETAGES; i += 1) {
      const s = slots[i];
      if (!s) continue;
      if (estSlug(s) && catalogue.etages[i].has(s)) build.talents[i] = s;
      else ignores.add("talents");
    }
  }

  const s = lire(PARAMS.sort);
  if (s !== null) {
    if (estSlug(s) && catalogue.sorts.has(s)) build.sort = s;
    else ignores.add("sort");
  }

  return { build, ignores: [...ignores] };
}

/**
 * Lecture stricte d'un build envoye en JSON (`{ heros, niveau, objets,
 * embleme, talents, sort }`) : null au moindre champ inconnu, mal type ou
 * absent du catalogue. Le heros est obligatoire, et au moins un objet.
 */
export function validerBuild(brut: unknown, catalogue: CatalogueCode): (BuildCode & { heros: string }) | null {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return null;
  const b = brut as Record<string, unknown>;
  const permis = new Set(["heros", "niveau", "objets", "embleme", "talents", "sort"]);
  if (Object.keys(b).some((k) => !permis.has(k))) return null;

  if (!estSlug(b.heros) || !catalogue.heros.has(b.heros)) return null;
  if (typeof b.niveau !== "number" || !Number.isInteger(b.niveau) || b.niveau < NIVEAU_MIN || b.niveau > NIVEAU_MAX) {
    return null;
  }
  if (!Array.isArray(b.objets) || b.objets.length < 1 || b.objets.length > OBJETS_MAX) return null;
  if (!b.objets.every((o) => estSlug(o) && catalogue.objets.has(o))) return null;
  if (b.embleme !== null && (!estSlug(b.embleme) || !catalogue.emblemes.has(b.embleme))) return null;
  if (!Array.isArray(b.talents) || b.talents.length !== ETAGES) return null;
  const talents = b.talents as unknown[];
  if (!talents.every((t, i) => t === null || (estSlug(t) && catalogue.etages[i].has(t)))) return null;
  if (b.sort !== null && (!estSlug(b.sort) || !catalogue.sorts.has(b.sort))) return null;

  return {
    heros: b.heros,
    niveau: b.niveau,
    objets: [...(b.objets as string[])],
    embleme: (b.embleme as string | null) ?? null,
    talents: [...talents] as Talents,
    sort: (b.sort as string | null) ?? null,
  };
}
