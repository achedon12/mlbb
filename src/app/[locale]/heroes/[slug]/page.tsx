import type { Metadata } from "next";
import { ExtendMessages } from "@/i18n/provider";
import { LOCALE_HTML } from "@/i18n/config";
import { serializeJsonLd } from "@/lib/html";
import Image from "next/image";
import Link from "@/components/link";
import { notFound } from "next/navigation";
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
import { resolveBuild, resolveGuide, visualEmblem, visualItem, spellVisual, visualTalent } from "@/lib/build-visuals";
import { heroGallery } from "@/lib/hero-skins";
import { duos } from "@/lib/duos";
import { HeroAdjustmentsDeferred, HeroStatisticsDeferred } from "@/components/hero-statistics-deferred";
import { NextPatch } from "@/components/next-patch";
import { HeroProStats } from "@/components/hero-pro-stats";
import { durationOf, historyOf, trendsOf } from "@/lib/evolution";
import { Tabs } from "@/components/tabs";
import { HeroFeedLink } from "@/components/hero-feed-link";

import {
  ShowcasePortrait,
  ShowcaseProvider,
  SkinShowcase,
  type SkinFull,
} from "@/components/skin-showcase";
import { Card, Gauge } from "@/components/ui";
import { RoleBadge } from "@/components/role-badge";
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
} from "@/lib/data";
import { rankingFull, statsByRank, rateBySlug, type StatsRank } from "@/lib/tier-list";
import { MEASURED_RANKS, type MeasuredRank } from "@/lib/measured-ranks";
import { pathRole } from "@/lib/tier-list-filters";
import { site, absoluteUrl } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import { createT, messagesPage } from "@/i18n/translations";
import { releaseDate, heroLabel } from "@/i18n/hero-data";
import { normalizeNameSkin } from "@/lib/utils";
import { metaPage } from "@/i18n/seo";
import { FreshnessLine } from "@/components/freshness";
import { longDate, dateMeasure, listNames, patchCurrent, percentage } from "@/lib/freshness";
import { formatGap } from "@/lib/trends";
import type { BucketDuration } from "@/lib/evolution";
import type { Hero } from "@/lib/types";

