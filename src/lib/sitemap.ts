import type { MetadataRoute } from "next";
import watch from "@/data/game/watch.json";
import { counters, allHeroes, modesSlugs, itemsFor, patchDetails, sync } from "@/lib/data";
import { duos } from "@/lib/duos";
import { ranksByPair } from "@/lib/pairs";
import { emblemsSheets, spellSheets } from "@/lib/usage-sheets";
import { calendarYears } from "@/lib/skin-catalog-server";
import { regionsLore } from "@/lib/lore";
import { heroesWithSkins } from "@/lib/hero-skins";
import { articles } from "@/lib/content";
import { ROLES } from "@/lib/draft";
import { pathFilter, pathRole, FILTERS_LANE, FILTERS_ROLE } from "@/lib/tier-list-filters";
import { site } from "@/lib/site";
import { measure, RANKS_CLASSES } from "@/lib/tier-list";
import { LOCALES } from "@/i18n/config";
import { monthKeys } from "@/lib/events-server";
import { CHECKED_ON } from "@/lib/objectives";
import { esportsUpdatedAt, tournaments } from "@/lib/esports";
import { advanceSyncedAt, advanceVersion, advanceVersionNumbers, advanceVersions } from "@/lib/advance-server";

/**
 * Multilingual sitemap, split by page type.
 *
 * `/sitemap.xml` is a sitemap index (`src/app/sitemap.xml/route.ts`) listing
 * one child sitemap per page type (`src/app/sitemaps/[name]/route.ts`), so
 * Search Console reports indexing per type: compare pages, hero sub-pages and
 * items each get their own coverage figures. The entries are built once here
 * and only distributed between the children.
 *
 * Every page exists in every language, under its prefix (`/fr/heroes`…): we
 * emit one entry per language. The versions of a page are linked by the
 * `hreflang` of its HTML head (`metaLocales`), not here: Google only asks for
 * one declaration, and the `xhtml:link` links made browsers display the sitemap
 * as a block of text rather than as an XML tree.
 *
 * `lastModified` says when the content really changed: the rate measurement
 * date for statistics pages, the patch date for its notes, the article's
 * date, the sync date for the other game data. Fixed
 * texts (legal notice, privacy…) carry none: a date that
 * moved every day for no reason would teach engines to ignore it.
 */
type Path = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
  lastModified?: Date;
};

