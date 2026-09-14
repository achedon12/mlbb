import type { Locale } from "@/i18n/config";
import { keyValue } from "@/i18n/hero-data";
import { allHeroes, stories } from "./data";
import type { Hero, Role } from "./types";
import { keySearch } from "./utils";

/**
 * Lore : regions, factions et liens entre heros.
 *
 * Tout vient des donnees : la region de chaque heros (`heros.json`) et sa
 * fiche narrative du wiki (`histoires`), en quatre langues. Aucun texte n'est
 * ecrit ici : un lien n'existe que si la fiche d'un heros en nomme un autre,
 * et sa nature est celle que la fiche lui donne.
 *
 * Les noms se cherchent dans la fiche anglaise : les autres langues traduisent
 * parfois un nom de heros (« Minotaure », « Sabre »). Les listes des quatre
 * langues etant alignees, la nature du lien se lit ensuite a la meme position
 * dans la langue de la page.
 */

// ── Relations ──────────────────────────────────────────────────────

/** « Gusion, Eren (younger brothers) » : les noms, puis la nature du lien, entre les parentheses finales. */
export function splitRelation(text: string): { names: string; nature: string | null } {
  const t = text.trim();
  if (!t.endsWith(")")) return { names: t, nature: null };
  let depth = 0;
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] === ")") depth += 1;
    else if (t[i] === "(" && --depth === 0) {
      return { names: t.slice(0, i).trim(), nature: t.slice(i + 1, -1).trim() || null };
    }
  }
  return { names: t, nature: null };
}

