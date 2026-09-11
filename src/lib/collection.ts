import {
  MONNAIES_CHIFFREES,
  estOrigine,
  lireSortie,
  type Catalogue,
  type Monnaie,
  type SkinCatalogue,
} from "./catalogue-skins";

/**
 * Valeur d'une collection : ce que coutent, au prix de la boutique du jeu, les
 * heros et les skins qu'un joueur a coches. Rien d'autre : ni valeur de
 * revente, ni estimation de compte — la vente de comptes est interdite par les
 * conditions de Moonton. Module sans donnees, importable par un composant
 * client.
 *
 * Le prix d'un heros est celui de son skin d'origine, qui vient avec lui.
 * Beaucoup s'achetent en diamants ou en points de bataille : le total en
 * diamants ne compte que le prix en diamants, les points de bataille sont
 * additionnes a part.
 */

export interface Possession {
  heros: ReadonlySet<string>;
  /** Identifiants des skins, hors skins d'origine (portes par `heros`). */
  skins: ReadonlySet<string>;
}

export interface LigneBilan {
  possedes: number;
  total: number;
  diamants: number;
}

export interface Bilan {
  heros: LigneBilan & {
    pointsBataille: number;
    /** Heros possedes dont le prix n'existe pas en diamants (points de bataille, fragments…). */
    sansDiamant: number;
  };
  skins: LigneBilan & {
    /** Skins possedes sans prix en diamants : evenement, tirage, StarLight, pass. */
    sansDiamant: number;
    /** Autres monnaies des skins possedes (noyaux magiques, gemmes…), hors diamants. */
    autres: Partial<Record<Monnaie, number>>;
  };
  /** Heros et skins, en diamants. */
  diamants: number;
  parRarete: (LigneBilan & { rang: number })[];
  parSerie: (LigneBilan & { serie: string })[];
  plusRares: SkinCatalogue[];
}

/** Skins que l'on peut cocher : sortis ou deja en boutique, hors skins d'origine et skins annonces. */
export const skinsCollectionnables = (c: Catalogue) => c.skins.filter((s) => !estOrigine(s) && s.dispo !== "Upcoming");

/** Skin d'origine de chaque heros : il porte le prix du heros. */
export function originesParHeros(c: Catalogue): Map<string, SkinCatalogue> {
  const m = new Map<string, SkinCatalogue>();
  for (const s of c.skins) if (estOrigine(s) && !m.has(s.heros)) m.set(s.heros, s);
  return m;
}

/**
 * Du plus rare au plus courant : rarete, puis edition limitee, puis serie la
 * moins fournie, puis le plus ancien. Le premier de la liste est la piece
 * maitresse de la collection.
 */
export function comparerRarete(tailleSerie: ReadonlyMap<string, number>) {
  const taille = (s: SkinCatalogue) => (s.serie ? (tailleSerie.get(s.serie) ?? Infinity) : Infinity);
  const cleDate = (s: SkinCatalogue) => (lireSortie(s.sortie) ? s.sortie! : "9999");
  return (a: SkinCatalogue, b: SkinCatalogue) =>
    b.rarete - a.rarete ||
    Number(b.dispo === "Limited") - Number(a.dispo === "Limited") ||
    taille(a) - taille(b) ||
    cleDate(a).localeCompare(cleDate(b)) ||
    a.nom.localeCompare(b.nom, "en");
}

