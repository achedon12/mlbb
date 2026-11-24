import type { Metadata } from "next";
import Link from "@/components/link";
import { AuthorNote } from "@/components/author-note";
import { DiscordInvite } from "@/components/discord-invite";
import type { Crumb } from "@/components/breadcrumb";
import { freshnessFacts } from "@/components/freshness";
import { PageSourcesBlock } from "@/components/page-sources";
import { GuideLink } from "@/components/guide";
import { guideOfLane } from "@/lib/guides";
import { Foldable } from "@/components/foldable";
import { ActionLink, BadgeTier } from "@/components/ui";
import { HeroTile } from "@/components/hero-tile";
import { ShareImageButton } from "@/components/share-image-button";
import { LightImage } from "@/components/light-image";
import { MetaPoster, artOf } from "@/components/meta/meta-poster";
import { MethodFold } from "@/components/meta/method-fold";
import { PosterHero } from "@/components/meta/poster-hero";
import { usualPortrait } from "@/components/meta/portraits";
import { cn } from "@/lib/utils";
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
import { faqPageData } from "@/lib/structured-data";
import { rankingOfRank, ORDER_TIERS, RANKS_CLASSES, type RankedEntry } from "@/lib/tier-list";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { describeGap, isNotable, THRESHOLD_NOTABLE, variationWeek } from "@/lib/trends";
import type { Tier } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { heroListData, metaPage } from "@/i18n/seo";
import { buildsPlayed, counters, heroesBySlug, itemsFor, tierNotes as tierNotesOf } from "@/lib/data";
import { imageLane, imageRank, imageRole } from "@/lib/emblems";
import { visualItem } from "@/lib/build-visuals";
import { ScrollDepth } from "@/components/scroll-depth";
import {
  ANSWER_COUNT,
  coreItemsFor,
  countersFor,
  moversFor,
  patchChangesFor,
} from "@/lib/tier-list-extras";
import { TierLines, type RowTier } from "./tier-lines";
import { TierRows, type TierRow } from "./tier-rows";
import { TierTiles } from "./tier-tiles";
import type { LabelsPeek, PeekDict } from "./tier-peek";
import { TierTrack } from "./tier-track";
import { AlsoSee, PatchChanges, ShortAnswer, type ListNext, type PickNext } from "./tier-extras";

