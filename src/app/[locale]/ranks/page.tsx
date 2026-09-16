import type { Metadata } from "next";
import { OpenAnchor } from "@/components/open-anchor";
import Image from "next/image";
import { Shield, Star, Swords } from "lucide-react";
import { FreshnessLine } from "@/components/freshness";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { classesChip } from "@/components/chip";
import { CardsTable } from "@/components/cards-table";
import { Card, PageHeader } from "@/components/ui";
import { Foldable } from "@/components/foldable";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT, type T } from "@/i18n/translations";
import {
  SCALE,
  REWARDS_SEASON,
  RULES_FAMILY,
  SOURCES_RANKS,
  tierAppearance,
  tierOfFamily,
  type FamilyRank,
  type TierScale,
} from "@/lib/rank-scale";
import { longDate, dateMeasure, listNames, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { site } from "@/lib/site";
import { rankingOfRank, RANKS_CLASSES } from "@/lib/tier-list";

/**
 * Rank system: the ladder from Warrior to Mythical Immortal, its divisions,
 * its stars and its points, then what our measurements say about each rank
 * slice (the heroes that win the most there). The structure comes from
 * `rank-scale.ts`, the rates from the tier list: the page follows the
 * syncs without any touch-up.
 */
type Params = { params: Promise<{ locale: Locale }> };

const PATH = "/ranks";
const TOP = 5;
const FAMILIES: FamilyRank[] = ["warrior", "elite", "master", "grandmaster", "epic", "legend", "mythic"];
const SECTIONS = [
  ["scale", "scaleTitle"],
  ["table", "tableTitle"],
  ["mythic", "mythicTitle"],
  ["heroes", "heroesTitle"],
  ["season", "seasonTitle"],
] as const;

/** Legend has no rank name in the catalog: we reuse that of its measurement slice. */
const nameTier = (t: T, key: string) => (key === "legend" ? t("measuredRanks.legend") : t(`rankNames.${key}`));

const pathTierList = (r: MeasuredRank) => (r === "all" ? "/tier-list" : `/tier-list/${r}`);

/** Points that open a mythic tier, read from the ladder rather than written in the labels. */
const thresholdMythic = (key: string) => SCALE.find((p) => p.key === key)?.points?.min ?? 0;

/** The heroes that win the most in a rank slice, excluding samples that are too thin. */
function best(rank: MeasuredRank) {
  return rankingOfRank(rank)
    .filter((e) => !e.lowSample)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, TOP);
}

function description(locale: Locale) {
  const t = createT(locale);
  const top = best("mythic").slice(0, 3).map((e) => e.hero.name);
  return top.length
    ? t("pages.seo.ranks.description", { n: SCALE.length, top: listNames(locale, top), date: longDate(locale) })
    : t("pages.seo.ranks.descriptionSimple", { n: SCALE.length });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.ranks.title"),
    description: description(locale),
    path: PATH,
    keywords: ["rank system", "ranks", "Mythical Immortal", "Mythical Glory", "stars", "season rewards", "MLBB"],
  });
}

function Emblem({ tier, size = 56 }: { tier: TierScale; size?: number }) {
  const { image, color } = tierAppearance(tier);
  // The rank name is written next to it: the emblem is decorative.
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
      />
    );
  }
  return (
    <span aria-hidden className="grid shrink-0 place-items-center" style={{ width: size, height: size, color }}>
      <Shield size={Math.round(size * 0.8)} strokeWidth={1.5} />
    </span>
  );
}

