import { LiquipediaPatchNote } from "@/components/patch-credit";
import { PageSourcesBlock } from "@/components/page-sources";
import { newestFirst } from "@/lib/patch-version";
import { DiscordInvite } from "@/components/discord-invite";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ExtendMessages } from "@/i18n/provider";
import { LOCALE_HTML } from "@/i18n/config";
import { serializeJsonLd } from "@/lib/html";
import Image from "next/image";
import Link from "@/components/link";
import { ShieldAlert, Swords, TriangleAlert } from "lucide-react";
import { FavouriteButton } from "@/components/favourite-button";
import { HeroSkills } from "@/components/hero-skills";
import { HeroCombos } from "@/components/hero-combos";
import { HeroStory } from "@/components/hero-story";
import { Breadcrumb } from "@/components/breadcrumb";

import { TeammatesByRank, MeasuredCounters } from "@/components/measured-counters";
import { RankProvider, RankPicker, ValueByRank } from "@/components/rank-picker";
import { BuildItem } from "@/components/build-item";
import { BuildsByRank } from "@/components/builds-by-rank";
import { BuildPicker } from "@/components/build-picker";
import { COMMON_EMBLEM, packBuilds, resolveBuild, resolveGuide, visualEmblem, visualItem, spellVisual, visualTalent } from "@/lib/build-visuals";
import { heroGallery } from "@/lib/hero-skins";
import { duos } from "@/lib/duos";
import { HeroAdjustmentsDeferred, HeroStatisticsDeferred } from "@/components/hero-statistics-deferred";
import { NextPatch } from "@/components/next-patch";
import { HeroProStats } from "@/components/hero-pro-stats";
import { durationOf, historyOf, trendsOf } from "@/lib/evolution";
import { Tabs } from "@/components/tabs";
import { ScrollDepth } from "@/components/scroll-depth";
import { HeroFeedLink } from "@/components/hero-feed-link";
import { HeroGlance } from "@/components/hero-glance";
import { DailyDle } from "@/components/daily-dle";

import {
  ShowcaseArt,
  ShowcasePortrait,
  ShowcaseProvider,
  SkinShowcase,
  type SkinFull,
} from "@/components/skin-showcase";
import { BadgeTier, Card, Gauge, Score } from "@/components/ui";
import { HeroPortrait } from "@/components/hero-portrait";
import { RoleBadge } from "@/components/role-badge";
import { DexSays } from "@/components/mascot";
import { dexReaction } from "@/lib/dex-reaction";
import { Cascade, PosterParallax } from "@/components/hero-cinematic";
import { accentStyle, heroAccent } from "@/lib/hero-accent";
import { heroMorph } from "@/lib/hero-morph";
import { faqPageData, heroAnswer, heroFaq, heroKind, type HeroFacts } from "@/lib/structured-data";
import {
  buildsPlayed,
  teammates,
  combos,
  skills,
  type CounterFigure,
  counters,
  guidesPlayers,
  allHeroes,
  heroesBySlug,
  stories,
  illustrations,
  itemsFor,
  patchDetails,
  detailedPatches,
  visualsSkills,
  analysisFor,
} from "@/lib/data";
import { emblems } from "@/data/emblems";
import { rankingFull, statsByRank, rateBySlug, type StatsRank } from "@/lib/tier-list";
import { MEASURED_RANKS, type MeasuredRank } from "@/lib/measured-ranks";
import { pathRole } from "@/lib/tier-list-filters";
import { site, absoluteUrl } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import { createT, messagesPage, type T } from "@/i18n/translations";
import { releaseDate, heroLabel } from "@/i18n/hero-data";
import { normalizeNameSkin, mapValues } from "@/lib/utils";
import { metaPage, TITLE_MAX, notFoundMetadata } from "@/i18n/seo";
import { FreshnessLine } from "@/components/freshness";
import { longDate, dateMeasure, listNames, patchCurrent, percentage } from "@/lib/freshness";
import { formatGap } from "@/lib/trends";
import type { BucketDuration } from "@/lib/evolution";
import type { Hero } from "@/lib/types";
import { NotFoundPage } from "@/components/not-found-page";
import { ReportError } from "@/components/report-error";

/** Tab anchors before they were named in English: shared links still open their tab. */
const TAB_ALIASES = { analyse: "analysis", histoire: "story", competences: "skills", contres: "counters" };

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/** One page per hero, generated at build time (in `PRERENDERED_LOCALES`; the other languages on first request). */
export function generateStaticParams() {
  return allHeroes.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) return notFoundMetadata(locale);

  const tm = createT(locale);
  const tier = rateBySlug.get(h.slug)?.tier;
  const v = patchCurrent.version;
  return metaPage(locale, {
    // Title modeled on searches ("aamon build", "aamon emblem",
    // "aamon counter"), with the tier and the patch: the results that
    // carry a freshness marker are the ones that get clicked. The epithet stays
    // on the page.
    // A long name ("Popol and Kupa") drops the tier rather than have the
    // patch cut off in the results.
    title: titleHero(tm, h.name, tier, v),
    description: descriptionHero(locale, h),
    path: `/heroes/${slug}`,
    type: "article",
    image: `/${locale}/heroes/${slug}/opengraph-image`,
  });
}

/** Title with the tier when it fits in `TITLE_MAX`, otherwise without it. */
function titleHero(t: T, name: string, tier: string | undefined, v: string): string {
  const withTier = tier ? t("pages.seo.hero.title", { name, tier, v }) : null;
  return withTier && withTier.length <= TITLE_MAX ? withTier : t("pages.seo.hero.titleNoTier", { name, v });
}