/** Faces shown on the head of a folded tier. */
const FACES = 10;
/** A tier as an id fragment: "S+" is not a valid one. */
const tierId = (tier: Tier) => tier.replace("+", "-plus").toLowerCase();

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
    card: !filter,
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

  // A hero's preview: who beats it, what it builds on the page's lane.
  const lane = filter?.type === "lane" ? filter.value : null;
  const known = (slug: string) => heroesBySlug.has(slug);
  const countersOf = (slug: string) => countersFor(counters[slug], rank, known);
  const imagesItems = new Map<string, string | null>();
  const itemsOf = (e: RankedEntry) =>
    coreItemsFor(buildsPlayed[e.hero.slug], e.hero.lanes, lane, rank).flatMap((name) => {
      const v = visualItem(name);
      if (!v.slug) return [];
      imagesItems.set(v.slug, v.image);
      return [{ slug: v.slug, image: v.image }];
    });
  const namesItems = new Map(itemsFor(locale).map((o) => [o.slug, o.name]));
  const nameItem = (slug: string) => namesItems.get(slug) ?? slug;

  // One compact row per hero: empty fields are not sent.
  const row = (e: RankedEntry): RowTier => {
    const evolution = trend(e.hero.slug);
    const note = notes[e.hero.slug] ?? e.comment;
    const icon = e.hero.images.icon ?? e.hero.images.portrait;
    const c = countersOf(e.hero.slug);
    const i = itemsOf(e).map((o) => o.slug);
    return {
      slug: e.hero.slug,
      name: e.hero.name,
      ...(icon === usualIcon(e.hero.slug) ? {} : { icon }),
      ...(e.hero.images.portrait === usualPortrait(e.hero.slug) ? {} : { portrait: e.hero.images.portrait ?? null }),
      lanes: e.hero.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—",
      win: rate(e.winRate),
      ban: rate(e.banRate),
      pick: rate(e.pickRate),
      ...(evolution ? { trend: evolution } : {}),
      ...(e.lowSample ? { weak: true } : {}),
      ...(note ? { note } : {}),
      ...(c.length > 0 || i.length > 0 ? { peek: { c, i } } : {}),
    };
  };
  const labels = {
    win: t("pages.tierList.win"),
    ban: t("pages.tierList.ban"),
    pick: t("pages.tierList.pick"),
    tooFew: t("pages.tierList.tooFew"),
  };
  const peekLabels: LabelsPeek = {
    open: t("pages.tierList.peek.open"),
    close: t("pages.tierList.peek.close"),
    counters: t("pages.tierList.peek.counters"),
    items: t("pages.tierList.peek.items"),
    full: t("pages.tierList.peek.full"),
    win: labels.win,
    ban: labels.ban,
    pick: labels.pick,
  };
  // Names and pictures of the counters and items a tier's previews cite, once per tier.
  const dictOf = (rows: RowTier[]): PeekDict => {
    const dict: PeekDict = { heroes: {}, items: {} };
    for (const r of rows) {
      for (const s of r.peek?.c ?? []) {
        const h = heroesBySlug.get(s);
        const icon = h?.images.icon ?? h?.images.portrait ?? null;
        dict.heroes[s] = { name: h?.name ?? s, ...(icon === usualIcon(s) ? {} : { icon }) };
      }
      for (const s of r.peek?.i ?? []) dict.items[s] = { name: nameItem(s), image: imagesItems.get(s) ?? null };
    }
    return dict;
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

  const first = ranking[0];
  const podium = ranking.slice(1, 3);
  const portraitOf = (e: RankedEntry) => e.hero.images.portrait ?? e.hero.images.icon;
  const feature = first && (
    <PosterHero
      href={`/heroes/${first.hero.slug}`}
      kicker={t("pages.tierList.poster.kicker")}
      name={first.hero.name}
      tier={first.tier}
      figure={percent.format(first.winRate)}
      caption={t("pages.heroDetail.stat.winRate")}
      second={{ value: percent.format(first.banRate), caption: t("pages.heroDetail.stat.banRate") }}
      label={t("pages.tierList.poster.label", {
        name: first.hero.name,
        tier: first.tier,
        win: rate(first.winRate),
        ban: rate(first.banRate),
      })}
    >
      {podium.length > 0 && (
        <ol start={2} className="mt-6 flex gap-2 max-sm:hidden sm:gap-3">
          {podium.map((e, i) => (
            <li key={e.hero.slug} className="w-[6.5rem] sm:w-28">
              <HeroTile
                href={`/heroes/${e.hero.slug}`}
                name={e.hero.name}
                portrait={portraitOf(e)}
                rank={i + 2}
                figure={percent.format(e.winRate)}
                label={t("home.winRate", { value: rate(e.winRate) })}
                sizes="7rem"
              />
            </li>
          ))}
        </ol>
      )}
    </PosterHero>
  );

  // Position of a tier's first hero in the whole ranking, for the cards' numbers.
  const offsets = new Map<Tier, number>();
  let before = 0;
  for (const tier of ORDER_TIERS) {
    offsets.set(tier, before);
    before += byTier.get(tier)?.length ?? 0;
  }

  // The short answer: the question the page is searched for, answered in plain text.
  const markers = filter ? markersFilter(t, filter) : { rank: nameRank };
  const kind = filter ? (filter.type === "lane" ? "Lane" : "Role") : rank === "all" ? "All" : "Rank";
  const answer = first && {
    question: t(`pages.tierList.answer.question${kind}`, markers),
    answer: t(`pages.tierList.answer.answer${kind}`, {
      ...markers,
      top: listNames(locale, ranking.slice(0, ANSWER_COUNT).map((e) => e.hero.name)),
    }),
    detail: t("pages.tierList.answer.detail", {
      first: first.hero.name,
      tier: first.tier,
      winRate: rate(first.winRate),
      banRate: rate(first.banRate),
      n: ranking.length,
      v: patchCurrent.version,
      date: longDate(locale),
    }),
  };
  // The same question and answer, word for word, for answer engines.
  const faqData = answer
    ? faqPageData(locale, {
        path,
        items: [{ question: answer.question, answer: `${answer.answer} ${answer.detail}` }],
        changed: dateMeasure,
      })
    : null;

  // What changed: the week's movers among these heroes, and the ones the live patch touched.
  const slugs = ranking.map((e) => e.hero.slug);
  const movers = moversFor(slugs, (slug) => trendsOf(slug)[rank]);
  const changes = patchChangesFor(patchCurrent?.adjustments, slugs);

  // Where to go next: the top picks' counters and builds, the tools, the other lists.
  const picks: PickNext[] = ranking.slice(0, 3).map((e) => ({
    slug: e.hero.slug,
    counters: countersOf(e.hero.slug),
    items: itemsOf(e).map((o) => ({ ...o, name: nameItem(o.slug) })),
  }));
  const leaderOf = (f: FilterTier) => filterRanking(rankingOfRank("all"), f)[0]?.hero.slug;
  const listNext = (f: FilterTier): ListNext => {
    const emblem = f.type === "lane" ? imageLane(f.value) : imageRole(f.value);
    const top = leaderOf(f);
    return { href: pathFilter(f), name: nameFilter(t, f), ...(emblem ? { emblem } : {}), ...(top ? { top } : {}) };
  };
  const listsOrder = filter?.type === "role" ? [...FILTERS_ROLE, ...FILTERS_LANE] : [...FILTERS_LANE, ...FILTERS_ROLE];
  const lists = listsOrder.filter((f) => !sameFilter(f)).map(listNext);
  const titleNext = filter
    ? filter.type === "lane"
      ? t("pages.tierList.next.titleLane", { lane: t(`lanes.${filter.value}`) })
      : t("pages.tierList.next.titleRole", { role: t(`roles.${filter.value}`) })
    : t("pages.tierList.next.titleAll");
  const guide = filter?.type === "lane" ? guideOfLane(filter.value, locale) : undefined;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      {faqData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqData) }} />}
      <MetaPoster
        title={title}
        lead={lead}
        crumbs={crumbs}
        facts={freshnessFacts(locale, t("pages.freshness.heroesRanked", { n: ranking.length }))}
        art={first ? artOf(first.hero.slug) : null}
        portrait={first?.hero.images.portrait ?? null}
        feature={feature}
        actions={
          <>
            <ActionLink href={rank === "all" ? "/statistics" : `/statistics/${rank}`}>
              {t("pages.statistics.fromTierListLink")}
            </ActionLink>
            {/* The share image draws a rank's ranking: not offered on a lane or a role. */}
            {!filter && ranking.length > 0 && (
              <ShareImageButton card={{ kind: "tier-list", rank }} name="Tier list" className="w-full" />
            )}
          </>
        }
      />

      <ScrollDepth category="Tier list" name={path} />
      <TierTrack>
      <div className="page-wrap pb-12 pt-6">
        {answer && <ShortAnswer {...answer} />}
        {/*
          The author's signed reading of the ranking, on the main tier list
          only and only while the patch it was written for is live: nothing
          when there is no text.
        */}
        {rank === "all" && !filter && (
          <AuthorNote kind="tier-list" version={patchCurrent.version} locale={locale} className="mb-8" />
        )}
        {/* The reader must be able to challenge the ranking: we show the rule. */}
        <MethodFold label={t("pages.tierList.howCalculated")} className="mb-8">
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
        </MethodFold>

        <TierRows rows={tierRows} home="/tier-list">
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
            {filter.type === "lane" && (
              <>
                {" "}
                <GuideLink guide={guideOfLane(filter.value, locale)} locale={locale} />
              </>
            )}
          </p>
        )}

        <PatchChanges
          t={t}
          locale={locale}
          rises={movers.rises}
          drops={movers.drops}
          changes={changes}
          version={patchCurrent?.version ?? null}
        />

        <div className="space-y-12 sm:space-y-14">
          {ORDER_TIERS.map((tier) => {
            const entries = byTier.get(tier) ?? [];
            if (entries.length === 0) return null;
            const unfolded = open.has(tier);
            const rows = entries.map(row);

            return (
              <section key={tier} aria-labelledby={`tier-${tierId(tier)}`}>
                <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                  <BadgeTier tier={tier} size={unfolded ? "lg" : "md"} />
                  <div className="min-w-0 flex-1">
                    <h2
                      id={`tier-${tierId(tier)}`}
                      className={cn(
                        "display-caps text-chalk-100",
                        unfolded ? "text-[clamp(2.25rem,1.65rem+2vw,3.25rem)]" : "text-[2rem]",
                      )}
                    >
                      {t("pages.tierList.tier", { p: tier })}
                      <span className="score score-outline ml-3 text-[0.7em]">{entries.length}</span>
                    </h2>
                    <p className="mt-1.5 text-sm text-chalk-400 sm:text-base">{t(`pages.tierList.legend.${tier}`)}</p>
                  </div>
                  {!unfolded && (
                    // A face for each of the first heroes: a folded tier still shows who is in it.
                    <span aria-hidden className="tier-faces">
                      {entries.slice(0, FACES).map((e) => (
                        <LightImage
                          key={e.hero.slug}
                          src={e.hero.images.icon ?? usualIcon(e.hero.slug)}
                          alt=""
                          width={40}
                          height={40}
                        />
                      ))}
                    </span>
                  )}
                </div>

                {unfolded ? (
                  <TierTiles
                    rows={rows}
                    labels={labels}
                    start={offsets.get(tier) ?? 0}
                    dict={dictOf(rows)}
                    peekLabels={peekLabels}
                  />
                ) : (
                  // The rows stay in the document, closed: a crawler and the
                  // page's search still read all of them.
                  <Foldable label={t("pages.tierList.openTier", { n: entries.length, p: tier })} className="mt-4">
                    <TierLines rows={rows} labels={labels} dict={dictOf(rows)} peekLabels={peekLabels} />
                  </Foldable>
                )}
              </section>
            );
          })}
        </div>

        <AlsoSee
          t={t}
          title={titleNext}
          picks={picks}
          lists={lists}
          guide={guide ? { href: `/guides/${guide.slug}`, title: t("pages.guides.readGuide", { title: guide.short }) } : undefined}
        />

        <div aria-hidden className="eclat-rule mt-14" />
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-chalk-400">{t("pages.tierList.conclusion")}</p>
        <DiscordInvite t={t} context="tier" className="mt-8" />
        <PageSourcesBlock locale={locale} of={{ kind: "ranking" }} className="mt-10" />
        </TierRows>
      </div>
      </TierTrack>
    </>
  );
}
