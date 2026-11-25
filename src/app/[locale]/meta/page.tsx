import type { Metadata } from "next";
import Image from "next/image";
import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { FreshnessLine } from "@/components/freshness";
import { HeroPortrait } from "@/components/hero-portrait";
import { ActionLink, BadgeTier, SectionTitle } from "@/components/ui";
import { HeroTile } from "@/components/hero-tile";
import { DexSays } from "@/components/mascot";
import { DexNotice } from "@/components/dex-states";
import { MetaPoster, artOf } from "@/components/meta/meta-poster";
import { PosterHero } from "@/components/meta/poster-hero";
import { allHeroes, heroesBySlug } from "@/lib/data";
import { LANES } from "@/lib/draft";
import { trendsOf } from "@/lib/evolution";
import { imageLane } from "@/lib/emblems";
import { pathFilter } from "@/lib/tier-list-filters";
import { longDate, dateMeasure, patchCurrent, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import {
  changesOfTier,
  groupAdjustments,
  firstNBy,
  ADJUSTMENT_DIRECTIONS,
  type ChangeTier,
  type AdjustmentDirection,
} from "@/lib/meta-report";
import { site } from "@/lib/site";
import { describeGap, formatGap, movesWeek, moversWeek, THRESHOLD_NOTABLE, type Motion } from "@/lib/trends";
import { rankingFull, ruleTierList, type RankedEntry } from "@/lib/tier-list";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale }> };

/**
 * Weekly meta report.
 *
 * Page generated at build time from the synced data, and therefore rebuilt at
 * each daily sync: win rate risers and fallers,
 * tier changes, most banned and most played heroes, latest
 * patch, best heroes per lane. No invented prose: each sentence is
 * a template filled with the measurement's figures, and a section without data
 * says so rather than embellishing.
 */
const PATH = "/meta";
/** Rows per list: enough to see the movement, without redoing the tier list. */
const COUNT = 5;
const COUNT_TIERS = 8;
/** Ban and pick movers per direction: the win rate keeps the longer lists. */
const COUNT_MOVERS = 3;

const READING = (() => {
  const series = allHeroes.map((h) => ({ slug: h.slug, series: trendsOf(h.slug).all }));
  const week = movesWeek(series, COUNT);
  const movers = moversWeek(series, COUNT_MOVERS, ["banRate", "pickRate"]);
  const tiers = changesOfTier(
    rankingFull.map((e) => ({ slug: e.hero.slug, series: trendsOf(e.hero.slug).all, tierCurrent: e.tier })),
    ruleTierList,
  );
  return {
    week,
    movers,
    tiers,
    banned: firstNBy(rankingFull, (e) => e.banRate, COUNT),
    played: firstNBy(rankingFull, (e) => e.pickRate, COUNT),
    patch: patchCurrent ? groupAdjustments(patchCurrent.adjustments) : null,
    byLane: LANES.map((lane) => ({
      lane,
      entries: rankingFull.filter((e) => e.hero.lanes.includes(lane)).slice(0, 3),
    })),
  };
})();

const version = () => patchCurrent?.version ?? "—";

const titleSeo = (t: T, locale: Locale) => t("pages.seo.meta.title", { date: longDate(locale), v: version() });

function descriptionReport(t: T, locale: Locale): string {
  const first = rankingFull[0];
  const banned = READING.banned[0];
  if (!first || !banned) {
    return t("pages.meta.lead", { date: longDate(locale), n: rankingFull.length, v: version() });
  }
  return t("pages.seo.meta.description", {
    date: longDate(locale),
    v: version(),
    first: first.hero.name,
    banned: banned.hero.name,
    ban: percentage(locale, banned.banRate),
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: titleSeo(t, locale),
    description: descriptionReport(t, locale),
    path: PATH,
    type: "article",
    published: dateMeasure,
  });
}

const COLOR: Record<AdjustmentDirection, string> = {
  buff: "text-azure-400",
  nerf: "text-blood-400",
  adjust: "text-chalk-300",
};

