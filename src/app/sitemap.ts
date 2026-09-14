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
 * Plan du site, multilingue.
 *
 * Chaque page existe dans chaque langue, sous son prefixe (`/fr/heroes`…) : on
 * emet une entree par langue. Les versions d'une meme page sont reliees par les
 * `hreflang` de son en-tete HTML (`metaLangues`), pas ici : Google n'en demande
 * qu'une declaration, et les liens `xhtml:link` faisaient afficher le plan par
 * les navigateurs comme un bloc de texte plutot que comme un arbre XML.
 *
 * `lastModified` dit quand le contenu a vraiment change : date du releve des
 * taux pour les pages de statistiques, date du patch pour ses notes, date de
 * l'article, date de synchronisation pour les autres donnees du jeu. Les
 * textes fixes (mentions, confidentialite…) n'en portent pas : une date qui
 * bougerait chaque jour sans raison apprendrait aux moteurs a l'ignorer.
 */
type Path = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
  lastModified?: Date;
};

/** Date AAAA-MM-JJ ou ISO complete ; rien pour une date absente ou illisible. */
function dateOf(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** La plus recente de plusieurs dates ISO. */
const newest = (...isos: (string | null | undefined)[]) =>
  dateOf(isos.filter((d): d is string => !!d).sort().at(-1));

export default function sitemap(): MetadataRoute.Sitemap {
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
    // Pages derivees des mesures : datees du releve, comme les fiches.
    ...allHeroes.filter((h) => counters[h.slug]).map((h) => statistics(`/heroes/${h.slug}/counters`, "weekly", 0.6)),
    ...allHeroes.filter((h) => duos[h.slug]).map((h) => statistics(`/heroes/${h.slug}/duos`, "weekly", 0.5)),
    // Duels : seules les paires mesurees a deux rangs au moins, les autres
    // restent accessibles mais trop minces pour etre proposees aux moteurs.
    ...[...ranksByPair(counters, (s) => allHeroes.some((h) => h.slug === s))]
      .filter(([, n]) => n >= 2)
      .map(([segment]) => statistics(`/compare/${segment}`, "weekly", 0.4)),
    ...itemsFor("en").map((o) => statistics(`/items/${o.slug}`, "weekly", 0.5)),
    ...emblemsSheets.map((e) => statistics(`/emblems/${e.slug}`, "weekly", 0.5)),
    statistics("/spells", "monthly", 0.5),
    ...spellSheets.map((sort) => statistics(`/spells/${sort.slug}`, "weekly", 0.4)),
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

  // Pour chaque chemin, une URL par langue ; les hreflang vivent dans les pages.
  return paths.flatMap(({ path, changeFrequency, priority, lastModified }) =>
    LOCALES.map((l) => ({
      url: `${site.url}/${l}${path}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency,
      priority,
    })),
  );
}
