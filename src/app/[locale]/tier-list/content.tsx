import type { Metadata } from "next";
import Link from "@/components/link";
import type { Crumb } from "@/components/breadcrumb";
import { freshnessFacts } from "@/components/freshness";
import { Foldable } from "@/components/foldable";
import { BadgeTier, PageHeader } from "@/components/ui";
import { trendsOf } from "@/lib/evolution";
import {
  pathFilter,
  pathRole,
  filterRanking,
  FILTERS_LANE,
  FILTERS_ROLE,
  usualIcon,
  type FilterTier,
} from "@/lib/tier-list-filters";
import { longDate, dateMeasure, listNames, monthYear, patchCurrent, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { rankingOfRank, ORDER_TIERS, RANKS_CLASSES, type RankedEntry } from "@/lib/tier-list";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { describeGap, isNotable, THRESHOLD_NOTABLE, variationWeek } from "@/lib/trends";
import type { Tier } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { heroListData, metaPage } from "@/i18n/seo";
import { tierNotes as tierNotesOf } from "@/lib/data";
import { imageLane, imageRank, imageRole } from "@/lib/emblems";
import { TierLines, type RowTier } from "./tier-lines";
import { TierRows, type TierRow } from "./tier-rows";

/**
 * Tier list of a rank slice, a lane or a role. The main page
 * shows all ranks combined; each rank, each lane and each role has its
 * own address, to be shared and referenced ("tier list mythique",
 * "best jungle heroes"). Lanes and roles cover all ranks: crossing
 * the two would multiply pages without teaching anything more.
 */
const rankPath = (rank: MeasuredRank) => (rank === "all" ? "/tier-list" : `/tier-list/${rank}`);
const pagePath = (rank: MeasuredRank, filter: FilterTier | null) => (filter ? pathFilter(filter) : rankPath(rank));

/**
 * Heroes shown unfolded on arrival.
 *
 * A tier list answers one question — who is strong right now — and its
 * answer is at the top. Paginating it would have cut the ranking at an
 * arbitrary hero and sent B tier to a second address nobody asks for; the
 * ladder is kept whole instead, and the top of it is unfolded: the tiers open
 * one after another while they fit in this budget — about four screens of a
 * phone — and the rest waits one tap away, in the document all the same.
 *
 * Two tiers at most — the top of a ranking is what is read — and a hero
 * budget on top of that, because the tiers are not the same size everywhere:
 * seventeen heroes in S+ and twelve in S on the combined ranking, nineteen
 * and eighteen in the mythic slice, where the second one no longer fits.
 */
const BUDGET_OPEN = 32;
const TIERS_OPEN = 2;

/** The tiers a ranking opens: the first one, then a second if it still fits. */
function tiersOpen(counts: Map<Tier, number>): Set<Tier> {
  const open = new Set<Tier>();
  let shown = 0;
  for (const tier of ORDER_TIERS) {
    const n = counts.get(tier) ?? 0;
    if (n === 0) continue;
    if (open.size > 0 && (open.size >= TIERS_OPEN || shown + n > BUDGET_OPEN)) break;
    open.add(tier);
    shown += n;
  }
  return open;
}

/** The page's ranking: the rank's, restricted to the lane or the role. */
const rankingOf = (rank: MeasuredRank, filter: FilterTier | null) => filterRanking(rankingOfRank(rank), filter);

/** Short name of a lane or a role, the one of the chips and the breadcrumb. */
const nameFilter = (t: T, f: FilterTier) => (f.type === "lane" ? t(`lanes.${f.value}`) : t(`roles.${f.value}`));

/**
 * Forms used by titles and sentences: the lane as
 * players search for it ("gold lane" rather than "Or"), the role in the plural.
 */
function markersFilter(t: T, f: FilterTier): Record<string, string> {
  return f.type === "lane"
    ? { lane: t(`pages.tierList.laneSeo.${f.value}`) }
    : { role: t(`roles.${f.value}`), plural: t(`pages.tierList.rolePlural.${f.value}`) };
}

/**
 * Title modeled on recurring searches ("mlbb tier list septembre
 * 2026", "best jungle heroes mlbb"): measurement month and current patch,
 * drawn from the data.
 */
export function metaTierList(locale: Locale, rank: MeasuredRank, filter: FilterTier | null = null): Metadata {
  const t = createT(locale);
  const markers = { month: monthYear(locale), v: patchCurrent.version, rank: t(`measuredRanks.${rank}`) };
  const title = filter
    ? t(filter.type === "lane" ? "pages.seo.tierLane.title" : "pages.seo.tierRole.title", {
        ...markers,
        ...markersFilter(t, filter),
      })
    : rank === "all"
      ? t("pages.seo.tierList.title", markers)
      : t("pages.seo.tierList.titleRank", markers);
  return metaPage(locale, {
    title,
    description: descriptionTierList(locale, rank, filter),
    share: rank === "all" && !filter ? t("pages.tierList.ogDescription") : undefined,
    path: pagePath(rank, filter),
  });
}

/** Data sentence: the top three, the first one's rate, the measurement date and patch. */
function descriptionTierList(locale: Locale, rank: MeasuredRank, filter: FilterTier | null): string {
  const t = createT(locale);
  const ranking = rankingOf(rank, filter);
  const nameRank = t(`measuredRanks.${rank}`);
  const first = ranking[0];
  if (!first) {
    if (filter) return leadFilter(t, filter, 0);
    return rank === "all"
      ? t("pages.tierList.metaDescription")
      : t("pages.tierList.metaDescriptionRank", { rank: nameRank });
  }
  const values = {
    top: listNames(locale, ranking.slice(0, 3).map((e) => e.hero.name)),
    first: first.hero.name,
    winRate: percentage(locale, first.winRate),
    n: ranking.length,
    date: longDate(locale),
    v: patchCurrent.version,
    rank: nameRank,
  };
  if (filter) {
    return t(filter.type === "lane" ? "pages.seo.tierLane.description" : "pages.seo.tierRole.description", {
      ...values,
      ...markersFilter(t, filter),
    });
  }
  return rank === "all"
    ? t("pages.seo.tierList.description", values)
    : t("pages.seo.tierList.descriptionRank", values);
}

function leadFilter(t: T, f: FilterTier, n: number): string {
  return t(f.type === "lane" ? "pages.tierList.leadLane" : "pages.tierList.leadRole", {
    ...markersFilter(t, f),
    n,
  });
}

export function TierList({
  locale,
  rank,
  filter = null,
}: {
  locale: Locale;
  rank: MeasuredRank;
  /** Lane or role; the ranking then covers all ranks. */
  filter?: FilterTier | null;
}) {
  const t = createT(locale);
  const notes = tierNotesOf(locale);
  const ranking = rankingOf(rank, filter);
  const nameRank = t(`measuredRanks.${rank}`);
  const path = pagePath(rank, filter);
  const title = filter
    ? t(filter.type === "lane" ? "pages.tierList.titleLane" : "pages.tierList.titleRole", markersFilter(t, filter))
    : rank === "all"
      ? t("pages.tierList.title")
      : t("pages.tierList.titleRank", { rank: nameRank });
  const lead = filter
    ? leadFilter(t, filter, ranking.length)
    : rank === "all"
      ? t("pages.tierList.lead")
      : t("pages.tierList.leadRank", { rank: nameRank });
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rate = (v: number) => `${percent.format(v)} %`;

  // Seven-day win rate change, in the page's rank;
  // nothing when the series is missing or the gap is lost in rounding.
  const trend = (slug: string) => {
    const v = variationWeek(trendsOf(slug)[rank]);
    if (!isNotable(v)) return null;
    return {
      rise: v.gap > 0,
      text: percent.format(Math.abs(v.gap)),
      description: describeGap(t, locale, v.gap, v.days),
    };
  };

  // One compact row per hero: empty fields are not sent.
  const row = (e: RankedEntry): RowTier => {
    const evolution = trend(e.hero.slug);
    const note = notes[e.hero.slug] ?? e.comment;
    const icon = e.hero.images.icon ?? e.hero.images.portrait;
    return {
      slug: e.hero.slug,
      name: e.hero.name,
      ...(icon === usualIcon(e.hero.slug) ? {} : { icon }),
      lanes: e.hero.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—",
      win: rate(e.winRate),
      ban: rate(e.banRate),
      pick: rate(e.pickRate),
      ...(evolution ? { trend: evolution } : {}),
      ...(e.lowSample ? { weak: true } : {}),
      ...(note ? { note } : {}),
    };
  };
  const labels = {
    win: t("pages.tierList.win"),
    ban: t("pages.tierList.ban"),
    pick: t("pages.tierList.pick"),
    tooFew: t("pages.tierList.tooFew"),
  };

  // Heroes grouped by tier, once: the list is walked five times otherwise.
  const byTier = new Map<Tier, RankedEntry[]>();
  for (const e of ranking) byTier.set(e.tier, [...(byTier.get(e.tier) ?? []), e]);
  const open = tiersOpen(new Map([...byTier].map(([tier, list]) => [tier, list.length])));

  // The page's whole ranking, in order, with the measurement date.
  const structuredData = heroListData(locale, {
    name: title,
    description: descriptionTierList(locale, rank, filter),
    path,
    heroes: ranking.map((e) => ({ name: e.hero.name, slug: e.hero.slug })),
    changed: dateMeasure,
    ranked: true,
  });

  const crumbs: Crumb[] | undefined = filter
    ? [
        { name: t("pages.tierList.title"), href: "/tier-list" },
        {
          name: nameFilter(t, filter),
          siblings: (filter.type === "lane" ? FILTERS_LANE : FILTERS_ROLE).map((f) => ({
            name: nameFilter(t, f),
            href: pathFilter(f),
          })),
        },
      ]
    : rank === "all"
      ? undefined
      : [
          { name: t("pages.tierList.title"), href: "/tier-list" },
          {
            name: nameRank,
            siblings: RANKS_CLASSES.map((r) => ({ name: t(`measuredRanks.${r}`), href: rankPath(r) })),
          },
        ];

  // Three entries to the other lists: by rank, by lane, by role.
  const sameFilter = (f: FilterTier) => filter?.type === f.type && filter.value === f.value;
  const tierRows: TierRow[] = [
    {
      label: t("pages.tierList.byRank"),
      links: RANKS_CLASSES.map((r) => ({
        href: rankPath(r),
        name: t(`measuredRanks.${r}`),
        active: !filter && r === rank,
        ...(imageRank(r) ? { emblem: imageRank(r)! } : {}),
      })),
    },
    {
      label: t("pages.tierList.byLane"),
      links: FILTERS_LANE.map((f) => ({
        href: pathFilter(f),
        name: nameFilter(t, f),
        active: sameFilter(f),
        ...(imageLane(f.value) ? { emblem: imageLane(f.value)! } : {}),
      })),
    },
    {
      label: t("pages.tierList.byRole"),
      links: FILTERS_ROLE.map((f) => ({
        href: pathFilter(f),
        name: nameFilter(t, f),
        active: sameFilter(f),
        ...(imageRole(f.value) ? { emblem: imageRole(f.value)! } : {}),
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <PageHeader
        title={title}
        lead={lead}
        crumbs={crumbs}
        meta={freshnessFacts(locale, t("pages.freshness.heroesRanked", { n: ranking.length }))}
        actions={
          <Link
            href={rank === "all" ? "/statistics" : `/statistics/${rank}`}
            className="text-sm font-semibold text-gold-400 hover:text-gold-500"
          >
            {t("pages.statistics.fromTierListLink")} →
          </Link>
        }
        details={{
          // The reader must be able to challenge the ranking: we show the rule.
          label: t("pages.tierList.howCalculated"),
          content: (
            <div className="space-y-3">
              <p>
                {t("pages.tierList.scorePre")}<strong className="text-chalk-100">{t("pages.tierList.scoreBold")}</strong>.
              </p>
              <p>{t("pages.tierList.p2")}</p>
              <p>
                {t("pages.tierList.p3pre")}
                <span className="text-gold-400">{t("pages.tierList.asterisk")}</span>{t("pages.tierList.p3post")}
              </p>
              <p>{t("pages.tierList.trends", { threshold: percent.format(THRESHOLD_NOTABLE) })}</p>
            </div>
          ),
        }}
      />

      <div className="mx-auto max-w-5xl px-4 pb-12 pt-4">
        <TierRows rows={tierRows} home="/tier-list" />
        {filter && (
          <p className="mb-6 text-sm leading-relaxed text-chalk-500">
            {t("pages.tierList.filterNote")}
            {filter.type === "role" && (
              <>
                {" "}
                <Link href={pathRole(filter.value)} className="font-semibold text-gold-400 hover:text-gold-500">
                  {t("pages.tierList.seeRole", markersFilter(t, filter))} →
                </Link>
              </>
            )}
          </p>
        )}

        <div className="space-y-8">
          {ORDER_TIERS.map((tier) => {
            const entries = byTier.get(tier) ?? [];
            if (entries.length === 0) return null;
            const lines = <TierLines rows={entries.map(row)} labels={labels} />;

            return (
              <section key={tier}>
                <div className="flex items-center gap-4">
                  <BadgeTier tier={tier} />
                  <div>
                    <h2 className="font-heading text-xl font-bold text-chalk-100">
                      {t("pages.tierList.tier", { p: tier })}
                      <span className="ml-2 text-sm font-medium text-chalk-500">{entries.length}</span>
                    </h2>
                    <p className="text-sm text-chalk-500">{t(`pages.tierList.legend.${tier}`)}</p>
                  </div>
                </div>

                {open.has(tier) ? (
                  lines
                ) : (
                  // The rows stay in the document, closed: a crawler and the
                  // page's search still read all of them.
                  <Foldable
                    label={t("pages.tierList.openTier", { n: entries.length, p: tier })}
                    className="mt-4 border-0 bg-transparent [&>summary]:px-0 [&>div]:border-0 [&>div]:px-0 [&>div]:pb-0 [&>div]:pt-0"
                  >
                    {lines}
                  </Foldable>
                )}
              </section>
            );
          })}
        </div>

        <p className="mt-14 border-t border-night-800 pt-6 text-sm leading-relaxed text-chalk-500">
          {t("pages.tierList.conclusion")}
        </p>
      </div>
    </>
  );
}
