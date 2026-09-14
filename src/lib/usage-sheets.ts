import { emblems, slugEmblem, battleSpells, type Emblem } from "@/data/emblems";
import visuals from "@/data/game/visuals.json";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { buildsPlayed, type BuildPlayed } from "./data";
import { dateMeasure } from "./freshness";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";
import { site } from "./site";
import {
  partsByChoice,
  summaryByRank,
  usageByChoice,
  type Extract,
  type PartChoice,
  type SummaryRank,
  type UsageHero,
} from "./usage-builds";
import { keyChoice, visualItem } from "./build-visuals";

/**
 * Donnees des pages d'objet, d'embleme et de sort : qui prend quoi, d'apres
 * les builds reellement joues (`buildsJoues`), et les listes qui fixent leurs
 * adresses. Calculs faits une fois par type et par rang, au build.
 */

const V = visuals as unknown as Record<"items" | "emblems" | "talents" | "spells", Record<string, string>>;

export const emblemsSheets = emblems.map((e) => ({
  slug: slugEmblem(e),
  emblem: e,
  image: V.emblems[e.key] ?? null,
}));

/** L'API nomme l'embleme par son role (« Marksman ») ; « All », l'embleme commun, n'a pas de fiche. */
function emblemOfBuild(name: string | null): Emblem | undefined {
  return name ? emblems.find((e) => e.role === name || e.name === name) : undefined;
}

/** Toutes les graphies vues dans les builds joues, par cle : le repli des noms sans traduction. */
const namesPlayed = new Map<string, string>();
for (const byLane of Object.values(buildsPlayed)) {
  for (const byRank of Object.values(byLane)) {
    for (const list of Object.values(byRank)) {
      for (const b of list ?? []) {
        if (b.spell) namesPlayed.set(keyChoice(b.spell), b.spell);
        for (const talent of b.talents) namesPlayed.set(keyChoice(talent), talent);
      }
    }
  }
}

export interface SpellSheet {
  slug: string;
  /** Nom anglais du jeu. */
  name: string;
  cooldown: number | null;
  image: string | null;
}

/** Sorts decrits a la main, completes de ceux que les builds joues citent sans description. */
export const spellSheets: SpellSheet[] = [
  ...new Set([...battleSpells.map((s) => s.key), ...[...namesPlayed.keys()].filter((k) => V.spells[k])]),
]
  .map((slug) => {
    const s = battleSpells.find((x) => x.key === slug);
    return { slug, name: s?.name ?? namesPlayed.get(slug) ?? slug, cooldown: s?.cooldown ?? null, image: V.spells[slug] ?? null };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export type TypeChoice = "item" | "emblem" | "spell";

const EXTRACT: Record<TypeChoice, Extract> = {
  item: (b) => b.items.flatMap((name) => visualItem(name).slug ?? []),
  emblem: (b) => {
    const e = emblemOfBuild(b.emblem);
    return e ? [slugEmblem(e)] : [];
  },
  spell: (b) => (b.spell ? [keyChoice(b.spell)] : []),
};

const includes = (type: TypeChoice, key: string) => (b: BuildPlayed) => [...EXTRACT[type](b)].includes(key);

const usages = new Map<string, Map<string, UsageHero[]>>();

/** Heros qui prennent ce choix au rang demande, le plus engage d'abord. */
export function usage(type: TypeChoice, key: string, rank: MeasuredRank = "all"): UsageHero[] {
  const k = `${type}|${rank}`;
  let byChoice = usages.get(k);
  if (!byChoice) {
    byChoice = usageByChoice(buildsPlayed, EXTRACT[type], rank);
    usages.set(k, byChoice);
  }
  return byChoice.get(key) ?? [];
}

export function summaryRanks(type: TypeChoice, key: string): SummaryRank[] {
  return summaryByRank(Object.fromEntries(MEASURED_RANKS.map((r) => [r, usage(type, key, r)])));
}

/** Talents pris avec un embleme, etage par etage (deux attributs, puis le talent decisif). */
export function talentsWithEmblem(slug: string): PartChoice[][] {
  return [0, 1, 2].map((level) =>
    partsByChoice(buildsPlayed, includes("emblem", slug), (b) => (b.talents[level] ? [keyChoice(b.talents[level])] : [])),
  );
}

/** Repartition d'un autre type de choix parmi les builds qui contiennent celui-ci. */
export function partsWith(type: TypeChoice, key: string, other: TypeChoice): PartChoice[] {
  return partsByChoice(buildsPlayed, includes(type, key), EXTRACT[other]);
}

/** Texte d'un embleme, talent ou sort (`emblemData`), ou le repli fourni. */
export function textChoice(t: T, key: string, field: string, fallback: string | null = null): string | null {
  const k = `emblemData.${key}.${field}`;
  const v = t(k);
  return v === k ? fallback : v;
}

export const nameTalent = (t: T, key: string) => textChoice(t, key, "name", namesPlayed.get(key) ?? key)!;
export const imageTalent = (key: string) => V.talents[key] ?? null;

const absolute = (path: string) => (/^https?:/.test(path) ? path : `${site.url}${path}`);

/**
 * Donnees structurees d'une page d'objet, d'embleme ou de sort : la page, la
 * chose qu'elle decrit, et la liste ordonnee des heros qui la prennent le plus.
 */
export function dataSheet(
  locale: Locale,
  o: {
    title: string;
    description: string;
    path: string;
    name: string;
    summary?: string | null;
    image: string | null;
    listName: string;
    heroes: { name: string; slug: string }[];
  },
) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: o.title,
    description: o.description,
    url: `${site.url}/${locale}${o.path}`,
    inLanguage: LOCALE_HTML[locale],
    dateModified: dateMeasure,
    isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
    ...(o.image ? { primaryImageOfPage: { "@type": "ImageObject", url: absolute(o.image) } } : {}),
    about: {
      "@type": "Thing",
      name: o.name,
      ...(o.summary ? { description: o.summary } : {}),
      ...(o.image ? { image: absolute(o.image) } : {}),
    },
    ...(o.heroes.length
      ? {
          mainEntity: {
            "@type": "ItemList",
            name: o.listName,
            numberOfItems: o.heroes.length,
            itemListOrder: "https://schema.org/ItemListOrderDescending",
            itemListElement: o.heroes.map((h, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: h.name,
              url: `${site.url}/${locale}/heroes/${h.slug}`,
            })),
          },
        }
      : {}),
  };
}