/** YYYY-MM-DD or full ISO date; nothing for a missing or unreadable date. */
function dateOf(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** The most recent of several ISO dates. */
const newest = (...isos: (string | null | undefined)[]) =>
  dateOf(isos.filter((d): d is string => !!d).sort().at(-1));

/** Every sitemap entry, all page types together, in a stable order. */
export function sitemapEntries(): MetadataRoute.Sitemap {
  const measuredDate = dateOf(measure);
  const synced = dateOf(sync.date);
  const news = articles("news");
  const analysesPatch = articles("patch-notes");
  const patches = Object.values(patchDetails);

  const statistics = (path: string, changeFrequency: Path["changeFrequency"], priority: number): Path => ({
    path,
    changeFrequency,
    priority,
    lastModified: measuredDate,
  });

  const paths: Path[] = [
    statistics("", "daily", 1),
    statistics("/heroes", "weekly", 0.9),
    statistics("/tier-list", "daily", 0.9),
    statistics("/meta", "daily", 0.8),
    statistics("/compare", "weekly", 0.7),
    statistics("/draft", "weekly", 0.8),
    statistics("/tools/team", "weekly", 0.7),
    statistics("/items", "weekly", 0.7),
    statistics("/emblems", "weekly", 0.7),
    { path: "/tools/win-rate", changeFrequency: "yearly", priority: 0.6 },
    { path: "/tools/retribution", changeFrequency: "monthly", priority: 0.6, lastModified: synced },
    { path: "/tools/tier-list-maker", changeFrequency: "monthly", priority: 0.6, lastModified: measuredDate },
    { path: "/quiz", changeFrequency: "daily", priority: 0.6 },
    { path: "/mlbbdle", changeFrequency: "daily", priority: 0.6 },
    // Objective timings, dated by the day they were checked on the wiki.
    { path: "/tools/timer", changeFrequency: "monthly", priority: 0.6, lastModified: dateOf(CHECKED_ON) },
    { path: "/map", changeFrequency: "monthly", priority: 0.6, lastModified: dateOf(CHECKED_ON) },
    { path: "/tools/nickname", changeFrequency: "yearly", priority: 0.5 },
    { path: "/tools/draw-calculator", changeFrequency: "yearly", priority: 0.5 },
    { path: "/tools/build", changeFrequency: "monthly", priority: 0.6, lastModified: synced },
    { path: "/builds", changeFrequency: "daily", priority: 0.5 },
    // Monthly skin calendar: one page per month the data documents.
    { path: "/events", changeFrequency: "weekly", priority: 0.7, lastModified: synced },
    ...monthKeys().map((month) => ({
      path: `/events/${month}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
      lastModified: synced,
    })),
    // Esports hub and one page per covered tournament, dated by the last refresh.
    { path: "/esports", changeFrequency: "weekly", priority: 0.6, lastModified: dateOf(esportsUpdatedAt) },
    ...tournaments.map((t) => ({
      path: `/esports/${t.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
      lastModified: dateOf(esportsUpdatedAt),
    })),
    // Advance Server notes, dated by the version they describe.
    {
      path: "/patch-notes/advance-server",
      changeFrequency: "weekly",
      priority: 0.5,
      lastModified: dateOf(advanceVersions("en")[0]?.date ?? advanceSyncedAt),
    },
    ...advanceVersionNumbers.map((version) => ({
      path: `/patch-notes/advance-server/${version}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
      lastModified: dateOf(advanceVersion("en", version)?.date),
    })),
    { path: "/tools/collection", changeFrequency: "monthly", priority: 0.5, lastModified: synced },
    { path: "/lore", changeFrequency: "monthly", priority: 0.6, lastModified: synced },
    ...regionsLore.map((r) => ({
      path: `/lore/${r.key}`,
      changeFrequency: "monthly" as const,
      priority: 0.4,
      lastModified: synced,
    })),
    { path: "/skins/calendar", changeFrequency: "weekly", priority: 0.6, lastModified: synced },
    ...calendarYears().map((year) => ({
      path: `/skins/calendar/${year}`,
      changeFrequency: "monthly" as const,
      priority: 0.4,
      lastModified: synced,
    })),
    { path: "/tools/server-time", changeFrequency: "weekly", priority: 0.6, lastModified: synced },
    { path: "/ranks", changeFrequency: "weekly", priority: 0.6, lastModified: measuredDate },
    { path: "/game-modes", changeFrequency: "monthly", priority: 0.6, lastModified: synced },
    { path: "/news", changeFrequency: "daily", priority: 0.8, lastModified: dateOf(news[0]?.date) },
    { path: "/watch", changeFrequency: "hourly", priority: 0.6, lastModified: dateOf(watch.measuredAt) },
    {
      path: "/patch-notes",
      changeFrequency: "weekly",
      priority: 0.8,
      lastModified: newest(...patches.map((p) => p.date), analysesPatch[0]?.date),
    },
    { path: "/api-doc", changeFrequency: "monthly", priority: 0.5, lastModified: synced },
    { path: "/contribute", changeFrequency: "monthly", priority: 0.4, lastModified: synced },
    { path: "/about", changeFrequency: "yearly", priority: 0.3 },
    { path: "/legal", changeFrequency: "yearly", priority: 0.2 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
    ...RANKS_CLASSES.filter((r) => r !== "all").map((r) => statistics(`/tier-list/${r}`, "daily", 0.7)),
    ...[...FILTERS_LANE, ...FILTERS_ROLE].map((f) => statistics(pathFilter(f), "daily", 0.7)),
    ...ROLES.map((r) => statistics(pathRole(r), "weekly", 0.6)),
    ...modesSlugs.map((slug) => ({
      path: `/game-modes/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
      lastModified: synced,
    })),
    ...allHeroes.map((h) => statistics(`/heroes/${h.slug}`, "weekly", 0.6)),
    // Pages derived from the measurements: dated by the measurement, like hero pages.
    ...allHeroes.filter((h) => counters[h.slug]).map((h) => statistics(`/heroes/${h.slug}/counters`, "weekly", 0.6)),
    ...allHeroes.filter((h) => duos[h.slug]).map((h) => statistics(`/heroes/${h.slug}/duos`, "weekly", 0.5)),
    // Duels: only pairs measured at two ranks at least, the others
    // stay reachable but too thin to be offered to engines.
    ...[...ranksByPair(counters, (s) => allHeroes.some((h) => h.slug === s))]
      .filter(([, n]) => n >= 2)
      .map(([segment]) => statistics(`/compare/${segment}`, "weekly", 0.4)),
    ...itemsFor("en").map((o) => statistics(`/items/${o.slug}`, "weekly", 0.5)),
    ...emblemsSheets.map((e) => statistics(`/emblems/${e.slug}`, "weekly", 0.5)),
    statistics("/spells", "monthly", 0.5),
    ...spellSheets.map((spell) => statistics(`/spells/${spell.slug}`, "weekly", 0.4)),
    statistics("/statistics", "daily", 0.8),
    ...RANKS_CLASSES.filter((r) => r !== "all").map((r) => statistics(`/statistics/${r}`, "daily", 0.6)),
    { path: "/skins", changeFrequency: "weekly", priority: 0.6, lastModified: synced },
    ...heroesWithSkins.map((h) => ({
      path: `/heroes/${h.slug}/skins`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
      lastModified: synced,
    })),
    ...patches.map((p) => ({
      path: `/patch-notes/${p.version}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      lastModified: dateOf(p.date) ?? synced,
    })),
    ...([["news", news], ["patch-notes", analysesPatch]] as const).flatMap(([route, list]) =>
      list.map((a) => ({
        path: `/${route}/${a.slug}`,
        changeFrequency: "yearly" as const,
        priority: 0.7,
        lastModified: dateOf(a.date),
      })),
    ),
  ];

  // For each path, one URL per language; the hreflang live in the pages.
  return paths.flatMap(({ path, changeFrequency, priority, lastModified }) =>
    LOCALES.map((l) => ({
      url: `${site.url}/${l}${path}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency,
      priority,
    })),
  );
}

/**
 * Child sitemaps, in index order. Each groups one page type, so a single
 * sitemap answers "does Google index these pages?". A path belongs to the first
 * group whose pattern matches its locale-less form (`/heroes/lolita/duos`);
 * `pages` has no pattern and takes the rest: home, hubs, tools, fixed texts,
 * lore, game modes, esports, skin calendars.
 */
export const SITEMAPS = [
  { name: "pages", pattern: null },
  { name: "tier-lists", pattern: /^\/(tier-list|statistics)(\/|$)/ },
  { name: "heroes", pattern: /^\/heroes\/[^/]+$/ },
  { name: "hero-counters", pattern: /^\/heroes\/[^/]+\/counters$/ },
  { name: "hero-duos", pattern: /^\/heroes\/[^/]+\/duos$/ },
  { name: "hero-skins", pattern: /^\/heroes\/[^/]+\/skins$/ },
  { name: "compare", pattern: /^\/compare\/[^/]+$/ },
  { name: "items", pattern: /^\/items\/[^/]+$/ },
  { name: "emblems-spells", pattern: /^\/(emblems|spells)\/[^/]+$/ },
  { name: "events", pattern: /^\/events\/[^/]+$/ },
  { name: "patch-notes", pattern: /^\/patch-notes\/.+$/ },
  { name: "news", pattern: /^\/news\/.+$/ },
] as const satisfies readonly { name: string; pattern: RegExp | null }[];

export type SitemapName = (typeof SITEMAPS)[number]["name"];

/** Google's cap per sitemap (the 50 MB cap is far off: about 170 bytes per entry). */
export const MAX_SITEMAP_URLS = 50_000;

/** Public address of a child sitemap. */
export const sitemapUrl = (name: SitemapName) => `${site.url}/sitemaps/${name}.xml`;

/** Group of a sitemap URL, from its path without the locale prefix. */
export function sitemapGroupOf(url: string): SitemapName {
  const path = new URL(url).pathname.replace(/^\/[^/]+/, "");
  return SITEMAPS.find((s) => s.pattern?.test(path))?.name ?? "pages";
}

let grouped: Map<SitemapName, MetadataRoute.Sitemap> | null = null;

/** Entries of every child sitemap, keeping the order of `sitemapEntries`. */
export function sitemapGroups(): Map<SitemapName, MetadataRoute.Sitemap> {
  if (grouped) return grouped;
  const groups = new Map<SitemapName, MetadataRoute.Sitemap>(SITEMAPS.map((s) => [s.name, []]));
  for (const entry of sitemapEntries()) groups.get(sitemapGroupOf(entry.url))!.push(entry);
  grouped = groups;
  return groups;
}

const iso = (date: string | Date) => (date instanceof Date ? date.toISOString() : date);

/**
 * `<urlset>` document, serialized exactly as Next serializes a `sitemap.ts`
 * route (same layout, same fields), so moving the entries into child sitemaps
 * changes nothing in them.
 */
export function renderUrlset(entries: MetadataRoute.Sitemap): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const entry of entries) {
    xml += `<url>\n<loc>${entry.url}</loc>\n`;
    if (entry.lastModified) xml += `<lastmod>${iso(entry.lastModified)}</lastmod>\n`;
    if (entry.changeFrequency) xml += `<changefreq>${entry.changeFrequency}</changefreq>\n`;
    if (typeof entry.priority === "number") xml += `<priority>${entry.priority}</priority>\n`;
    xml += "</url>\n";
  }
  return `${xml}</urlset>\n`;
}

/**
 * `<sitemapindex>` document listing every non-empty child. Each child's
 * `lastmod` is the newest `lastmod` of its entries, omitted when none has one.
 */
export function renderSitemapIndex(): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const [name, entries] of sitemapGroups()) {
    if (entries.length === 0) continue;
    const latest = entries
      .map((e) => (e.lastModified ? iso(e.lastModified) : null))
      .filter((d): d is string => d !== null)
      .sort((a, b) => Date.parse(a) - Date.parse(b))
      .at(-1);
    xml += `<sitemap>\n<loc>${sitemapUrl(name)}</loc>\n`;
    if (latest) xml += `<lastmod>${latest}</lastmod>\n`;
    xml += "</sitemap>\n";
  }
  return `${xml}</sitemapindex>\n`;
}
