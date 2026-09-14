import type { T } from "@/i18n/t";
import { RARITIES, RARITY_ORIGIN, type Rarity } from "./rarities";
import { anchorSkin } from "./skins";
import type { Role } from "./types";
import { keySearch } from "./utils";

/** Dossier des visuels d'un heros : les chemins de l'index s'y rapportent, pour peser moins. */
const folder = (slug: string) => `/visuels/heros/${slug}/`;
export const heroRelative = (slug: string, path: string | null) =>
  path?.startsWith(folder(slug)) ? path.slice(folder(slug).length) : path;
export const absoluteHero = (slug: string, path: string | null) =>
  path && !path.startsWith("/") ? `${folder(slug)}${path}` : path;

/**
 * Catalogue des skins, pour le calendrier des sorties et le calculateur de
 * collection.
 *
 * Le serveur publie un index compact (`/{langue}/skins/calendar/skins.json`),
 * en tuples, sans noms de champs repetes : un millier de skins partent au
 * navigateur, et seulement au premier besoin. Ce module le decode en objets
 * lisibles et porte les calculs communs (dates, regroupements, filtres). Il
 * n'importe aucune donnee : un composant client peut l'utiliser.
 */

export const ROLES_INDEX: readonly Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
export const AVAILABILITIES = ["Available", "Limited", "Upcoming"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

/** Monnaies chiffrees d'un prix. Le texte d'obtention (`other` du wiki) est a part. */
export const NUMERIC_CURRENCIES = ["dm", "bp", "ticket", "mc", "lg", "hf", "mythcoin"] as const;
export type Currency = (typeof NUMERIC_CURRENCIES)[number];
export type Price = Partial<Record<Currency, number>>;

/** Libelle de chaque monnaie, sous `skinsUI`. */
export const LABEL_CURRENCY: Record<Currency, string> = {
  dm: "diamonds",
  bp: "battlePoints",
  ticket: "tickets",
  mc: "magicCores",
  lg: "gems",
  hf: "fragments",
  mythcoin: "mythicCoins",
};

export interface CatalogHero {
  slug: string;
  name: string;
  roles: Role[];
  icon: string | null;
}

export interface SkinCatalog {
  id: string;
  name: string;
  /** Slug du heros. */
  hero: string;
  /** Rang de rarete (1 Commun a 6 Supreme), 0 pour le skin d'origine. */
  rarity: number;
  /** Serie ou evenement (« Collector », « StarLight »), tel que le wiki l'etiquette. */
  series: string | null;
  /** Date telle que le wiki la donne : « 2025-05-01 », « 2025-05 », « 2025 », parfois « 202X ». */
  release: string | null;
  availability: Availability | null;
  price: Price;
  /** Moyen d'obtention en clair, quand il remplace ou complete le prix (« 2025/05 StarLight Member »). */
  acquisition: string | null;
  /** Portrait de boutique, a defaut l'illustration ; chemin absolu. */
  image: string | null;
  /** Ancre du skin dans la galerie de son heros. */
  anchor: string;
}

/** Le skin d'origine vient avec le heros : son prix est celui du heros. */
export const isOrigin = (s: SkinCatalog) => s.rarity === 0;

export interface Catalog {
  /** Date de la synchronisation, ISO (jour). */
  maj: string;
  heroes: CatalogHero[];
  skins: SkinCatalog[];
}

// ── Index compact ───────────────────────────────────────────────────

export type HeroIndex = [slug: string, name: string, roles: number[], icon: string | null];
export type SkinIndex = [
  hero: number,
  id: string,
  name: string,
  rarity: number,
  /** Position dans `series`, -1 sans serie. */
  series: number,
  /** Vide quand le wiki ne date pas le skin. */
  release: string,
  /** Position dans `DISPOS`, -1 inconnue. */
  availability: number,
  price: Price,
  acquisition: string | null,
  /** Relative au dossier du heros quand elle y est. */
  image: string | null,
];

export interface IndexSkins {
  maj: string;
  heros: HeroIndex[];
  series: string[];
  skins: SkinIndex[];
}

/**
 * Ancres des skins d'un heros, dans l'ordre de sa galerie : deux noms qui se
 * reduisent au meme texte prennent un suffixe. Meme regle que `ancresGalerie`.
 */
export function anchorsOf(names: readonly string[]): string[] {
  const views = new Map<string, number>();
  return names.map((name) => {
    const base = anchorSkin(name);
    const n = (views.get(base) ?? 0) + 1;
    views.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** Series classees de la plus fournie a la plus rare : les plus courantes ont les plus petits numeros. */
function seriesDictionary(skins: readonly SkinCatalog[]): string[] {
  const counts = new Map<string, number>();
  for (const s of skins) if (s.series) counts.set(s.series, (counts.get(s.series) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en")).map(([s]) => s);
}

export function encodeIndex(c: Catalog): IndexSkins {
  const series = seriesDictionary(c.skins);
  const runNumber = new Map(series.map((s, i) => [s, i]));
  const heroNumber = new Map(c.heroes.map((h, i) => [h.slug, i]));
  return {
    maj: c.maj,
    heros: c.heroes.map((h) => [
      h.slug,
      h.name,
      h.roles.map((r) => ROLES_INDEX.indexOf(r)).filter((i) => i >= 0),
      heroRelative(h.slug, h.icon),
    ]),
    series,
    skins: c.skins.map((s) => [
      heroNumber.get(s.hero) ?? -1,
      s.id,
      s.name,
      s.rarity,
      s.series ? (runNumber.get(s.series) ?? -1) : -1,
      s.release ?? "",
      s.availability ? AVAILABILITIES.indexOf(s.availability) : -1,
      s.price,
      s.acquisition,
      heroRelative(s.hero, s.image),
    ]),
  };
}

export function decodeIndex(index: IndexSkins): Catalog {
  const heroes: CatalogHero[] = index.heros.map(([slug, name, roles, icon]) => ({
    slug,
    name,
    roles: roles.map((i) => ROLES_INDEX[i]).filter(Boolean),
    icon: absoluteHero(slug, icon),
  }));
  const skins: SkinCatalog[] = index.skins.map(([h, id, name, rarity, series, release, availability, price, acquisition, image]) => {
    const slug = heroes[h]?.slug ?? "";
    return {
      id,
      name,
      hero: slug,
      rarity,
      series: index.series[series] ?? null,
      release: release || null,
      availability: AVAILABILITIES[availability] ?? null,
      price,
      acquisition,
      image: absoluteHero(slug, image),
      anchor: "",
    };
  });
  // Les ancres se recalculent dans l'ordre de chaque galerie, plutot que de voyager dans l'index.
  const byHero = new Map<string, SkinCatalog[]>();
  for (const s of skins) byHero.set(s.hero, [...(byHero.get(s.hero) ?? []), s]);
  for (const list of byHero.values()) {
    const anchors = anchorsOf(list.map((s) => s.name));
    list.forEach((s, i) => (s.anchor = anchors[i]));
  }
  return { maj: index.maj, heroes, skins };
}

/** Index charge une seule fois par visite, au premier besoin. */
let promise: Promise<Catalog> | null = null;
export function loadCatalog(locale: string): Promise<Catalog> {
  promise ??= fetch(`/${locale}/skins/calendar/skins.json`)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<IndexSkins>;
    })
    .then(decodeIndex)
    .catch((e) => {
      // Un echec (hors ligne) ne doit pas bloquer le prochain essai.
      promise = null;
      throw e;
    });
  return promise;
}

// ── Dates ──────────────────────────────────────────────────────────

export interface ReleaseDate {
  year: number;
  month: number | null;
  day: number | null;
}

const FORMAT_RELEASE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** Date du wiki, au jour, au mois ou a l'annee ; null quand elle est approximative (« 202X ») ou absente. */
export function readRelease(release: string | null | undefined): ReleaseDate | null {
  const m = release ? FORMAT_RELEASE.exec(release) : null;
  if (!m) return null;
  return { year: Number(m[1]), month: m[2] ? Number(m[2]) : null, day: m[3] ? Number(m[3]) : null };
}

/**
 * Skin sorti a la date de reference : date lisible, ni annonce (« a venir »),
 * ni date posterieure. Une date au mois ou a l'annee se compare a sa
 * precision : « 2026-09 » est sorti le 11 septembre 2026.
 */
export function isReleased(s: SkinCatalog, reference: string): boolean {
  if (s.availability === "Upcoming" || !s.release || !readRelease(s.release)) return false;
  return s.release <= reference.slice(0, s.release.length);
}

export interface MonthSkins {
  /** 1 a 12, null quand le wiki ne donne que l'annee. */
  month: number | null;
  skins: SkinCatalog[];
}
export interface YearSkins {
  year: number;
  total: number;
  month: MonthSkins[];
}

/**
 * Skins ranges par annee puis par mois. `recent` : annees et mois du plus
 * recent au plus ancien ; `chronologique` : l'annee se lit de janvier a
 * decembre. Les skins dates a l'annee seule ferment toujours leur annee. Un
 * skin sans date lisible est ecarte.
 */
export function groupByDate(
  skins: readonly SkinCatalog[],
  order: "recent" | "chronologique" = "recent",
): YearSkins[] {
  const direction = order === "recent" ? -1 : 1;
  const years = new Map<number, Map<number | null, SkinCatalog[]>>();
  for (const s of skins) {
    const d = readRelease(s.release);
    if (!d) continue;
    const byMonth = years.get(d.year) ?? new Map<number | null, SkinCatalog[]>();
    years.set(d.year, byMonth);
    byMonth.set(d.month, [...(byMonth.get(d.month) ?? []), s]);
  }
  return [...years]
    .sort((a, b) => direction * (a[0] - b[0]))
    .map(([year, byMonth]) => {
      const month = [...byMonth]
        .sort((a, b) => (a[0] === null ? 1 : b[0] === null ? -1 : direction * (a[0] - b[0])))
        .map(([m, list]) => ({
          month: m,
          skins: [...list].sort(
            (a, b) => direction * (a.release ?? "").localeCompare(b.release ?? "") || a.name.localeCompare(b.name, "en"),
          ),
        }));
      return { year, total: month.reduce((n, m) => n + m.skins.length, 0), month };
    });
}

/** Les `limite` premiers skins de groupes deja ordonnes, groupes compris : l'affichage s'allonge par pas. */
export function truncateGroups(groups: readonly YearSkins[], limit: number): YearSkins[] {
  let rest = limit;
  const output: YearSkins[] = [];
  for (const a of groups) {
    if (rest <= 0) break;
    const month: MonthSkins[] = [];
    for (const m of a.month) {
      if (rest <= 0) break;
      const skins = m.skins.slice(0, rest);
      rest -= skins.length;
      month.push({ month: m.month, skins });
    }
    output.push({ year: a.year, total: a.total, month });
  }
  return output;
}

/** Les skins dates au moins au mois, du plus recent au plus ancien. */
export function newest(skins: readonly SkinCatalog[], count: number): SkinCatalog[] {
  return skins
    .filter((s) => (readRelease(s.release)?.month ?? null) !== null)
    .sort((a, b) => b.release!.localeCompare(a.release!) || a.name.localeCompare(b.name, "en"))
    .slice(0, count);
}

// ── Filtres et series ──────────────────────────────────────────────

export interface FiltersSkins {
  search?: string;
  hero?: string | null;
  role?: Role | null;
  series?: string | null;
  rarity?: number | null;
  year?: number | null;
}

/** La recherche porte sur le nom du skin et sur celui de son heros, sans casse ni accents. */
export function filterSkins(
  skins: readonly SkinCatalog[],
  heroes: ReadonlyMap<string, CatalogHero>,
  f: FiltersSkins,
): SkinCatalog[] {
  const term = keySearch((f.search ?? "").trim());
  return skins.filter((s) => {
    const h = heroes.get(s.hero);
    if (f.hero && s.hero !== f.hero) return false;
    if (f.role && !h?.roles.includes(f.role)) return false;
    if (f.series && s.series !== f.series) return false;
    if (f.rarity != null && s.rarity !== f.rarity) return false;
    if (f.year != null && readRelease(s.release)?.year !== f.year) return false;
    if (term && !keySearch(s.name).includes(term) && !keySearch(h?.name ?? "").includes(term)) return false;
    return true;
  });
}

export interface StatSeries {
  series: string;
  total: number;
  /** Premiere et derniere date connues de la serie. */
  first: string | null;
  last: string | null;
}

/** Series presentes, de la plus fournie a la plus rare. */
export function seriesStats(skins: readonly SkinCatalog[]): StatSeries[] {
  const bySeries = new Map<string, StatSeries>();
  for (const s of skins) {
    if (!s.series) continue;
    const st = bySeries.get(s.series) ?? { series: s.series, total: 0, first: null, last: null };
    st.total += 1;
    if (readRelease(s.release)) {
      if (!st.first || s.release! < st.first) st.first = s.release;
      if (!st.last || s.release! > st.last) st.last = s.release;
    }
    bySeries.set(s.series, st);
  }
  return [...bySeries.values()].sort((a, b) => b.total - a.total || a.series.localeCompare(b.series, "en"));
}

// ── Libelles ───────────────────────────────────────────────────────

const BY_RANK: Rarity[] = [RARITY_ORIGIN, ...Object.values(RARITIES).sort((a, b) => a.rank - b.rank)];

export function rarityOfRank(rank: number): Rarity {
  return BY_RANK[rank] ?? RARITY_ORIGIN;
}

/** Rangs des raretes achetables, du plus commun au plus rare. */
export const RANKS_RARITY = BY_RANK.slice(1).map((r) => r.rank);

/** Libelle traduit d'une valeur du wiki, ou la valeur elle-meme quand le catalogue ne la connait pas. */
export function orLabel(t: T, key: string, value: string): string {
  const translated = t(`${key}.${value}`);
  return translated === `${key}.${value}` ? value : translated;
}

export const labelRarity = (t: T, rank: number) => t(`skinRarity.${rarityOfRank(rank).key}`);
export const seriesLabel = (t: T, series: string) => orLabel(t, "skinLabel", series);

/** « 599 diamants · 32 000 points de bataille », ou null sans prix chiffre. */
export function textPrice(price: Price, t: T, count: Intl.NumberFormat): string | null {
  const matches = NUMERIC_CURRENCIES.flatMap((m) =>
    price[m] != null ? [`${count.format(price[m]!)} ${t(`skinsUI.${LABEL_CURRENCY[m]}`).toLowerCase()}`] : [],
  );
  return matches.length ? matches.join(" · ") : null;
}

/** Galerie du heros, ouverte sur le skin. */
export const linkSkin = (s: SkinCatalog) => `/heroes/${s.hero}/skins#${s.anchor}`;
