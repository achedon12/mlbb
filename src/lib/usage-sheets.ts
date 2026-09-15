import { emblems, slugEmblem, battleSpells, type Emblem } from "@/data/emblems";
import visuals from "@/data/game/visuals.json";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { buildsPlayed, pickRatesByRank, type BuildPlayed } from "./data";
import { dateMeasure } from "./freshness";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";
import { site } from "./site";
import {
  buildersByChoice,
  partsByChoice,
  summaryByRank,
  usageByChoice,
  type BuilderRule,
  type Extract,
  type PartChoice,
  type SummaryRank,
  type UsageHero,
} from "./usage-builds";
import { keyChoice, visualItem } from "./build-visuals";

/**
 * Data for item, emblem and spell pages: who takes what, based on
 * the builds actually played (`buildsPlayed`), and the lists that set their
 * addresses. Computed once per type and per rank, at build time.
 */

const V = visuals as unknown as Record<"items" | "emblems" | "talents" | "spells", Record<string, string>>;

export const emblemsSheets = emblems.map((e) => ({
  slug: slugEmblem(e),
  emblem: e,
  image: V.emblems[e.key] ?? null,
}));

/** The API names the emblem by its role ("Marksman"); "All", the common emblem, has no page. */
function emblemOfBuild(name: string | null): Emblem | undefined {
  return name ? emblems.find((e) => e.role === name || e.name === name) : undefined;
}

/** Every spelling seen in played builds, by key: the fallback for untranslated names. */
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
  /** English in-game name. */
  name: string;
  cooldown: number | null;
  image: string | null;
}

/** Hand-described spells, completed with those played builds mention without a description. */
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

/** Heroes taking this choice at the requested rank, the most committed first. */
export function usage(type: TypeChoice, key: string, rank: MeasuredRank = "all"): UsageHero[] {
  const k = `${type}|${rank}`;
  let byChoice = usages.get(k);
  if (!byChoice) {
    byChoice = usageByChoice(buildsPlayed, EXTRACT[type], rank);
    usages.set(k, byChoice);
  }
  return byChoice.get(key) ?? [];
}

/**
 * Rule naming the heroes who build a choice the most, for the item page title,
 * description and its "top builders" list.
 *
 * - High ranks only (Mythic, Mythic Honor, Mythic Glory), averaged: that is
 *   what "best build" searches expect, and three ranks smooth one noisy table.
 * - A hero must average at least 0.15% of picks there (all heroes sum to
 *   100%, so about 1.5% of games): it leaves out the fourteen or so least played
 *   heroes, whose three most played builds rest on few games. It is lower than
 *   the tier list's reliability bar (0.3%) because a build share of 10 to 50%
 *   needs fewer games to settle than a win rate gap of a few points, and
 *   often-banned heroes (Marcel) have a low pick rate for other reasons.
 * - The choice must weigh at least 5% of the hero's games in that lane: under
 *   it, the item only appears in a marginal third build.
 */
export const BUILDER_RULE: BuilderRule = { ranks: ["mythic", "honor", "glory"], minPickRate: 0.15, minSelection: 5 };

const builders = new Map<TypeChoice, Map<string, UsageHero[]>>();

/** Heroes who build this choice the most at high ranks (`BUILDER_RULE`), the most committed first. */
export function topBuilders(type: TypeChoice, key: string): UsageHero[] {
  let byChoice = builders.get(type);
  if (!byChoice) {
    byChoice = buildersByChoice(buildsPlayed, pickRatesByRank, EXTRACT[type], BUILDER_RULE);
    builders.set(type, byChoice);
  }
  return byChoice.get(key) ?? [];
}

export function summaryRanks(type: TypeChoice, key: string): SummaryRank[] {
  return summaryByRank(Object.fromEntries(MEASURED_RANKS.map((r) => [r, usage(type, key, r)])));
}

/** Talents taken with an emblem, tier by tier (two attributes, then the core talent). */
export function talentsWithEmblem(slug: string): PartChoice[][] {
  return [0, 1, 2].map((level) =>
    partsByChoice(buildsPlayed, includes("emblem", slug), (b) => (b.talents[level] ? [keyChoice(b.talents[level])] : [])),
  );
}

/** Distribution of another choice type among builds that contain this one. */
export function partsWith(type: TypeChoice, key: string, other: TypeChoice): PartChoice[] {
  return partsByChoice(buildsPlayed, includes(type, key), EXTRACT[other]);
}

/** Text of an emblem, talent or spell (`emblemData`), or the provided fallback. */
export function textChoice(t: T, key: string, field: string, fallback: string | null = null): string | null {
  const k = `emblemData.${key}.${field}`;
  const v = t(k);
  return v === k ? fallback : v;
}

export const nameTalent = (t: T, key: string) => textChoice(t, key, "name", namesPlayed.get(key) ?? key)!;
export const imageTalent = (key: string) => V.talents[key] ?? null;

const absolute = (path: string) => (/^https?:/.test(path) ? path : `${site.url}${path}`);

/**
 * Structured data of an item, emblem or spell page: the page, the
 * thing it describes, and the ordered list of heroes that take it the most.
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