function BlockTitle({ id, children, intro }: { id: string; children: React.ReactNode; intro?: string }) {
  return (
    <>
      <h2 id={`${id}-title`} className="font-heading text-xl font-bold text-chalk-100 sm:text-3xl">
        {children}
      </h2>
      <div aria-hidden className="gold-rule mt-1.5 h-0.5 w-16" />
      {intro && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-300 sm:text-base">{intro}</p>}
    </>
  );
}

export default async function RanksPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const integer = new Intl.NumberFormat(locale);
  const title = t("pages.ranks.title");
  const heads = best("all").map((e) => e.hero.slug);
  const atTop = best("glory").filter((e) => !heads.includes(e.hero.slug)).map((e) => e.hero.name);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description: description(locale),
    url: `${site.url}/${locale}${PATH}`,
    inLanguage: LOCALE_HTML[locale],
    dateModified: dateMeasure,
    isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
    mainEntity: {
      "@type": "ItemList",
      name: t("pages.ranks.scaleTitle"),
      numberOfItems: SCALE.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: SCALE.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: nameTier(t, p.key) })),
    },
  };

  /** The five heroes that win the most in a rank slice, as one card. */
  const cardRank = (r: MeasuredRank) => {
    const list = best(r);
    if (!list.length) return null;
    const tier = SCALE.find((p) => p.measure === r);
    return (
      <Card key={r} className="flex flex-col p-4">
        <div className="flex items-center gap-3">
          {tier ? (
            <Emblem tier={tier} size={36} />
          ) : (
            <span aria-hidden className="grid size-9 place-items-center text-gold-400">
              <Swords size={24} />
            </span>
          )}
          <h3 className="font-heading text-lg font-bold text-chalk-100">{t(`measuredRanks.${r}`)}</h3>
        </div>
        <ol className="mt-2.5 flex-1 space-y-1.5">
          {list.map((e, i) => (
            <li key={e.hero.slug}>
              <Link href={`/heroes/${e.hero.slug}`} className="group flex items-center gap-3">
                <span className="w-4 text-right text-xs tabular-nums text-chalk-500">{i + 1}</span>
                <HeroPortrait
                  source={e.hero.images.icon ?? e.hero.images.portrait}
                  name={e.hero.name}
                  size="small"
                  decorative
                />
                <span className="min-w-0 flex-1 truncate font-medium text-chalk-200 transition-colors group-hover:text-gold-400">
                  {e.hero.name}
                </span>
                <span className="text-sm tabular-nums text-chalk-300">
                  <span className="sr-only">{t("pages.ranks.win")} </span>
                  {percentage(locale, e.winRate)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <Link
          href={pathTierList(r)}
          className="mt-3 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
        >
          {r === "all" ? t("pages.ranks.tierListAllLink") : t("pages.ranks.tierListLink", { rank: t(`measuredRanks.${r}`) })}{" "}
          →
        </Link>
      </Card>
    );
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      {/* Section anchors before they were named in English, still found in shared links. */}
      <OpenAnchor aliases={{ echelle: "scale", tableau: "table", heros: "heroes", saison: "season" }} />
      <PageHeader title={title} lead={t("pages.ranks.lead")}>
        <FreshnessLine locale={locale} className="mt-3" />
        <nav aria-label={t("pages.ranks.contents")} className="mt-3 flex flex-wrap gap-2">
          {SECTIONS.map(([id, key]) => (
            <a key={id} href={`#${id}`} className={classesChip(false, true)}>
              {t(`pages.ranks.${key}`)}
            </a>
          ))}
        </nav>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-8 px-4 pb-10 pt-5 sm:space-y-14">
        <section id="scale" aria-labelledby="scale-title" className="scroll-mt-20">
          <BlockTitle id="scale" intro={t("pages.ranks.scaleIntro", { n: SCALE.length })}>
            {t("pages.ranks.scaleTitle")}
          </BlockTitle>
          <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SCALE.map((p, i) => {
              const { color } = tierAppearance(p);
              const bans = RULES_FAMILY[p.family].bans;
              return (
                <li key={p.key}>
                  <Card className="flex h-full gap-3 p-3">
                    <Emblem tier={p} size={44} />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-lg font-bold leading-tight" style={{ color }}>
                        {nameTier(t, p.key)}
                        <span className="ml-2 align-middle text-xs font-medium text-chalk-500">
                          {t("pages.ranks.position", { n: i + 1, total: SCALE.length })}
                        </span>
                      </h3>
                      <p className="mt-0.5 text-sm text-chalk-300">
                        {p.points === null
                          ? t("pages.ranks.divisions", { n: p.divisions.length, list: p.divisions.join(" → ") })
                          : p.points.max === null
                            ? t("pages.ranks.pointsPlus", { min: p.points.min })
                            : t("pages.ranks.pointsBetween", { min: p.points.min, max: p.points.max })}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {p.starsMax !== null && (
                          <span className="flex items-center gap-1 text-chalk-400">
                            <Star size={12} aria-hidden className="fill-current text-gold-400" />
                            {t("pages.ranks.starsPerDivision", { n: p.starsMax })}
                          </span>
                        )}
                        {bans !== null && (
                          <span className="bevel-sm bg-azure-500/15 px-2 py-0.5 text-azure-400">
                            {t("pages.ranks.draft", { n: bans })}
                          </span>
                        )}
                        {p.measure && (
                          <Link
                            href={pathTierList(p.measure)}
                            className="font-semibold text-gold-400 transition-colors hover:text-gold-500"
                          >
                            {t("pages.ranks.tierListLink", { rank: t(`measuredRanks.${p.measure}`) })} →
                          </Link>
                        )}
                      </p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 max-w-3xl text-sm text-chalk-500">{t("pages.ranks.scaleNote")}</p>
        </section>

        <section id="table" aria-labelledby="table-title" className="scroll-mt-20">
          <BlockTitle id="table" intro={t("pages.ranks.tableIntro")}>
            {t("pages.ranks.tableTitle")}
          </BlockTitle>
          {/*
            Six columns need 40 rem: the table used to sit in a horizontal
            scroller a phone had to drag. `CardsTable` turns each rank into a
            card below `sm`, and the whole reference table waits behind a
            summary line — the rules are checked, not read through.
          */}
          <Foldable label={t("pages.ranks.openTable")} className="mt-5">
            <CardsTable
              t={t}
              caption={t("pages.ranks.tableTitle")}
              rows={FAMILIES}
              rowKey={(f) => f}
              columns={[
                {
                  key: "rank",
                  label: t("pages.ranks.colRank"),
                  head: true,
                  cell: (f) => {
                    const p = tierOfFamily(f);
                    return (
                      <span className="flex items-center gap-2">
                        <Emblem tier={p} size={28} />
                        <span className="font-semibold" style={{ color: tierAppearance(p).color }}>
                          {f === "mythic" ? t("pages.ranks.mythicFamily") : nameTier(t, p.key)}
                        </span>
                      </span>
                    );
                  },
                },
                {
                  key: "divisions",
                  label: t("pages.ranks.colDivisions"),
                  cell: (f) => {
                    const p = tierOfFamily(f);
                    return p.divisions.length ? p.divisions.join(" · ") : "—";
                  },
                },
                {
                  key: "stars",
                  label: t("pages.ranks.colStars"),
                  cell: (f) => tierOfFamily(f).starsMax ?? t("pages.ranks.pointsInstead"),
                },
                {
                  key: "draft",
                  label: t("pages.ranks.colDraft"),
                  cell: (f) =>
                    RULES_FAMILY[f].bans === null
                      ? t("pages.ranks.noDraft")
                      : t("pages.ranks.bans", { n: RULES_FAMILY[f].bans! }),
                },
                {
                  key: "promotion",
                  label: t("pages.ranks.colPromotion"),
                  cell: (f) =>
                    RULES_FAMILY[f].climbPoints === null ? "—" : integer.format(RULES_FAMILY[f].climbPoints!),
                },
                {
                  key: "protection",
                  label: t("pages.ranks.colProtection"),
                  cell: (f) => integer.format(RULES_FAMILY[f].pointsProtection),
                },
              ]}
            />
            <p className="mt-3 max-w-3xl text-sm text-chalk-500">{t("pages.ranks.tableNote")}</p>
          </Foldable>
        </section>

        <section id="mythic" aria-labelledby="mythic-title" className="scroll-mt-20">
          <BlockTitle
            id="mythic"
            intro={t("pages.ranks.mythicIntro", {
              honor: thresholdMythic("mythic-honor"),
              glory: thresholdMythic("mythic-glory"),
              immortal: thresholdMythic("mythic-immortal"),
            })}
          >
            {t("pages.ranks.mythicTitle")}
          </BlockTitle>
          <ol className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {SCALE.filter((p) => p.points).map((p) => (
              <li key={p.key}>
                <Card className="flex h-full flex-col items-center p-3 text-center">
                  <Emblem tier={p} size={44} />
                  <h3 className="mt-1.5 font-heading text-base font-bold leading-tight" style={{ color: tierAppearance(p).color }}>
                    {nameTier(t, p.key)}
                  </h3>
                  <p className="text-sm tabular-nums text-chalk-300">
                    {p.points!.max === null
                      ? t("pages.ranks.pointsPlus", { min: p.points!.min })
                      : t("pages.ranks.pointsBetween", { min: p.points!.min, max: p.points!.max })}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
          <p className="mt-3 max-w-3xl text-sm text-chalk-400">{t("pages.ranks.mythicCoins")}</p>
        </section>

        <section id="heroes" aria-labelledby="heroes-title" className="scroll-mt-20">
          <BlockTitle id="heroes" intro={t("pages.ranks.heroesIntro", { n: TOP })}>
            {t("pages.ranks.heroesTitle")}
          </BlockTitle>
          {/*
            Six lists of five heroes is three screens of a phone for one
            reading: the combined ranking answers the question, the rank by
            rank breakdown is the follow-up. It stays in the document, folded.
          */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RANKS_CLASSES.slice(0, 1).map((r) => cardRank(r))}
          </div>
          <Foldable label={t("pages.ranks.openRanks", { n: RANKS_CLASSES.length - 1 })} className="mt-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {RANKS_CLASSES.slice(1).map((r) => cardRank(r))}
            </div>
          </Foldable>
          {atTop.length > 0 && (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-chalk-300 sm:text-base">
              {t("pages.ranks.heroesGap", { names: listNames(locale, atTop), rank: t("measuredRanks.glory") })}
            </p>
          )}
          <p className="mt-3 max-w-3xl text-sm text-chalk-500">{t("pages.ranks.heroesNote")}</p>
        </section>

        <section id="season" aria-labelledby="season-title" className="scroll-mt-20">
          <BlockTitle id="season">{t("pages.ranks.seasonTitle")}</BlockTitle>
          <div className="mt-3 max-w-3xl space-y-2.5 text-sm leading-relaxed text-chalk-300 sm:text-base">
            <p>{t("pages.ranks.reset1")}</p>
            <p>{t("pages.ranks.reset2")}</p>
            <p>{t("pages.ranks.journey")}</p>
            <p>
              <Link href="/tools/server-time" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
                {t("pages.ranks.serverTimeLink")} →
              </Link>
            </p>
          </div>

          <Foldable label={t("pages.ranks.rewardsTitle")} className="mt-6">
            <CardsTable
              t={t}
              caption={t("pages.ranks.rewardsTitle")}
              rows={REWARDS_SEASON}
              rowKey={(r) => r.family}
              columns={[
                {
                  key: "rank",
                  label: t("pages.ranks.colFinalRank"),
                  head: true,
                  cell: (r) => {
                    const p = tierOfFamily(r.family);
                    return (
                      <span className="flex items-center gap-2">
                        <Emblem tier={p} size={28} />
                        <span className="font-semibold" style={{ color: tierAppearance(p).color }}>
                          {r.family === "mythic" ? t("pages.ranks.mythicFamily") : nameTier(t, p.key)}
                        </span>
                      </span>
                    );
                  },
                },
                {
                  key: "battlePoints",
                  label: t("pages.ranks.colBattlePoints"),
                  cell: (r) => integer.format(r.battlePoints),
                },
                { key: "tickets", label: t("pages.ranks.colTickets"), cell: (r) => integer.format(r.tickets) },
                {
                  key: "fragments",
                  label: t("pages.ranks.colFragments"),
                  cell: (r) => (r.fragments === null ? "—" : integer.format(r.fragments)),
                },
                {
                  key: "others",
                  label: t("pages.ranks.colOthers"),
                  cell: (r) => (r.emblem ? t("pages.ranks.emote") : "—"),
                },
              ]}
            />
            <p className="mt-3 max-w-3xl text-sm text-chalk-500">{t("pages.ranks.rewardsNote")}</p>
          </Foldable>
        </section>

        <Foldable label={t("common.method")}>
          <div className="space-y-10">
            <section aria-labelledby="sources-title" className="text-sm text-chalk-500">
              <h2 id="sources-title" className="font-semibold text-chalk-300">{t("pages.ranks.sourcesTitle")}</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <a href={SOURCES_RANKS.ranked} rel="noopener" className="underline transition-colors hover:text-gold-400">
                    {t("pages.ranks.sourceRanked")}
                  </a>
                </li>
                <li>
                  <a href={SOURCES_RANKS.rewards} rel="noopener" className="underline transition-colors hover:text-gold-400">
                    {t("pages.ranks.sourceRewards")}
                  </a>
                </li>
                <li>
                  <a href={SOURCES_RANKS.table} rel="noopener" className="underline transition-colors hover:text-gold-400">
                    {t("pages.ranks.sourceTable")}
                  </a>
                </li>
                <li>{t("pages.ranks.sourceMeasures", { date: longDate(locale) })}</li>
              </ul>
            </section>
          </div>
        </Foldable>
      </div>
    </>
  );
}