/** Tab anchors before they were named in English: shared links still open their tab. */
const TAB_ALIASES = { analyse: "analysis", histoire: "story", competences: "skills", contres: "counters" };

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/** One page per hero, generated at build time. */
export function generateStaticParams() {
  return allHeroes.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) return {};

  const tm = createT(locale);
  const tier = rateBySlug.get(h.slug)?.tier;
  const v = patchCurrent.version;
  return metaPage(locale, {
    // Title modeled on searches ("aamon build", "aamon emblem",
    // "aamon counter"), with the tier and the patch: the results that
    // carry a freshness marker are the ones that get clicked. The epithet stays
    // on the page.
    title: tier
      ? tm("pages.seo.hero.title", { name: h.name, tier: tier, v })
      : tm("pages.seo.hero.titleNoTier", { name: h.name, v }),
    description: descriptionHero(locale, h),
    path: `/heroes/${slug}`,
    type: "article",
    image: `/${locale}/heroes/${slug}/opengraph-image`,
  });
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

  // The written summary only exists in French: the other languages take the
  // generated description, in their own language.
  return (
    (locale === "fr" ? h.analysis?.summary : undefined) ??
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
  if (!h) notFound();

  const rankedEntry = rankingFull.find((e) => e.hero.slug === slug);
  const t = createT(locale);
  const analysis = h.analysis;
  const skillsWiki = skills(locale)[h.slug] ?? [];
  const iconsSkills = visualsSkills[h.slug] ?? {};
  const illustrationsHero = illustrations[h.slug] ?? {};
  // The original skin's illustration serves as background: it is the one that
  // shows the hero as met by default.
  const background = Object.values(illustrationsHero)[0] ?? null;
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

  // The rank selector runs in the browser, which does not have the catalog:
  // opponents' names and portraits are therefore resolved here, for each rank.
  const resolve = (list: CounterFigure[]) =>
    list.map((e) => ({ ...e, name: nameOf(e.slug), portrait: portraitOf(e.slug) }));
  const countersShown = Object.fromEntries(
    Object.entries(counters[h.slug] ?? {}).map(([rank, c]) => [
      rank,
      { strong: resolve(c.strong), weak: resolve(c.weak), winRate: c.winRate },
    ]),
  );
  const hasCounters = Object.keys(countersShown).length > 0;

  // Header rates, rank by rank: the rank chosen on the hero page switches
  // them together with the counters.
  const statsRanks = statsByRank(h.slug);
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const valuesByRank = (format: (s: StatsRank) => string) =>
    Object.fromEntries(Object.entries(statsRanks).map(([r, s]) => [r, format(s)]));
  const ranksAvailable = MEASURED_RANKS.filter((r) => statsRanks[r] || countersShown[r]);

  // Played builds, resolved here for the same reason: visuals and catalog
  // stay on the server.
  const buildsShown = Object.fromEntries(
    Object.entries(buildsPlayed[h.slug] ?? {}).map(([lane, byRank]) => [
      lane,
      Object.fromEntries(
        Object.entries(byRank).map(([rank, list]) => [rank, (list ?? []).map(resolveBuild)]),
      ),
    ]),
  );
  const guidesShown = Object.fromEntries(
    Object.entries(guidesPlayers[h.slug] ?? {}).map(([lane, byRank]) => [
      lane,
      Object.fromEntries(
        Object.entries(byRank).flatMap(([rank, g]) => (g ? [[rank, resolveGuide(g)]] : [])),
      ),
    ]),
  );
  const hasBuilds = Object.keys(buildsShown).length > 0 || Object.keys(guidesShown).length > 0;

  const teammatesShown = Object.fromEntries(
    Object.entries(teammates[h.slug] ?? {}).map(([rank, list]) => [
      rank,
      (list ?? []).map((c) => ({ ...c, name: nameOf(c.slug), portrait: portraitOf(c.slug) })),
    ]),
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
  const versionsRecent = Object.values(patchDetails).sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  );
  const patchDates = versionsRecent.flatMap((p) => (p.date ? [{ version: p.version, date: p.date }] : []));
  const heroAdjustments = versionsRecent.flatMap((p) =>
    (detailedPatches(locale)[p.version] ?? p).adjustments
      .filter((a) => a.slug === h.slug)
      .map((a) => ({ version: p.version, adjustment: a })),
  );

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

      {/*
        A single skin state for the whole hero page: the header and the skins tab
        share it, so choosing a skin updates the header portrait
        as well as the large illustration.
      */}
      <ShowcaseProvider skins={skinsFull} portraitDefault={h.images.portrait}>
      <RankProvider ranks={ranksAvailable}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="relative border-b border-night-700/70 bg-night-900/30">
        {background && (
          <div aria-hidden className="absolute inset-0 overflow-hidden">
            <Image
              src={background}
              alt=""
              fill
              priority
              sizes="100vw"
              // Background darkened by an overlay: a reduced quality does not show,
              // and it is the heaviest element to load on mobile.
              quality={50}
              // The banner is much wider than the illustration is tall:
              // framing at the top would only show the sky. We aim at the upper
              // third, where the character is.
              className="object-cover object-[50%_30%] brightness-110"
            />
            {/*
              A uniform overlay rather than a side gradient: the light area
              of an illustration is not in the same place from one hero to
              another — Khufra's is dark on the right, Miya's in the
              center. A directional gradient thus worked for some and washed out
              the others.
            */}
            <div className="absolute inset-0 bg-night-950/55" />
            {/*
              The bottom of the header closes onto the page background: the
              transition to the content stays clean, without a hard cut.
            */}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-night-950 to-transparent" />
          </div>
        )}

        <div className="relative mx-auto max-w-5xl px-4 py-10">
          {/*
            The breadcrumb floats over the illustration with its own background. The
            role crumb leads to the role page; the hero crumb opens the others.
          */}
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

          <div className="bevel mt-6 flex flex-wrap items-start gap-6 border border-night-700/50 bg-night-950/75 p-5 backdrop-blur-sm">
            <ShowcasePortrait name={h.name} portraitDefault={h.images.portrait} />

            <div className="min-w-0 flex-1 basis-64">
              <h1 className="font-heading text-4xl font-bold text-chalk-100">{h.name}</h1>
              {h.title && <p className="mt-1 text-lg text-gold-400">{h.title}</p>}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {h.roles.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
                {h.specialties.map((s) => (
                  <span
                    key={s}
                    className="bevel-sm border border-night-600 px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-chalk-500"
                  >
                    {heroLabel(t, "specialty", s)}
                  </span>
                ))}
              </div>

              <FreshnessLine locale={locale} className="mt-4" />

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <FavouriteButton hero={h.slug} />
                <Link
                  href={`/compare?a=${h.slug}`}
                  className="bevel-sm flex items-center gap-2 border border-night-700 px-4 py-2 text-sm font-medium text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                >
                  <Swords size={15} aria-hidden />
                  {t("pages.heroDetail.compare")}
                </Link>
              </div>
            </div>

            {/* In-game ratings, as gauges rather than bare figures. */}
            <dl className="grid min-w-0 flex-1 basis-56 gap-2.5">
              {[
                [t("pages.heroDetail.ratings.offense"), h.ratings.offense],
                [t("pages.heroDetail.ratings.durability"), h.ratings.durability],
                [t("pages.heroDetail.ratings.effects"), h.ratings.abilityEffects],
                [t("pages.heroDetail.ratings.difficulty"), h.ratings.difficulty],
              ].map(([label, value]) =>
                value === null ? null : (
                  <div key={String(label)} className="flex items-center gap-3">
                    <dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-chalk-500">
                      {label}
                    </dt>
                    <dd className="flex-1">
                      <Gauge value={Number(value)} />
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </div>

          {/* ── Facts ─────────────────────────────────────────────────── */}
          {/*
            The information sets its own background rather than relying on
            the illustration being darkened: the contrast then no longer depends
            on the artwork's brightness, which changes with each hero.
          */}
          <div className="bevel mt-8 border border-night-700/50 bg-night-950/75 p-5 backdrop-blur-sm">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4 lg:grid-cols-6">
            {[
              [t("pages.heroDetail.stat.position"), h.lanes.map((l) => t(`lanes.${l}`)).join(", ")],
              [t("pages.heroDetail.stat.release"), releaseDate(h.release, locale, t)],
              [t("pages.heroDetail.stat.resource"), heroLabel(t, "resource", h.resource)],
              [t("pages.heroDetail.stat.damage"), heroLabel(t, "damage", h.damageType)],
              [t("pages.heroDetail.stat.range"), heroLabel(t, "attack", h.attackType)],
              [t("pages.heroDetail.stat.region"), heroLabel(t, "region", h.region)],
              [t("pages.heroDetail.stat.skins"), h.skins.length || null],
              [t("pages.heroDetail.stat.tierList"), rankedEntry ? <ValueByRank values={valuesByRank((s) => t("pages.heroDetail.tier", { p: s.tier }))} /> : null],
              [t("pages.heroDetail.stat.winRate"), rankedEntry ? <ValueByRank values={valuesByRank((s) => `${percent.format(s.winRate)} %`)} /> : null],
              [t("pages.heroDetail.stat.banRate"), rankedEntry ? <ValueByRank values={valuesByRank((s) => `${percent.format(s.banRate)} %`)} /> : null],
            ].map(([label, value]) =>
              !value ? null : (
                <div key={String(label)}>
                  <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
                  <dd className="mt-1 text-chalk-100">{value}</dd>
                </div>
              ),
            )}
          </dl>
          {/* Rank for the whole hero page: rates, counters and builds follow it. */}
          <RankPicker className="mt-5 border-t border-night-800 pt-4" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <Tabs
          aliases={TAB_ALIASES}
          tabs={[
            {
              id: "analysis",
              label: t("pages.heroDetail.tab.analysis"),
              content: analysis ? (
                <div className="space-y-12">
                  <section>
                    <div className="space-y-4 leading-relaxed text-chalk-300">
                      {analysis.analysis.split("\n\n").map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-4 md:grid-cols-2">
                    <Card className="border-emerald-500/25">
                      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-emerald-400">
                        <Swords size={18} aria-hidden />
                        {t("pages.heroDetail.strengths")}
                      </h2>
                      <ul className="mt-4 space-y-2.5">
                        {analysis.strengths.map((f) => (
                          <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-chalk-300">
                            <span aria-hidden className="mt-2 size-1 shrink-0 bg-emerald-400" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </Card>
                    <Card className="border-blood-500/25">
                      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-blood-500">
                        <TriangleAlert size={18} aria-hidden />
                        {t("pages.heroDetail.weaknesses")}
                      </h2>
                      <ul className="mt-4 space-y-2.5">
                        {analysis.weaknesses.map((f) => (
                          <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-chalk-300">
                            <span aria-hidden className="mt-2 size-1 shrink-0 bg-blood-500" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </section>

                </div>
              ) : (
                <Card className="border-gold-500/30">
                  <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-gold-400">
                    <ShieldAlert size={20} aria-hidden />
                    {t("pages.heroDetail.analysisPending")}
                  </h2>
                  <p className="mt-3 max-w-2xl leading-relaxed text-chalk-300">
                    {t("pages.heroDetail.analysisText", { name: h.name })}
                  </p>
                  <Link
                    href="/contribute"
                    className="mt-5 inline-block text-sm font-semibold text-gold-400 underline underline-offset-4 hover:text-gold-500"
                  >
                    {t("pages.heroDetail.contribute")}
                  </Link>
                </Card>
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
                          className="mt-4 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
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
                            className="mt-4 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
                          >
                            {t("pages.heroDetail.pageDuos")} →
                          </Link>
                        )}
                      </section>
                    )}

                    {analysis && (analysis.strongAgainst.length > 0 || analysis.weakAgainst.length > 0) && (
                      <section>
                        <h3 className="font-heading text-lg font-bold text-chalk-100">
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
                      <BuildsByRank byLane={buildsShown} guides={guidesShown} />
                    </section>
                  )}
                  {analysis && analysis.builds.length > 0 && (
                  <section>
                  {hasBuilds && (
                    <>
                      <h3 className="font-heading text-lg font-bold text-chalk-100">{t("builds.written")}</h3>
                      <p className="mt-1 mb-5 text-sm text-chalk-500">{t("builds.writtenIntro")}</p>
                    </>
                  )}
                  <div className="space-y-4">
                  {analysis.builds.map((b) => (
                    <Card key={b.name}>
                      <h3 className="font-heading text-lg font-bold text-gold-400">{b.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-chalk-500">{b.context}</p>
                      <ol className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {b.items.map((o, i) => (
                          <BuildItem key={o} name={o} rank={i + 1} />
                        ))}
                      </ol>
                      <div className="mt-5 grid gap-3 border-t border-night-800 pt-4 sm:grid-cols-3">
                        <BuildPicker label={t("builds.emblem")} name={b.emblem} image={visualEmblem(b.emblem).image} href={visualEmblem(b.emblem).href} />
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
                    byRank={Object.fromEntries(
                      Object.entries(statsRanks).map(([r, s]) => [r, { win: s.winRate, ban: s.banRate }]),
                    )}
                    adjustments={heroAdjustments.map((a) => ({ version: a.version, type: a.adjustment.type }))}
                  />
                  <section>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="font-heading text-lg font-bold text-chalk-100">
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
                        className="inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
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
      </div>
      </RankProvider>
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
      <h3 className="text-sm font-semibold text-chalk-100">{title}</h3>
      <ul className="mt-4 flex flex-wrap gap-2">
        {slugs.map((s) => (
          <li key={s}>
            <Link
              href={`/heroes/${s}`}
              className={`bevel-sm border px-2.5 py-1 text-sm transition-colors ${
                tone === "good"
                  ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  : "border-blood-500/30 text-blood-500 hover:bg-blood-500/10"
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
    sentences.push(
      t("pages.heroPreview.trend", {
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