/** Most played build on the hero's main lane, all ranks. */
function buildMain(h: Hero) {
  const byLane = buildsPlayed[h.slug] ?? {};
  const lane = h.lanes.find((l) => byLane[l]) ?? Object.keys(byLane)[0];
  return lane ? (byLane[lane]?.all?.[0] ?? null) : null;
}

/**
 * Description in data sentences, like the snippets that get clicked: who
 * counters the hero (at Mythic when that rank is measured), its most
 * played build, its win rate and its tier, then the measurement date. Without
 * any measurement, the general overview.
 */
function descriptionHero(locale: Locale, h: Hero): string {
  const t = createT(locale);
  const sentences: string[] = [];

  const byRank = counters[h.slug] ?? {};
  const rank: MeasuredRank | null = byRank.mythic?.weak.length ? "mythic" : byRank.all?.weak.length ? "all" : null;
  if (rank) {
    const names = listNames(locale, byRank[rank]!.weak.slice(0, 3).map((c) => heroesBySlug.get(c.slug)?.name ?? c.slug));
    sentences.push(
      rank === "all"
        ? t("pages.seo.hero.countersAll", { name: h.name, counters: names })
        : t("pages.seo.hero.counters", { name: h.name, counters: names, rank: t(`measuredRanks.${rank}`) }),
    );
  }

  const build = buildMain(h);
  if (build?.items.length) {
    const namesItems = new Map(itemsFor(locale).map((o) => [o.slug, o.name]));
    const list = build.items.map((o) => namesItems.get(visualItem(o).slug ?? "") ?? o).join(", ");
    const role = build.emblem ? t(`roles.${build.emblem}`) : null;
    sentences.push(
      build.emblem
        ? t("pages.seo.hero.buildEmblem", {
            items: list,
            emblem: role === `roles.${build.emblem}` ? build.emblem : role!,
          })
        : t("pages.seo.hero.build", { items: list }),
    );
  }

  const rate = rateBySlug.get(h.slug);
  if (rate) sentences.push(t("pages.seo.hero.rate", { winRate: percentage(locale, rate.win), tier: rate.tier }));

  if (sentences.length > 0) return [...sentences, `${t("pages.freshness.updatedOn", { date: longDate(locale) })}.`].join(" ");

  // Without measurements, the written summary, in the page's language; a hero
  // without an analysis takes the generated description.
  return (
    analysisFor(h.analysis, locale)?.summary ??
    t("pages.heroDetail.metaDescription", {
      name: h.title ? `${h.name}, ${h.title}` : h.name,
      roles: h.roles.map((r) => t(`roles.${r}`)).join(" / "),
      lanes: h.lanes.map((l) => t(`lanes.${l}`)).join(", ") || "—",
      skins: h.skins.length,
    })
  );
}