export function bilanCollection(c: Catalogue, p: Possession, nombreRares = 6): Bilan {
  const origines = originesParHeros(c);
  const heros = { possedes: 0, total: c.heros.length, diamants: 0, pointsBataille: 0, sansDiamant: 0 };
  for (const h of c.heros) {
    if (!p.heros.has(h.slug)) continue;
    heros.possedes += 1;
    const prix = origines.get(h.slug)?.prix ?? {};
    heros.diamants += prix.dm ?? 0;
    heros.pointsBataille += prix.bp ?? 0;
    if (prix.dm == null) heros.sansDiamant += 1;
  }

  const collectionnables = skinsCollectionnables(c);
  const skins = { possedes: 0, total: collectionnables.length, diamants: 0, sansDiamant: 0, autres: {} as Bilan["skins"]["autres"] };
  const parRarete = new Map<number, LigneBilan & { rang: number }>();
  const parSerie = new Map<string, LigneBilan & { serie: string }>();
  const possedes: SkinCatalogue[] = [];

  for (const s of collectionnables) {
    const r = parRarete.get(s.rarete) ?? { rang: s.rarete, possedes: 0, total: 0, diamants: 0 };
    parRarete.set(s.rarete, r);
    const serie = s.serie ? (parSerie.get(s.serie) ?? { serie: s.serie, possedes: 0, total: 0, diamants: 0 }) : null;
    if (serie) parSerie.set(s.serie!, serie);
    r.total += 1;
    if (serie) serie.total += 1;
    if (!p.skins.has(s.id)) continue;

    possedes.push(s);
    const dm = s.prix.dm ?? 0;
    skins.possedes += 1;
    skins.diamants += dm;
    if (s.prix.dm == null) skins.sansDiamant += 1;
    for (const m of MONNAIES_CHIFFREES) {
      if (m !== "dm" && s.prix[m] != null) skins.autres[m] = (skins.autres[m] ?? 0) + s.prix[m]!;
    }
    r.possedes += 1;
    r.diamants += dm;
    if (serie) {
      serie.possedes += 1;
      serie.diamants += dm;
    }
  }

  const tailles = new Map([...parSerie].map(([nom, l]) => [nom, l.total]));
  return {
    heros,
    skins,
    diamants: heros.diamants + skins.diamants,
    parRarete: [...parRarete.values()].sort((a, b) => b.rang - a.rang),
    // Series entamees d'abord, par taux de completion ; puis les plus fournies.
    parSerie: [...parSerie.values()].sort(
      (a, b) =>
        Number(b.possedes > 0) - Number(a.possedes > 0) ||
        b.possedes / b.total - a.possedes / a.total ||
        b.total - a.total ||
        a.serie.localeCompare(b.serie, "en"),
    ),
    plusRares: possedes.sort(comparerRarete(tailles)).slice(0, nombreRares),
  };
}

/**
 * Couverture des prix du catalogue, pour dire honnetement ce que le total
 * compte : heros et skins chiffres en diamants, et les autres.
 */
export function couverturePrix(c: Catalogue) {
  const origines = originesParHeros(c);
  const skins = skinsCollectionnables(c);
  return {
    heros: c.heros.length,
    herosDiamants: c.heros.filter((h) => origines.get(h.slug)?.prix.dm != null).length,
    skins: skins.length,
    skinsDiamants: skins.filter((s) => s.prix.dm != null).length,
    skinsAutreMonnaie: skins.filter((s) => s.prix.dm == null && Object.keys(s.prix).length > 0).length,
  };
}

// ── Sauvegarde locale ──────────────────────────────────────────────

export const CLE_COLLECTION = "mlbbdex:collection";

export interface PossessionStockee {
  heros: string[];
  skins: string[];
}

/** Relit la sauvegarde ; une valeur abimee ou d'un autre format donne une collection vide. */
export function lirePossession(brut: string | null): PossessionStockee {
  const vide = { heros: [], skins: [] };
  if (!brut) return vide;
  try {
    const v = JSON.parse(brut) as unknown;
    if (typeof v !== "object" || v === null) return vide;
    const liste = (x: unknown) => (Array.isArray(x) ? x.filter((e): e is string => typeof e === "string") : []);
    return { heros: liste((v as PossessionStockee).heros), skins: liste((v as PossessionStockee).skins) };
  } catch {
    return vide;
  }
}

export function ecrirePossession(p: Possession): string {
  return JSON.stringify({ heros: [...p.heros].sort(), skins: [...p.skins].sort() });
}