export interface HeroPattern {
  slug: string;
  pattern: RegExp;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Nom de chaque heros en mot entier : « Yin » ne se trouve pas dans « Yinyang ». */
export function heroPatterns(list: readonly { slug: string; name: string }[]): HeroPattern[] {
  return list.map((h) => ({
    slug: h.slug,
    pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escape(h.name)}(?![\\p{L}\\p{N}])`, "iu"),
  }));
}

/**
 * Heros nommes dans une liste de noms, dans l'ordre de lecture. Un nom inclus
 * dans un nom plus long ne compte pas : « Sun » dans « Yi Sun-shin ».
 */
export function citedHeroes(names: string, patterns: readonly HeroPattern[], own?: string): string[] {
  const found = patterns.flatMap((m) => {
    const r = m.pattern.exec(names);
    return r ? [{ slug: m.slug, start: r.index, end: r.index + r[0].length }] : [];
  });
  found.sort((a, b) => b.end - b.start - (a.end - a.start));
  const kept: typeof found = [];
  for (const x of found) if (!kept.some((g) => x.start < g.end && g.start < x.end)) kept.push(x);
  return kept
    .filter((g) => g.slug !== own)
    .sort((a, b) => a.start - b.start)
    .map((g) => g.slug);
}

export interface LinkLore {
  /** Heros dont la fiche nomme l'autre. */
  de: string;
  to: string;
  /** Nature du lien selon la fiche de `de`, dans la langue de la page. */
  nature: string | null;
  natureEn: string | null;
  /** Nombre de heros nommes sur la meme ligne : « ennemis » a quinze pese moins que « frere ». */
  group: number;
}

type SheetRelations = { profile: { relations: string[]; affiliations: string[]; species: string | null } | null };

/** Liens d'une liste de heros, a partir de leurs fiches anglaises et de celles de la langue de la page. */
export function buildLinks(
  list: readonly { slug: string; name: string }[],
  en: Record<string, SheetRelations>,
  siteLocale: Record<string, SheetRelations>,
): LinkLore[] {
  const patterns = heroPatterns(list);
  const seen = new Set<string>();
  const links: LinkLore[] = [];
  for (const h of list) {
    const relations = en[h.slug]?.profile?.relations ?? [];
    const translated = siteLocale[h.slug]?.profile?.relations ?? [];
    relations.forEach((row, i) => {
      const { names, nature } = splitRelation(row);
      const cited = citedHeroes(names, patterns, h.slug);
      const natureLocale = translated.length === relations.length ? splitRelation(translated[i]).nature : null;
      for (const to of cited) {
        const key = `${h.slug}>${to}`;
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ de: h.slug, to, nature: natureLocale ?? nature, natureEn: nature, group: cited.length });
      }
    });
  }
  return links;
}

export interface LorePair {
  a: string;
  b: string;
  /** Ce que la fiche de `a` dit de `b`, et l'inverse ; null quand la fiche ne le nomme pas. */
  deA: LinkLore | null;
  deB: LinkLore | null;
  score: number;
}

/** Liens de parente, d'amour, d'amitie, de rivalite ou d'apprentissage, lus dans la nature anglaise. */
const NEARBY =
  /\b(brother|sister|sibling|father|mother|parent|son|daughter|twin|wife|husband|lover|love|crush|fianc|rival|mentor|master|student|disciple|apprentice|teacher|cousin|uncle|aunt|nephew|niece|grand|friend|adopt|guardian|partner)/i;

function weight(l: LinkLore | null): number {
  if (!l) return 0;
  return 1 + (l.group === 1 ? 2 : l.group === 2 ? 1 : 0) + (l.natureEn && NEARBY.test(l.natureEn) ? 2 : 0);
}

/**
 * Paires de heros liees, de la plus marquante a la plus diffuse : un lien
 * nomme des deux cotes, personnel et singulier, passe devant une liste
 * d'ennemis.
 */
export function pairsLore(links: readonly LinkLore[], names: ReadonlyMap<string, string>): LorePair[] {
  const pairs = new Map<string, LorePair>();
  for (const l of links) {
    const [a, b] = [l.de, l.to].sort();
    const key = `${a}|${b}`;
    const p = pairs.get(key) ?? { a, b, deA: null, deB: null, score: 0 };
    if (l.de === a) p.deA ??= l;
    else p.deB ??= l;
    pairs.set(key, p);
  }
  const name = (s: string) => names.get(s) ?? s;
  return [...pairs.values()]
    .map((p) => ({ ...p, score: weight(p.deA) + weight(p.deB) + (p.deA && p.deB ? 2 : 0) }))
    .sort((x, y) => y.score - x.score || name(x.a).localeCompare(name(y.a), "en") || name(x.b).localeCompare(name(y.b), "en"));
}

/** Les paires les plus marquantes, chaque heros n'apparaissant qu'une fois. */
export function pairsFeatured(pairs: readonly LorePair[], count: number): LorePair[] {
  const taken = new Set<string>();
  const chosen: LorePair[] = [];
  for (const p of pairs) {
    if (chosen.length >= count) break;
    if (taken.has(p.a) || taken.has(p.b)) continue;
    taken.add(p.a).add(p.b);
    chosen.push(p);
  }
  return chosen;
}

// ── Regions et factions ────────────────────────────────────────────

export interface RegionLore {
  /** Slug de la region, cle de son libelle (`heroData.region.<cle>`) et de son adresse. */
  key: string;
  /** Nom anglais du wiki. */
  name: string;
  heroes: Hero[];
}

/** Regions, de la plus peuplee a la moins peuplee ; heros par ordre alphabetique. */
export function groupByRegion(list: readonly Hero[]): RegionLore[] {
  const regions = new Map<string, RegionLore>();
  for (const h of list) {
    if (!h.region) continue;
    const key = keyValue(h.region);
    const r = regions.get(key) ?? { key, name: h.region, heroes: [] };
    r.heroes.push(h);
    regions.set(key, r);
  }
  return [...regions.values()]
    .map((r) => ({ ...r, heroes: [...r.heroes].sort((a, b) => a.name.localeCompare(b.name, "en")) }))
    .sort((a, b) => b.heroes.length - a.heroes.length || a.name.localeCompare(b.name, "en"));
}

export const regionsLore = groupByRegion(allHeroes);
export const regionByKey = new Map(regionsLore.map((r) => [r.key, r]));
export const heroNames = new Map(allHeroes.map((h) => [h.slug, h.name]));
const heroRegion = new Map(regionsLore.flatMap((r) => r.heroes.map((h) => [h.slug, r.key] as const)));
export const regionOf = (slug: string) => heroRegion.get(slug) ?? null;

const cacheLinks = new Map<Locale, LinkLore[]>();
export function linksLore(locale: Locale): LinkLore[] {
  let links = cacheLinks.get(locale);
  if (!links) {
    const en = stories("en") as unknown as Record<string, SheetRelations>;
    const siteLocale = stories(locale) as unknown as Record<string, SheetRelations>;
    links = buildLinks(allHeroes, en, siteLocale);
    cacheLinks.set(locale, links);
  }
  return links;
}

export const pairsOf = (locale: Locale) => pairsLore(linksLore(locale), heroNames);

/** Affiliation « contre » ou passee (« The Abyss (hostile) ») : un camp adverse, pas une faction. */
const HOSTILE = /hostile|enem|former/i;

export interface FactionLore {
  key: string;
  name: string;
  heroes: string[];
}

/**
 * Factions citees par au moins deux fiches, de la plus nombreuse a la plus
 * petite. Regroupees par leur nom anglais ; le libelle est celui que la
 * langue de la page donne le plus souvent.
 */
export function factionsLore(locale: Locale, minimum = 2): FactionLore[] {
  const en = stories("en");
  const siteLocale = stories(locale);
  const groups = new Map<string, { heroes: string[]; labels: Map<string, number> }>();
  for (const h of allHeroes) {
    const affiliations = en[h.slug]?.profile?.affiliations ?? [];
    const translated = siteLocale[h.slug]?.profile?.affiliations ?? [];
    affiliations.forEach((a, i) => {
      if (HOSTILE.test(a)) return;
      const key = keyValue(a);
      if (!key) return;
      const g = groups.get(key) ?? { heroes: [], labels: new Map<string, number>() };
      if (!g.heroes.includes(h.slug)) g.heroes.push(h.slug);
      const label = translated.length === affiliations.length ? translated[i] : a;
      g.labels.set(label, (g.labels.get(label) ?? 0) + 1);
      groups.set(key, g);
    });
  }
  return [...groups]
    .filter(([, g]) => g.heroes.length >= minimum)
    .map(([key, g]) => ({
      key,
      name: [...g.labels].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
      heroes: g.heroes.sort((a, b) => (heroNames.get(a) ?? a).localeCompare(heroNames.get(b) ?? b, "en")),
    }))
    .sort((a, b) => b.heroes.length - a.heroes.length || a.name.localeCompare(b.name));
}

const MONTH = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** « 26 October 2021 » → « 2021-10-26 », « January 2017 » → « 2017-01 », « 2016 » ; null pour « TBA ». */
export function heroReleaseKey(release: string | null): string | null {
  const m = release?.trim().match(/^(?:(\d{1,2}) )?(?:([A-Za-z]+) )?(\d{4})$/);
  if (!m) return null;
  const month = m[2] ? MONTH.indexOf(m[2].toLowerCase()) + 1 : 0;
  if (m[2] && month === 0) return m[3];
  if (!month) return m[3];
  const mm = String(month).padStart(2, "0");
  return m[1] ? `${m[3]}-${mm}-${m[1].padStart(2, "0")}` : `${m[3]}-${mm}`;
}

export interface SummaryRegion {
  roles: { role: Role; n: number }[];
  /** Premier et dernier heros de la region arrives dans le jeu. */
  first: Hero | null;
  last: Hero | null;
  factions: { name: string; n: number }[];
  species: { name: string; n: number }[];
  /** Paires de heros de la region liees entre elles. */
  internal: LorePair[];
  /** Paires qui relient la region aux autres. */
  external: LorePair[];
  neighbours: { key: string; n: number }[];
}

function tally<T>(values: T[]): [T, number][] {
  const m = new Map<T, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

/** Portrait d'une region, en chiffres tires des fiches : de quoi ecrire son resume sans rien inventer. */
export function summaryRegion(region: RegionLore, locale: Locale): SummaryRegion {
  const members = new Set(region.heroes.map((h) => h.slug));
  const en = stories("en");
  const siteLocale = stories(locale);

  const roles = tally(region.heroes.flatMap((h) => h.roles)).map(([role, n]) => ({ role, n }));
  const dates = region.heroes
    .map((h) => ({ h, key: heroReleaseKey(h.release) }))
    .filter((x): x is { h: Hero; key: string } => x.key !== null)
    .sort((a, b) => a.key.localeCompare(b.key) || a.h.name.localeCompare(b.h.name, "en"));

  const factions = factionsLore(locale)
    .map((f) => ({ name: f.name, n: f.heroes.filter((s) => members.has(s)).length }))
    .filter((f) => f.n >= 2)
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, 4);

  // Especes regroupees par leur nom anglais, affichees dans la langue de la page.
  const species = new Map<string, { name: string; n: number }>();
  for (const h of region.heroes) {
    const key = en[h.slug]?.profile?.species?.trim().toLowerCase();
    if (!key) continue;
    const e = species.get(key) ?? { name: siteLocale[h.slug]?.profile?.species ?? en[h.slug]!.profile!.species!, n: 0 };
    e.n += 1;
    species.set(key, e);
  }

  const pairs = pairsOf(locale);
  const internal = pairs.filter((p) => members.has(p.a) && members.has(p.b));
  const external = pairs.filter((p) => members.has(p.a) !== members.has(p.b));
  const neighbours = tally(external.map((p) => regionOf(members.has(p.a) ? p.b : p.a)).filter((c): c is string => !!c)).map(
    ([key, n]) => ({ key, n }),
  );

  return {
    roles,
    first: dates[0]?.h ?? null,
    last: dates.length > 1 ? dates[dates.length - 1].h : null,
    factions,
    species: [...species.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 3),
    internal,
    external,
    neighbours,
  };
}

/** Termes de recherche d'un heros sur le hub : nom, nom complet, titre et affiliations, sans casse ni accents. */
export function termsLore(h: Hero, locale: Locale, region: string): string {
  const sheet = stories(locale)[h.slug]?.profile;
  return keySearch([h.name, sheet?.fullName, sheet?.title, h.title, region, ...(sheet?.affiliations ?? [])].filter(Boolean).join(" "))
    .replace(/["\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