export default async function MetaReportPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const { week, movers, tiers, banned, played, patch, byLane } = READING;
  const date = longDate(locale);
  const threshold = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(THRESHOLD_NOTABLE);
  const one = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const name = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;
  const first = rankingFull[0];
  const rise = week.rises[0];
  const drop = week.drops[0];
  const changes = tiers.climbs.length + tiers.drops.length;

  // The summary: template sentences filled with figures, nothing else.
  const summary = [
    first &&
      t("pages.meta.summary.top", {
        name: first.hero.name,
        tier: first.tier,
        winRate: percentage(locale, first.winRate),
        ban: percentage(locale, first.banRate),
      }),
    rise &&
      t("pages.meta.summary.rise", {
        name: name(rise.slug),
        before: percentage(locale, rise.variation.before),
        current: percentage(locale, rise.variation.current),
        days: rise.variation.days,
      }),
    drop &&
      t("pages.meta.summary.fall", {
        name: name(drop.slug),
        before: percentage(locale, drop.variation.before),
        current: percentage(locale, drop.variation.current),
        days: drop.variation.days,
      }),
    changes > 0 &&
      t("pages.meta.summary.tiers", { risers: tiers.climbs.length, fallers: tiers.drops.length }),
    banned[0] && t("pages.meta.summary.banned", { name: banned[0].hero.name, ban: percentage(locale, banned[0].banRate) }),
  ].filter((p): p is string => typeof p === "string");

  // Article dated by the measurement: it is what changes the content, every day.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: titleSeo(t, locale),
    description: descriptionReport(t, locale),
    datePublished: dateMeasure,
    dateModified: dateMeasure,
    inLanguage: LOCALE_HTML[locale],
    image: `${site.url}/opengraph-image`,
    author: { "@type": "Organization", name: site.name, url: site.url },
    publisher: { "@type": "Organization", name: site.name, url: site.url },
    mainEntityOfPage: `${site.url}/${locale}${PATH}`,
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };

  // The poster: the week's biggest riser, its gain as the one big figure; the
  // head of the tier list when nobody moved.
  const riser = rise ? heroesBySlug.get(rise.slug) : undefined;
  const ranked = (slug: string) => rankingFull.find((e) => e.hero.slug === slug);
  const posterHero = riser ?? first?.hero;
  const feature =
    riser && rise ? (
      <PosterHero
        href={`/heroes/${riser.slug}`}
        kicker={t("pages.meta.poster.kicker")}
        name={riser.name}
        tier={ranked(riser.slug)?.tier}
        figure={formatGap(rise.variation.gap, locale)}
        unit={` ${t("counters.pts")}`}
        tone="ally"
        caption={t("pages.meta.poster.caption", { days: rise.variation.days })}
        second={{ value: one.format(rise.variation.current), caption: t("pages.heroDetail.stat.winRate") }}
        label={`${riser.name} : ${describeGap(t, locale, rise.variation.gap, rise.variation.days)}, ${percentage(locale, rise.variation.current)}`}
      />
    ) : first ? (
      <PosterHero
        href={`/heroes/${first.hero.slug}`}
        kicker={t("pages.tierList.poster.kicker")}
        name={first.hero.name}
        tier={first.tier}
        figure={one.format(first.winRate)}
        caption={t("pages.heroDetail.stat.winRate")}
        label={`${first.hero.name}, ${t("home.winRate", { value: percentage(locale, first.winRate) })}`}
      />
    ) : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <MetaPoster
        title={t("pages.meta.title", { date })}
        lead={t("pages.meta.lead", { date, n: rankingFull.length, v: version() })}
        art={posterHero ? artOf(posterHero.slug) : null}
        portrait={posterHero?.images.portrait ?? null}
        feature={feature}
      >
        <FreshnessLine locale={locale} className="mt-3" />
        {summary.length > 0 && (
          <ul className="mt-4 max-w-xl space-y-1.5 text-sm leading-snug text-chalk-300 sm:leading-relaxed">
            {summary.map((sentence) => (
              <li key={sentence} className="flex gap-2.5">
                <span aria-hidden className="mt-[0.45em] h-[3px] w-3 shrink-0 -skew-x-[30deg] bg-gold-400" />
                {sentence}
              </li>
            ))}
          </ul>
        )}
      </MetaPoster>

      <div className="page-wrap space-y-14 pb-10 pt-10 sm:space-y-20 sm:pt-14">
        {/* ── Risers and fallers ─────────────────────────────────────────── */}
        <section>
          <SectionTitle lead={t("home.trends.lead", { threshold: threshold })}>{t("home.trends.title")}</SectionTitle>
          <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
            <MoveTiles
              title={t("home.trends.rise")}
              empty={t("home.trends.noRise")}
              moves={week.rises}
              rise
              locale={locale}
              t={t}
            />
            <MoveTiles
              title={t("home.trends.fall")}
              empty={t("home.trends.noFall")}
              moves={week.drops}
              rise={false}
              locale={locale}
              t={t}
            />
          </div>
        </section>

        {/* ── Ban and pick movers ────────────────────────────────────────── */}
        <section id="movers" aria-labelledby="movers-title" className="scroll-mt-24">
          <SectionTitle id="movers-title" lead={t("pages.meta.movers.lead", { threshold })}>
            {t("pages.meta.movers.title")}
          </SectionTitle>
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {movers.map(({ measure, rises, drops }) => (
              <div key={measure} className="space-y-4">
                <h3 className="type-subtitle text-chalk-100">{t(`pages.meta.movers.${measure}`)}</h3>
                <Moves
                  title={t("home.trends.rise")}
                  empty={t("home.trends.noRise")}
                  moves={rises}
                  rise
                  unit={t(`pages.meta.movers.unit.${measure}`)}
                  locale={locale}
                  t={t}
                />
                <Moves
                  title={t("home.trends.fall")}
                  empty={t("home.trends.noFall")}
                  moves={drops}
                  rise={false}
                  unit={t(`pages.meta.movers.unit.${measure}`)}
                  locale={locale}
                  t={t}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Tier changes ───────────────────────────────────────────────── */}
        <section>
          <SectionTitle lead={t("pages.meta.tiers.lead")}>{t("pages.meta.tiers.title")}</SectionTitle>
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            <Tiers
              title={t("pages.meta.tiers.promotions")}
              empty={t("pages.meta.tiers.noPromotion")}
              changes={tiers.climbs.slice(0, COUNT_TIERS)}
              rise
              t={t}
            />
            <Tiers
              title={t("pages.meta.tiers.demotions")}
              empty={t("pages.meta.tiers.noDemotion")}
              changes={tiers.drops.slice(0, COUNT_TIERS)}
              rise={false}
              t={t}
            />
          </div>
        </section>

        {/* ── Bans and picks: the bans as portraits, the picks as lines ─── */}
        <section>
          <SectionTitle lead={t("pages.meta.bansPicks.lead", { date })}>
            {t("pages.meta.bansPicks.title")}
          </SectionTitle>
          <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="min-w-0">
              <h3 className="type-subtitle text-chalk-100">{t("pages.meta.bansPicks.banned")}</h3>
              <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
                {banned.map((e, i) => (
                  <li key={e.hero.slug} className="min-w-0">
                    <HeroTile
                      href={`/heroes/${e.hero.slug}`}
                      name={e.hero.name}
                      portrait={e.hero.images.portrait ?? e.hero.images.icon}
                      rank={i + 1}
                      figure={percentage(locale, e.banRate)}
                      tone="enemy"
                      label={`${t("pages.heroDetail.stat.banRate")} ${percentage(locale, e.banRate)}`}
                      sizes="(min-width: 1024px) 11vw, (min-width: 640px) 18vw, 31vw"
                    />
                  </li>
                ))}
              </ol>
            </div>
            <Ranking
              title={t("pages.meta.bansPicks.played")}
              entries={played}
              value={(e) => percentage(locale, e.pickRate)}
            />
          </div>
        </section>

        {/* ── Latest patch ───────────────────────────────────────────────── */}
        {patchCurrent && patch && (
          <section>
            <SectionTitle
              lead={
                patchCurrent.date
                  ? t("pages.patchNotes.publishedOn", { date: longDate(locale, patchCurrent.date) })
                  : undefined
              }
              action={{ href: `/patch-notes/${patchCurrent.version}`, label: t("home.readNotes") }}
            >
              {t("pages.meta.patch.title", { v: patchCurrent.version })}
            </SectionTitle>
            <div className="space-y-7">
              {patchCurrent.newHeroes.length > 0 && (
                <HeroGroup title={t("pages.meta.patch.newcomers")} list={patchCurrent.newHeroes} color="text-gold-400" />
              )}
              {ADJUSTMENT_DIRECTIONS.map((direction) =>
                patch[direction].length > 0 ? (
                  <HeroGroup
                    key={direction}
                    title={t(`patchHeroes.plural.${direction}`)}
                    list={patch[direction]}
                    color={COLOR[direction]}
                  />
                ) : null,
              )}
              {patchCurrent.newHeroes.length === 0 && ADJUSTMENT_DIRECTIONS.every((s) => patch[s].length === 0) && (
                <DexSays pose="dodo" height={96}>
                  <p className="text-sm">{t("pages.meta.patch.none")}</p>
                </DexSays>
              )}
            </div>
          </section>
        )}

        {/* ── Best heroes per lane: the first as a portrait, the next two as lines ── */}
        <section>
          <SectionTitle lead={t("pages.meta.lanes.lead")}>{t("pages.meta.lanes.title")}</SectionTitle>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5">
            {byLane.map(({ lane, entries }) => {
              const [lead, ...rest] = entries;
              return (
                <div key={lane} className="flex min-w-0 flex-col">
                  <h3 className="flex items-center gap-2 font-heading text-lg font-bold uppercase text-gold-400">
                    {/* The lane is named beside it: the icon is decorative. */}
                    {imageLane(lane) && (
                      <Image src={imageLane(lane)!} alt="" width={22} height={22} className="size-5 shrink-0 object-contain" />
                    )}
                    {t(`lanes.${lane}`)}
                  </h3>
                  <ol className="mt-3 flex-1 space-y-2">
                    {lead && (
                      <li>
                        <HeroTile
                          href={`/heroes/${lead.hero.slug}`}
                          name={lead.hero.name}
                          portrait={lead.hero.images.portrait ?? lead.hero.images.icon}
                          figure={percentage(locale, lead.winRate)}
                          label={t("pages.meta.lanes.row", { tier: lead.tier, winRate: percentage(locale, lead.winRate) })}
                          sizes="(min-width: 1024px) 17vw, (min-width: 640px) 30vw, 46vw"
                        />
                      </li>
                    )}
                    {rest.map((e) => (
                      <li key={e.hero.slug}>
                        <Link href={`/heroes/${e.hero.slug}`} className="group flex items-center gap-2.5 py-0.5">
                          <HeroPortrait
                            source={e.hero.images.icon ?? e.hero.images.portrait}
                            name={e.hero.name}
                            size="small"
                            decorative
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate display-caps text-base text-chalk-100 transition-colors group-hover:text-gold-300">
                              {e.hero.name}
                            </span>
                            <span className="block text-xs leading-tight text-chalk-500">
                              {t("pages.meta.lanes.row", { tier: e.tier, winRate: percentage(locale, e.winRate) })}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                  <ActionLink href={pathFilter({ type: "lane", value: lane })} className="mt-3 text-sm">
                    {t("pages.meta.lanes.see", { lane: t(`pages.tierList.laneSeo.${lane}`) })}
                  </ActionLink>
                </div>
              );
            })}
          </div>
        </section>

        <div>
          <div aria-hidden className="eclat-rule mb-8" />
          <DexSays pose="reflexion" height={110}>
            <p className="text-sm leading-relaxed">{t("pages.meta.method", { date, threshold: threshold })}</p>
          </DexSays>
        </div>
      </div>
    </>
  );
}

/** A hero row: portrait, name, a detail under the name, a value on the right. */
function HeroRow({ slug, detail, children }: { slug: string; detail?: string; children?: React.ReactNode }) {
  const h = heroesBySlug.get(slug);
  if (!h) return null;
  return (
    <Link
      href={`/heroes/${slug}`}
      className="bevel-sm group flex items-center gap-3 bg-night-900 p-2 pr-3 transition-[background-color,translate] duration-200 hover:-translate-y-0.5 hover:bg-night-850"
    >
      <HeroPortrait source={h.images.icon ?? h.images.portrait} name={h.name} size="icon" decorative />
      <span className="min-w-0 flex-1">
        <span className="block truncate display-caps text-lg text-chalk-100 transition-colors group-hover:text-gold-300">
          {h.name}
        </span>
        {detail && <span className="mt-0.5 block text-xs text-chalk-500">{detail}</span>}
      </span>
      {children}
    </Link>
  );
}

/** The week's win rate risers or fallers, as portraits: the gap in points is the figure. */
function MoveTiles({
  title,
  empty,
  moves,
  rise,
  locale,
  t,
}: {
  title: string;
  empty: string;
  moves: Motion[];
  rise: boolean;
  locale: Locale;
  t: T;
}) {
  const Icon = rise ? TrendingUp : TrendingDown;
  return (
    <div className="min-w-0">
      <h3 className={cn("type-subtitle flex items-center gap-2", rise ? "text-azure-400" : "text-blood-400")}>
        <Icon size={20} aria-hidden />
        {title}
      </h3>
      {moves.length === 0 ? (
        <DexSays pose="surpris" height={84} className="mt-4">
          <p className="text-sm">{empty}</p>
        </DexSays>
      ) : (
        <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
          {moves.map(({ slug, variation: v }) => {
            const h = heroesBySlug.get(slug);
            return (
              <li key={slug} className="min-w-0">
                <HeroTile
                  href={`/heroes/${slug}`}
                  name={h?.name ?? slug}
                  portrait={h?.images.portrait ?? h?.images.icon ?? null}
                  figure={formatGap(v.gap, locale)}
                  tone={rise ? "ally" : "enemy"}
                  label={`${describeGap(t, locale, v.gap, v.days)} · ${percentage(locale, v.current)}`}
                  sizes="(min-width: 1024px) 9vw, (min-width: 640px) 18vw, 31vw"
                />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Ban or pick risers or fallers: rate seven days ago and today, gap in points. */
function Moves({
  title,
  empty,
  moves,
  rise,
  unit,
  locale,
  t,
}: {
  title: string;
  empty: string;
  moves: Motion[];
  rise: boolean;
  /** Unit after a row's two rates: "% ban rate". */
  unit: string;
  locale: Locale;
  t: T;
}) {
  const Icon = rise ? TrendingUp : TrendingDown;
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div>
      <h4
        className={cn(
          "mb-2 flex items-center gap-2 font-heading text-base font-bold",
          rise ? "text-azure-400" : "text-blood-400",
        )}
      >
        <Icon size={16} aria-hidden />
        {title}
      </h4>
      {moves.length === 0 ? (
        <DexNotice pose="surpris">{empty}</DexNotice>
      ) : (
        <ol className="space-y-1.5">
          {moves.map(({ slug, variation: v }) => (
            <li key={slug}>
              <HeroRow slug={slug} detail={`${percent.format(v.before)} → ${percent.format(v.current)} ${unit}`}>
                <span className={cn("score shrink-0 text-2xl", rise ? "text-azure-400" : "text-blood-400")}>
                  <span aria-hidden>{formatGap(v.gap, locale)}</span>
                  <span className="sr-only">{describeGap(t, locale, v.gap, v.days)}</span>
                </span>
              </HeroRow>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Tier promotions or demotions: old and new tier. */
function Tiers({
  title,
  empty,
  changes,
  rise,
  t,
}: {
  title: string;
  empty: string;
  changes: ChangeTier[];
  rise: boolean;
  t: T;
}) {
  const Icon = rise ? TrendingUp : TrendingDown;
  return (
    <div className="min-w-0">
      <h3 className={cn("type-subtitle mb-3 flex items-center gap-2", rise ? "text-azure-400" : "text-blood-400")}>
        <Icon size={20} aria-hidden />
        {title}
      </h3>
      {changes.length === 0 ? (
        <DexSays pose="surpris" height={84}>
          <p className="text-sm">{empty}</p>
        </DexSays>
      ) : (
        <ol className="space-y-1.5">
          {changes.map((c) => (
            <li key={c.slug}>
              <HeroRow slug={c.slug}>
                <span aria-hidden className="flex shrink-0 items-center gap-2">
                  <BadgeTier tier={c.before} size="sm" className="opacity-60" />
                  <span className="text-chalk-500">→</span>
                  <BadgeTier tier={c.after} />
                </span>
                <span className="sr-only">{t("pages.meta.tiers.sr", { before: c.before, after: c.after })}</span>
              </HeroRow>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The top ones by a rate (pick), with the value. */
function Ranking({
  title,
  entries,
  value,
}: {
  title: string;
  entries: RankedEntry[];
  value: (e: RankedEntry) => string;
}) {
  return (
    <div className="min-w-0">
      <h3 className="type-subtitle text-chalk-100">{title}</h3>
      <ol className="mt-4 space-y-1.5">
        {entries.map((e, i) => (
          <li key={e.hero.slug} className="flex items-center gap-3">
            <span aria-hidden className="score score-outline w-5 shrink-0 text-right text-xl">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <HeroRow slug={e.hero.slug}>
                <span className="score shrink-0 text-2xl">{value(e)}</span>
              </HeroRow>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A patch's heroes, as chips: link to the hero page when it exists. */
function HeroGroup({
  title,
  list,
  color,
}: {
  title: string;
  list: { slug: string; name: string }[];
  color: string;
}) {
  return (
    <div>
      <h3 className={cn("type-subtitle", color)}>
        {title} <span className="score score-outline ml-1 text-xl">{list.length}</span>
      </h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {list.map((a) => {
          const h = heroesBySlug.get(a.slug);
          const content = (
            <>
              <HeroPortrait
                source={h?.images.icon ?? h?.images.portrait ?? null}
                name={h?.name ?? a.name}
                size="small"
                decorative
              />
              <span className="display-caps text-base text-chalk-100 transition-colors group-hover:text-gold-300">
                {h?.name ?? a.name}
              </span>
            </>
          );
          const classes = "bevel-sm group flex items-center gap-2 bg-night-900 py-1 pl-1 pr-3";
          return (
            <li key={a.slug}>
              {h ? (
                <Link href={`/heroes/${a.slug}`} className={cn(classes, "transition-[background-color,translate] duration-200 hover:-translate-y-0.5 hover:bg-night-850")}>
                  {content}
                </Link>
              ) : (
                <span className={classes}>{content}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