export default async function HeroPage({ params }: Params) {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) return <NotFoundPage />;

  const rankedEntry = rankingFull.find((e) => e.hero.slug === slug);
  const t = createT(locale);
  const analysis = analysisFor(h.analysis, locale);
  const skillsWiki = skills(locale)[h.slug] ?? [];
  const iconsSkills = visualsSkills[h.slug] ?? {};
  const illustrationsHero = illustrations[h.slug] ?? {};
  // The original skin's illustration serves as background: it is the one that
  // shows the hero as met by default.
  const background = Object.values(illustrationsHero)[0] ?? null;
  // The hero's colour, from the artwork shown as the poster (already filtered).
  const accent = heroAccent(background);
  const story = stories(locale)[h.slug] ?? null;
  const hasStory =
    !!story && (story.lore.length > 0 || !!story.profile || story.trivia.length > 0);

  // Join of the three sources: the skin carries its id, its portrait (by id) and
  // its illustration (by name). The showcase uses it to keep everything in sync.
  // The illustration is also matched by normalized name: the wiki's caption
  // does not always have the module's casing ("Vessel Of Deceit").
  const illustrationByName = new Map(
    Object.entries(illustrationsHero).map(([name, path]) => [normalizeNameSkin(name), path]),
  );
  const skinsFull: SkinFull[] = h.skins.map((s) => ({
    ...s,
    portrait: h.images.skins[s.id] ?? null,
    illustration:
      illustrationsHero[s.name] ?? illustrationByName.get(normalizeNameSkin(s.name)) ?? null,
  }));
  const portraitOf = (slug: string) =>
    heroesBySlug.get(slug)?.images.icon ?? heroesBySlug.get(slug)?.images.portrait ?? null;
  const nameOf = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;
  // Written builds name the emblem in French ("Emblème de mage"): shown, like
  // the played builds, as its role in the page's language.
  const nameEmblem = (name: string) => {
    const e = emblems.find((x) => x.name === name || x.role === name);
    // "All", the stats API's word for the common emblem every role can take.
    if (!e && name === COMMON_EMBLEM) return t("pages.buildSimulator.commonEmblem");
    return e ? t(`roles.${e.role}`) : name;
  };

  // The rank selector runs in the browser, which does not have the catalog:
  // opponents' names and portraits are therefore resolved here, for each rank.
  const resolve = (list: CounterFigure[]) =>
    list.map((e) => ({ ...e, name: nameOf(e.slug), portrait: portraitOf(e.slug) }));
  const countersShown = mapValues(counters[h.slug] ?? {}, (c) => ({
    strong: resolve(c.strong),
    weak: resolve(c.weak),
    winRate: c.winRate,
  }));
  const hasCounters = Object.keys(countersShown).length > 0;

  // Header rates, rank by rank: the rank chosen on the hero page switches
  // them together with the counters.
  const statsRanks = statsByRank(h.slug);
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const valuesByRank = (format: (s: StatsRank) => string) => mapValues(statsRanks, format);
  const ranksAvailable = MEASURED_RANKS.filter((r) => statsRanks[r] || countersShown[r]);
  // The rank's name under the poster's figure, which follows the picker.
  const rankNames = Object.fromEntries(MEASURED_RANKS.map((r) => [r, t(`measuredRanks.${r}`)])) as Partial<Record<MeasuredRank, string>>;

  // Played builds, resolved here for the same reason: visuals and catalog
  // stay on the server.
  const buildsShown = mapValues(buildsPlayed[h.slug] ?? {}, (byRank) =>
    mapValues(byRank, (list) => (list ?? []).map(resolveBuild)),
  );
  const guidesShown = mapValues(guidesPlayers[h.slug] ?? {}, (byRank) => mapValues(byRank, resolveGuide));
  const hasBuilds = Object.keys(buildsShown).length > 0 || Object.keys(guidesShown).length > 0;

  const teammatesShown = mapValues(teammates[h.slug] ?? {}, (list) =>
    (list ?? []).map((c) => ({ ...c, name: nameOf(c.slug), portrait: portraitOf(c.slug) })),
  );
  const hasTeammates = Object.keys(teammatesShown).length > 0;

  // Most played build on the main lane, all ranks: the reference
  // to hold the written builds against, which age from one patch to
  // the next.
  const reference = buildMain(h);
  const namesItems = new Map(itemsFor(locale).map((o) => [o.slug, o.name]));
  const gapOf = (b: { items: string[]; talent: string }) => {
    if (!reference) return null;
    const taken = new Set(b.items.map((o) => visualItem(o).slug ?? o));
    const missing = reference.items
      .filter((o) => !taken.has(visualItem(o).slug ?? o))
      .map((o) => namesItems.get(visualItem(o).slug ?? "") ?? o);
    const sameTalent = reference.talents.some((x) => x.toLowerCase() === b.talent.toLowerCase());
    return { missing, talents: sameTalent ? null : reference.talents.join(", ") };
  };

  // Dated patches, for the chart markers, and the hero's adjustments.
  const versionsRecent = Object.values(patchDetails).sort(newestFirst);
  const patchDates = versionsRecent.flatMap((p) => (p.date ? [{ version: p.version, date: p.date }] : []));
  const heroAdjustments = versionsRecent.flatMap((p) =>
    (detailedPatches(locale)[p.version] ?? p).adjustments
      .filter((a) => a.slug === h.slug)
      .map((a) => ({ version: p.version, adjustment: a })),
  );

  // Under the analysis, from `lg` up: the most played build and the clearest
  // counters, all ranks, so that a short analysis does not leave the column
  // empty. The Builds and Counters tabs have them all, rank by rank.
  const countersAll = countersShown.all ?? Object.values(countersShown)[0];
  const summary =
    (reference && reference.items.length > 0) || countersAll ? (
      <section aria-label={t("builds.played")} className="hidden gap-4 lg:grid lg:grid-cols-2">
        {reference && reference.items.length > 0 && (
          <Card>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="type-subtitle uppercase text-chalk-100">{t("builds.played")}</h2>
              {reference.winRate !== null && (
                <span className="text-xs tabular-nums text-gold-400">
                  {t("builds.win", { rate: percent.format(reference.winRate) })}
                </span>
              )}
            </div>
            <ol className="mt-4 grid grid-cols-6 gap-2">
              {reference.items.slice(0, 6).map((o, i) => {
                const item = visualItem(o);
                return (
                  <li key={`${o}-${i}`} title={o} className="bevel-sm aspect-square bg-night-800">
                    {item.image ? (
                      <Image src={item.image} alt={o} width={44} height={44} className="size-full object-contain" />
                    ) : (
                      <span className="grid size-full place-items-center text-xs text-chalk-500">{i + 1}</span>
                    )}
                  </li>
                );
              })}
            </ol>
            <a href="#builds" className="mt-4 inline-block font-heading text-base font-bold uppercase text-gold-400 hover:text-gold-300">
              {t("pages.heroDetail.tab.builds")} →
            </a>
          </Card>
        )}
        {countersAll && (
          <Card>
            <h2 className="type-subtitle uppercase text-chalk-100">{t("pages.heroDetail.tab.counters")}</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              {[
                { title: t("counters.strong"), list: countersAll.strong, tone: "text-azure-400" },
                { title: t("counters.difficulty"), list: countersAll.weak, tone: "text-blood-400" },
              ].map(({ title, list, tone }) => (
                <div key={title} className="min-w-0">
                  <h3 className="text-xs text-chalk-500">{title}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {list.slice(0, 3).map((c) => (
                      <li key={c.slug}>
                        <Link href={`/heroes/${c.slug}`} className="group flex items-center gap-2">
                          <HeroPortrait source={c.portrait} name={c.name} size="small" decorative />
                          <span className="min-w-0 flex-1 truncate text-chalk-200 group-hover:text-gold-400">{c.name}</span>
                          <span className={`shrink-0 font-heading text-sm font-bold tabular-nums ${tone}`}>
                            {formatGap(c.advantage, locale)} {t("counters.pts")}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <a href="#counters" className="mt-4 inline-block font-heading text-base font-bold uppercase text-gold-400 hover:text-gold-300">
              {t("pages.heroDetail.tab.counters")} →
            </a>
          </Card>
        )}
      </section>
    ) : null;

  // The hero at a glance, under the poster on a phone: rates, tier, the most
  // played build and the two worst matchups, each leading to its section.
  const glanceJumps = [
    { id: "skills", label: t("pages.heroDetail.tab.skills") },
    ...(hasCounters || hasTeammates || analysis ? [{ id: "counters", label: t("pages.heroDetail.tab.counters") }] : []),
    ...(hasBuilds || analysis ? [{ id: "builds", label: t("pages.heroDetail.tab.builds") }] : []),
    { id: "stats", label: t("pages.heroDetail.tab.stats") },
  ];
  const glance = (
    <HeroGlance
      slug={h.slug}
      roles={h.roles.map((r) => t(`roles.${r}`))}
      lanes={h.lanes.map((l) => t(`lanes.${l}`))}
      stats={mapValues(statsRanks, (s) => ({
        winRate: percent.format(s.winRate),
        pickRate: percent.format(s.pickRate),
        banRate: percent.format(s.banRate),
        tier: s.tier,
      }))}
      build={
        reference && reference.items.length > 0
          ? {
              items: reference.items.map((o) => ({
                name: namesItems.get(visualItem(o).slug ?? "") ?? o,
                image: visualItem(o).image,
              })),
              emblem: reference.emblem
                ? { name: nameEmblem(reference.emblem), image: visualEmblem(reference.emblem).image }
                : null,
              winRate: reference.winRate !== null ? percent.format(reference.winRate) : null,
            }
          : null
      }
      countersByRank={mapValues(countersShown, (c) =>
        c.weak.slice(0, 2).map((x) => ({ slug: x.slug, name: x.name, portrait: x.portrait })),
      )}
      jumps={glanceJumps}
    />
  );

  // The short answer under the poster, at every width: kind, tier and win
  // rate on the current patch, then who counters the hero, all ranks. The
  // same sentences answer the page's questions in its structured data.
  const facts: HeroFacts = {
    name: h.name,
    kind: heroKind(h.roles.map((r) => t(`roles.${r}`)), h.lanes.map((l) => t(`lanes.${l}`))),
    rate: rankedEntry ? { tier: rankedEntry.tier, winRate: percentage(locale, rankedEntry.winRate) } : null,
    counters: countersShown.all?.weak.length
      ? listNames(locale, countersShown.all.weak.filter((c) => heroesBySlug.has(c.slug)).slice(0, 3).map((c) => c.name))
      : null,
    build:
      reference && reference.items.length > 0
        ? {
            items: listNames(locale, reference.items.map((o) => namesItems.get(visualItem(o).slug ?? "") ?? o)),
            emblem: reference.emblem ? nameEmblem(reference.emblem) : null,
          }
        : null,
    version: patchCurrent.version,
    date: longDate(locale),
  };
  const answer = heroAnswer(t, facts);
  const faqData = faqPageData(locale, { path: `/heroes/${slug}`, items: heroFaq(t, facts), changed: dateMeasure });

  // Dex reacts to the hero's standing: cheers at the top of the tier list, worries at its foot.
  const dexLine = rankedEntry ? dexReaction(t, h.name, rankedEntry.tier) : null;

  const history = historyOf(h.slug);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: h.title ? `${h.name} — ${h.title}` : h.name,
    // The page description, in its language: the written summary only exists
    // in French and was shown under an English `inLanguage`.
    description: descriptionHero(locale, h),
    image: h.images.portrait ? absoluteUrl(h.images.portrait) : undefined,
    inLanguage: LOCALE_HTML[locale],
    // First measurement kept for this hero: the page has published its figures
    // since then. The modification follows the latest rate measurement.
    datePublished: history?.start ?? dateMeasure,
    dateModified: dateMeasure,
    author: { "@type": "Person", name: site.author, url: `https://github.com/${site.author}` },
    publisher: {
      "@type": "Organization",
      name: site.name,
      url: site.url,
      logo: { "@type": "ImageObject", url: absoluteUrl("/apple-icon.png") },
    },
    mainEntityOfPage: `${site.url}/${locale}/heroes/${slug}`,
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.heroDetail"])}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      {faqData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqData) }} />}

      {/*
        A single skin state for the whole hero page: the header and the skins tab
        share it, so choosing a skin updates the header portrait
        as well as the large illustration.
      */}
      <ShowcaseProvider skins={skinsFull} portraitDefault={h.images.portrait}>
      {/* The hero's colour for the whole page (`.hero-accent`, globals.css). */}
      <div className="hero-accent" style={accentStyle(accent) as CSSProperties}>
      <RankProvider ranks={ranksAvailable}>
      {/* ── Poster ───────────────────────────────────────────────────────
        The official artwork across the page, the name in giant slanted
        capitals over its foot, the tier crest and the one big figure (the
        win rate at the chosen rank, the ban rate outlined beside it). The
        art's frame has its height before the image arrives: nothing moves.
        Built in layers (art, the hero's light, vignette, name) that drift at
        their own depth with the pointer and the scroll (PosterParallax).
      */}
      <PosterParallax aria-labelledby="hero-name" className="relative isolate overflow-hidden">
        <div aria-hidden className="relative h-[22rem] overflow-hidden sm:h-[30rem] lg:h-[37rem] xl:h-[41rem]">
          <div className="cine-art absolute inset-0">
            {background ? (
              <ShowcaseArt
                fallback={background}
                sizes="100vw"
                // The banner is much wider than the illustration is tall:
                // framing at the top would only show the sky. We aim at the
                // upper third, where the character is.
                className="affiche-art object-cover object-[50%_28%]"
              />
            ) : (
              h.images.portrait && (
                <span className="absolute inset-y-0 right-[6%] aspect-[240/390]">
                  <Image src={h.images.portrait} alt="" fill priority fetchPriority="high" sizes="(min-width: 640px) 24rem, 60vw" className="affiche-art object-cover" />
                </span>
              )
            )}
          </div>
          <div className="cine-light absolute -inset-8" />
          <div className="cine-vignette absolute inset-0" />
          {/*
            Night closing in from the foot, where the name sits, and from `lg`
            on the left: the contrast of the text no longer depends on the
            artwork's brightness, which changes with each hero.
          */}
          <div className="absolute inset-x-0 bottom-0 h-4/5 bg-linear-to-t from-night-950 via-night-950/75 to-transparent" />
          <div className="absolute inset-y-0 left-0 hidden w-3/5 bg-linear-to-r from-night-950/85 to-transparent lg:block" />
          <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-night-950/70 to-transparent" />
          <div className="cine-edge absolute inset-x-0 bottom-0" />
        </div>

        {/* The breadcrumb floats over the art. The role crumb leads to the role page; the hero crumb opens the others. */}
        <div className="page-wrap absolute inset-x-0 top-0 pt-3 sm:pt-5">
          <Breadcrumb
            crumbs={[
              { name: t("nav.heroes.label"), href: "/heroes" },
              ...(h.roles[0] ? [{ name: t(`roles.${h.roles[0]}`), href: pathRole(h.roles[0]) }] : []),
              {
                name: h.name,
                siblings: [...allHeroes]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((x) => ({ name: x.name, href: `/heroes/${x.slug}` })),
              },
            ]}
          />
        </div>

        <div className="page-wrap relative -mt-36 grid gap-x-12 gap-y-6 pb-8 sm:-mt-48 sm:pb-10 lg:-mt-64 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="cine-name min-w-0">
            {h.title && <p className="hero-accent-text font-heading text-lg font-bold uppercase sm:text-xl">{h.title}</p>}
            <h1 id="hero-name" className="affiche-name type-giant mt-1 break-words text-chalk-100">
              {h.name}
            </h1>
            <Cascade className="mt-5 flex flex-wrap gap-1.5">
              {[
                ...h.roles.map((r) => <RoleBadge key={r} role={r} />),
                ...h.lanes.map((l) => (
                  <span key={l} className="cine-chip bevel-sm bg-night-800 px-2 py-0.5 font-heading text-[0.8rem] font-bold uppercase leading-tight text-chalk-100">
                    {t(`lanes.${l}`)}
                  </span>
                )),
                ...h.specialties.map((s) => (
                  <span key={s} className="bevel-sm bg-night-900/80 px-2 py-0.5 font-heading text-[0.8rem] font-bold uppercase leading-tight text-chalk-400">
                    {heroLabel(t, "specialty", s)}
                  </span>
                )),
              ].map((chip, i) => (
                <span key={chip.key} className="inline-flex" style={{ "--i": i } as CSSProperties}>
                  {chip}
                </span>
              ))}
            </Cascade>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <FavouriteButton hero={h.slug} />
              <Link href={`/compare?a=${h.slug}`} className="btn btn-secondary btn-sm">
                <Swords size={15} aria-hidden />
                {t("pages.heroDetail.compare")}
              </Link>
            </div>
          </div>

          {rankedEntry && (
            <Cascade className="flex flex-wrap items-end gap-x-4 gap-y-3 sm:gap-x-6">
              <span className="mb-2 [--i:2]">
                <BadgeTier tier={rankedEntry.tier} size="lg" />
              </span>
              <p className="min-w-0 [--i:3]">
                <Score
                  value={<ValueByRank values={{ all: percent.format(rankedEntry.winRate), ...valuesByRank((s) => percent.format(s.winRate)) }} />}
                  unit="%"
                  className="text-[clamp(4.5rem,2.4rem+6.5vw,8.5rem)]"
                />
                <span className="mt-2 block max-w-[9rem] text-sm text-chalk-300 sm:max-w-none">
                  {t("pages.heroDetail.stat.winRate")} · <ValueByRank values={rankNames} />
                </span>
              </p>
              <p className="min-w-0 pb-7 [--i:4]">
                <Score
                  outline
                  value={<ValueByRank values={{ all: percent.format(rankedEntry.banRate), ...valuesByRank((s) => percent.format(s.banRate)) }} />}
                  unit="%"
                  className="text-[clamp(2.25rem,1.5rem+2.4vw,3.75rem)]"
                />
                <span className="mt-1.5 block text-sm text-chalk-400">{t("pages.heroDetail.stat.banRate")}</span>
              </p>
            </Cascade>
          )}
        </div>
      </PosterParallax>
      <div className="page-wrap">
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-chalk-300 sm:text-base">{answer.join(" ")}</p>
      </div>
      <div className="page-wrap lg:hidden">{glance}</div>

      {/* ── Facts, rank and ratings ───────────────────────────────────────
        The portrait follows the skin chosen in the gallery; the facts follow
        the rank picked here, as the counters and builds below do. Facts and
        gauges come in one after the other when they reach the screen.
      */}
      <div className="page-wrap">
        <div aria-hidden className="eclat-rule" />
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-6 py-6 sm:gap-x-10 sm:py-8 xl:grid-cols-[auto_minmax(0,1fr)_19rem]">
          <ShowcasePortrait name={h.name} portraitDefault={h.images.portrait} morph={heroMorph(h.slug)} />
          <div className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1">
            <Cascade as="dl" className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
              {(
                [
                  [t("pages.heroDetail.stat.position"), h.lanes.map((l) => t(`lanes.${l}`)).join(", ")],
                  [t("pages.heroDetail.stat.tierList"), rankedEntry ? <ValueByRank values={valuesByRank((s) => t("pages.heroDetail.tier", { p: s.tier }))} /> : null],
                  [t("pages.heroDetail.stat.release"), releaseDate(h.release, locale, t)],
                  [t("pages.heroDetail.stat.resource"), heroLabel(t, "resource", h.resource)],
                  [t("pages.heroDetail.stat.damage"), heroLabel(t, "damage", h.damageType)],
                  [t("pages.heroDetail.stat.range"), heroLabel(t, "attack", h.attackType)],
                  [t("pages.heroDetail.stat.region"), heroLabel(t, "region", h.region)],
                  [t("pages.heroDetail.stat.skins"), h.skins.length || null],
                ] as const
              )
                .filter(([, value]) => !!value)
                .map(([label, value], i) => (
                  <div key={String(label)} className="min-w-0" style={{ "--i": i } as CSSProperties}>
                    <dt className="text-xs text-chalk-500">{label}</dt>
                    <dd className="mt-0.5 font-heading text-lg font-bold leading-tight text-chalk-100">{value}</dd>
                  </div>
                ))}
            </Cascade>
            {/* Rank for the whole hero page: rates, counters and builds follow it. */}
            <RankPicker className="mt-6" />
            <FreshnessLine locale={locale} className="mt-4" />
          </div>

          {/* In-game ratings, as notched gauges rather than bare figures, lit in the hero's colour. */}
          <Cascade as="dl" className="order-2 grid min-w-0 content-start gap-2.5 self-center sm:order-none sm:col-span-2 xl:col-span-1 xl:self-start">
            {(
              [
                [t("pages.heroDetail.ratings.offense"), h.ratings.offense],
                [t("pages.heroDetail.ratings.durability"), h.ratings.durability],
                [t("pages.heroDetail.ratings.effects"), h.ratings.abilityEffects],
                [t("pages.heroDetail.ratings.difficulty"), h.ratings.difficulty],
              ] as const
            )
              .filter(([, value]) => value !== null)
              .map(([label, value], i) => (
                <div key={String(label)} className="flex items-center gap-3" style={{ "--i": i } as CSSProperties}>
                  <dt className="w-24 shrink-0 font-heading text-sm font-bold uppercase text-chalk-400 sm:w-28">{label}</dt>
                  <dd className="flex-1">
                    <Gauge value={Number(value)} accent />
                  </dd>
                </div>
              ))}
          </Cascade>
        </div>
        {dexLine && (
          <DexSays pose={dexLine.pose} height={84} className="mb-6">
            {dexLine.text}
          </DexSays>
        )}
        <div aria-hidden className="eclat-rule" />
      </div>

      <div className="page-wrap py-10">
        {/* How far the page is read, and which tabs are opened: cookieless events. */}
        <ScrollDepth category="Hero page" name={h.slug} />
        <Tabs
          aliases={TAB_ALIASES}
          trackAs="Hero page"
          // On a phone, stacked sections: the analysis and the skills open,
          // the rest folded so that the end of the page stays within reach.
          sectionsOnMobile
          openOnMobile={["analysis", "skills"]}
          tabs={[
            {
              id: "analysis",
              label: t("pages.heroDetail.tab.analysis"),
              content: analysis ? (
                <div className="space-y-12">
                  <section>
                    <div className="max-w-3xl space-y-4 text-[1.05rem] leading-relaxed text-chalk-200">
                      {analysis.analysis.split("\n\n").map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                    {locale !== "fr" && (
                      <p className="mt-4 text-xs text-chalk-500">{t("pages.heroDetail.analysisTranslated")}</p>
                    )}
                  </section>

                  <section className="grid gap-4 md:grid-cols-2">
                    <Card className="shadow-[inset_0_3px_0_var(--color-azure-500)]">
                      <h2 className="flex items-center gap-2 type-subtitle uppercase text-azure-400">
                        <Swords size={18} aria-hidden />
                        {t("pages.heroDetail.strengths")}
                      </h2>
                      <ul className="mt-4 space-y-2.5">
                        {analysis.strengths.map((f) => (
                          <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-chalk-300">
                            <span aria-hidden className="mt-2 h-1.5 w-1 shrink-0 -skew-x-[25deg] bg-azure-400" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </Card>
                    <Card className="shadow-[inset_0_3px_0_var(--color-blood-500)]">
                      <h2 className="flex items-center gap-2 type-subtitle uppercase text-blood-400">
                        <TriangleAlert size={18} aria-hidden />
                        {t("pages.heroDetail.weaknesses")}
                      </h2>
                      <ul className="mt-4 space-y-2.5">
                        {analysis.weaknesses.map((f) => (
                          <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-chalk-300">
                            <span aria-hidden className="mt-2 h-1.5 w-1 shrink-0 -skew-x-[25deg] bg-blood-400" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </section>

                  {summary}
                </div>
              ) : (
                <div className="space-y-12">
                <Card className="shadow-[inset_0_3px_0_var(--color-gold-400)]">
                  <h2 className="flex items-center gap-2 type-subtitle uppercase text-gold-400">
                    <ShieldAlert size={20} aria-hidden />
                    {t("pages.heroDetail.analysisPending")}
                  </h2>
                  <p className="mt-3 max-w-2xl leading-relaxed text-chalk-300">
                    {t("pages.heroDetail.analysisText", { name: h.name })}
                  </p>
                  <Link
                    href="/contribute"
                    className="btn btn-secondary btn-sm mt-5"
                  >
                    {t("pages.heroDetail.contribute")}
                  </Link>
                </Card>
                {summary}
                </div>
              ),
            },
            {
              id: "story",
              label: t("pages.heroDetail.tab.story"),
              content: hasStory ? <HeroStory story={story} name={h.name} locale={locale} /> : null,
            },
            {
              id: "skills",
              label: t("pages.heroDetail.tab.skills"),
              counter:
                Math.max(
                  skillsWiki.filter(Boolean).length,
                  analysis?.skills.length ?? 0,
                ) || undefined,
              content: (
                <div className="space-y-10">
                  <HeroSkills
                    wiki={skillsWiki}
                    icons={iconsSkills}
                    writtenSkills={analysis?.skills ?? null}
                  />
                  <HeroCombos combos={combos(locale)[h.slug] ?? []} locale={locale} />
                </div>
              ),
            },
            {
              id: "counters",
              label: t("pages.heroDetail.tab.counters"),
              content:
                hasCounters || hasTeammates || analysis ? (
                  <div className="space-y-8">
                    {hasCounters && (
                      <section>
                        <MeasuredCounters name={h.name} byRank={countersShown} />
                        <Link
                          href={`/heroes/${h.slug}/counters`}
                          className="mt-4 inline-block font-heading text-base font-bold uppercase text-gold-400 hover:text-gold-300"
                        >
                          {t("pages.heroDetail.pageCounters")} →
                        </Link>
                      </section>
                    )}

                    {hasTeammates && (
                      <section>
                        <TeammatesByRank name={h.name} byRank={teammatesShown} />
                        {duos[h.slug] && (
                          <Link
                            href={`/heroes/${h.slug}/duos`}
                            className="mt-4 inline-block font-heading text-base font-bold uppercase text-gold-400 hover:text-gold-300"
                          >
                            {t("pages.heroDetail.pageDuos")} →
                          </Link>
                        )}
                      </section>
                    )}

                    {analysis && (analysis.strongAgainst.length > 0 || analysis.weakAgainst.length > 0) && (
                      <section>
                        <h3 className="type-subtitle uppercase text-chalk-100">
                          {t("pages.heroDetail.matchups")}
                        </h3>
                        <p className="mt-1 text-sm text-chalk-500">
                          {t("pages.heroDetail.matchupsIntro")}
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <ListCounters title={t("pages.heroDetail.comfortable", { name: h.name })} slugs={analysis.strongAgainst} tone="good" />
                          <ListCounters title={t("pages.heroDetail.difficulty2", { name: h.name })} slugs={analysis.weakAgainst} tone="bad" />
                        </div>
                      </section>
                    )}
                  </div>
                ) : null,
            },
            {
              id: "builds",
              label: t("pages.heroDetail.tab.builds"),
              content: hasBuilds || analysis ? (
                <div className="space-y-10">
                  {hasBuilds && (
                    <section>
                      <BuildsByRank builds={packBuilds(buildsShown, guidesShown)} />
                    </section>
                  )}
                  {analysis && analysis.builds.length > 0 && (
                  <section>
                  {hasBuilds && (
                    <>
                      <h3 className="type-subtitle uppercase text-chalk-100">{t("builds.written")}</h3>
                      <p className="mt-1 mb-5 text-sm text-chalk-500">{t("builds.writtenIntro")}</p>
                    </>
                  )}
                  <div className="space-y-4">
                  {analysis.builds.map((b) => (
                    <Card key={b.name}>
                      <h3 className="type-subtitle uppercase text-gold-400">{b.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-chalk-500">{b.context}</p>
                      <ol className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {b.items.map((o, i) => (
                          <BuildItem key={o} name={o} rank={i + 1} />
                        ))}
                      </ol>
                      <div className="mt-5 grid gap-3 border-t border-night-800 pt-4 sm:grid-cols-3">
                        <BuildPicker label={t("builds.emblem")} name={nameEmblem(b.emblem)} image={visualEmblem(b.emblem).image} href={visualEmblem(b.emblem).href} />
                        <BuildPicker label={t("builds.talent")} name={b.talent} image={visualTalent(b.talent).image} />
                        <BuildPicker label={t("builds.spell")} name={b.spell} image={spellVisual(b.spell).image} href={spellVisual(b.spell).href} />
                      </div>
                      {(() => {
                        const gap = gapOf(b);
                        if (!gap) return null;
                        return (
                          <p className="mt-4 border-t border-night-800 pt-3 text-xs leading-relaxed text-chalk-500">
                            <span className="font-semibold text-chalk-300">{t("builds.gapTitle")} · </span>
                            {gap.missing.length === 0
                              ? t("builds.aligned")
                              : t("builds.gapItems", { items: gap.missing.join(", ") })}
                            {gap.talents && <> {t("builds.gapTalent", { talent: gap.talents })}</>}
                          </p>
                        );
                      })()}
                    </Card>
                  ))}
                  </div>
                  </section>
                  )}
                </div>
              ) : null,
            },
            {
              id: "stats",
              deferred: true,
              label: t("pages.heroDetail.tab.stats"),
              preview: (
                <PreviewStatistics
                  locale={locale}
                  h={h}
                  statsRanks={statsRanks}
                  adjustments={heroAdjustments.length}
                  patches={versionsRecent.length}
                />
              ),
              content: (
                <div className="space-y-12">
                  <HeroStatisticsDeferred
                    name={h.name}
                    trends={trendsOf(h.slug)}
                    duration={durationOf(h.slug)}
                    history={history}
                    patches={patchDates}
                    byRank={statsRanks}
                    adjustments={heroAdjustments.map((a) => ({ version: a.version, type: a.adjustment.type }))}
                  />
                  <section>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="type-subtitle uppercase text-chalk-100">
                        {t("pages.heroDetail.statistics.adjustments")}
                      </h3>
                      <HeroFeedLink locale={locale} slug={h.slug} />
                    </div>
                    <p className="mt-1 mb-4 text-sm text-chalk-500">
                      {heroAdjustments.length > 0
                        ? t("pages.heroDetail.statistics.adjustmentsIntro", { name: h.name })
                        : t("pages.heroDetail.statistics.noAdjustment", { name: h.name, n: versionsRecent.length })}
                    </p>
                    {heroAdjustments.length > 0 && (
                      <HeroAdjustmentsDeferred entries={heroAdjustments} portrait={h.images.icon ?? h.images.portrait} />
                    )}
                    <LiquipediaPatchNote
                      t={t}
                      patches={versionsRecent.filter((p) => heroAdjustments.some((a) => a.version === p.version))}
                      className="mt-3"
                    />
                    {/* Changes being tested on the Advance Server; renders nothing otherwise. */}
                    <NextPatch slug={h.slug} locale={locale} />
                  </section>
                  {/* Pro play presence in recent tournaments; renders nothing for absent heroes. */}
                  <HeroProStats slug={h.slug} locale={locale} />
                </div>
              ),
            },
            {
              id: "skins",
              deferred: true,
              label: t("pages.heroDetail.tab.skins"),
              counter: skinsFull.length || undefined,
              // Skin names, as text, until the gallery loads.
              preview:
                skinsFull.length > 0 ? (
                  <div className="text-sm leading-relaxed text-chalk-300">
                    <p>{t("pages.heroPreview.skins", { name: h.name, n: skinsFull.length })}</p>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-chalk-500">
                      {skinsFull.map((s) => (
                        <li key={s.id}>{s.name}</li>
                      ))}
                    </ul>
                    {heroGallery(h).total > 0 && (
                      <Link
                        href={`/heroes/${h.slug}/skins`}
                        className="mt-3 inline-block font-semibold text-gold-400 hover:text-gold-500"
                      >
                        {t("pages.heroSkins.sheetLink", { n: heroGallery(h).total })} →
                      </Link>
                    )}
                  </div>
                ) : null,
              content:
                skinsFull.length > 0 ? (
                  <div className="space-y-5">
                    {heroGallery(h).total > 0 && (
                      <Link
                        href={`/heroes/${h.slug}/skins`}
                        className="inline-block font-heading text-base font-bold uppercase text-gold-400 hover:text-gold-300"
                      >
                        {t("pages.heroSkins.sheetLink", { n: heroGallery(h).total })} →
                      </Link>
                    )}
                    <SkinShowcase skins={skinsFull} />
                  </div>
                ) : null,
            },
          ]}
        />
        <DiscordInvite t={t} context="hero" className="mt-10" />
        <DailyDle place="hero" className="mt-6" />
        <PageSourcesBlock locale={locale} of={{ kind: "hero", name: h.name }} />
        <ReportError messages={messagesPage(locale, ["pages.reportError"])} path={`/heroes/${h.slug}`} className="mt-6" />
      </div>
      </RankProvider>
      </div>
      </ShowcaseProvider>
    </ExtendMessages>
  );
}

function ListCounters({
  title,
  slugs,
  tone,
}: {
  title: string;
  slugs: string[];
  tone: "good" | "bad";
}) {
  return (
    <Card>
      <h3 className="font-heading text-lg font-bold uppercase leading-tight text-chalk-100">{title}</h3>
      <ul className="mt-4 flex flex-wrap gap-2">
        {slugs.map((s) => (
          <li key={s}>
            <Link
              href={`/heroes/${s}`}
              className={`bevel-sm block bg-night-800 px-2.5 py-1 font-heading font-bold uppercase transition-colors hover:bg-night-700 ${
                tone === "good" ? "text-azure-400" : "text-blood-400"
              }`}
            >
              {heroesBySlug.get(s)?.name ?? s}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Statistics summary in sentences, rendered by the server in the deferred
 * tab: thirty-day trend, favorable game length, gap between
 * ranks and recent adjustments. The charts replace it on
 * opening; until then, engines and readers get the gist as text.
 */
function PreviewStatistics({
  locale,
  h,
  statsRanks,
  adjustments,
  patches,
}: {
  locale: Locale;
  h: Hero;
  statsRanks: Partial<Record<MeasuredRank, StatsRank>>;
  adjustments: number;
  patches: number;
}) {
  const t = createT(locale);
  const percent = (v: number) => percentage(locale, v);
  const sentences: string[] = [];

  const measures = (trendsOf(h.slug).all?.winRate ?? []).flatMap((v, k) => (v === null ? [] : [[k, v] as const]));
  if (measures.length > 1) {
    const [k0, start] = measures[0];
    const [k1, end] = measures[measures.length - 1];
    // "went from 50.3% to 50.3% (0.0 pts)" says nothing: an unchanged rate,
    // once rounded, gets its own sentence.
    const stable = percent(start) === percent(end);
    sentences.push(
      t(stable ? "pages.heroPreview.trendStable" : "pages.heroPreview.trend", {
        name: h.name,
        n: k1 - k0 + 1,
        start: percent(start),
        end: percent(end),
        gap: formatGap(end - start, locale),
        pts: t("counters.pts"),
      }),
    );
  }

  const buckets = [...(durationOf(h.slug).all ?? [])].sort((a, b) => b.winRate - a.winRate);
  if (buckets.length > 1) {
    const label = (x: BucketDuration) =>
      x.to === null
        ? t("pages.heroDetail.statistics.minutesPlus", { from: x.from })
        : t("pages.heroDetail.statistics.minutes", { from: x.from, to: x.to });
    const high = buckets[0];
    const low = buckets[buckets.length - 1];
    sentences.push(
      t("pages.heroPreview.duration", {
        name: h.name,
        window: label(high),
        winRate: percent(high.winRate),
        windowLow: label(low),
        winRateLow: percent(low.winRate),
      }),
    );
  }

  const ranks = MEASURED_RANKS.filter((r) => r !== "all" && statsRanks[r]).sort(
    (a, b) => statsRanks[a]!.winRate - statsRanks[b]!.winRate,
  );
  if (ranks.length > 1) {
    const bottom = ranks[0];
    const top = ranks[ranks.length - 1];
    sentences.push(
      t("pages.heroPreview.ranks", {
        name: h.name,
        low: percent(statsRanks[bottom]!.winRate),
        rankLow: t(`measuredRanks.${bottom}`),
        high: percent(statsRanks[top]!.winRate),
        rankHigh: t(`measuredRanks.${top}`),
      }),
    );
  }

  if (adjustments > 0) sentences.push(t("pages.heroPreview.adjustments", { name: h.name, n: adjustments, total: patches }));
  if (sentences.length === 0) return null;

  return (
    <div className="space-y-3 text-sm leading-relaxed text-chalk-300">
      {sentences.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}
