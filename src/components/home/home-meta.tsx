import Image from "next/image";
import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { SCROLL_ROW } from "@/components/home/scroll-row";
import { ActionLink, BadgeTier, COLOR_TIER, SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { allHeroes, heroesBySlug } from "@/lib/data";
import { trendsOf } from "@/lib/evolution";
import { longDate, patchCurrent, percentage } from "@/lib/freshness";
import { firstNBy } from "@/lib/meta-report";
import { measure, ORDER_TIERS, rankingFull, type RankedEntry } from "@/lib/tier-list";
import { describeGap, formatGap, moversWeek, type MoversMeasure } from "@/lib/trends";
import { cn } from "@/lib/utils";

/** Heroes in the patch's top: five read at a glance, the full ranking is one click away. */
const TOP = 5;
/** Rows per short list; three on a phone, where the lists stack. */
const ROWS = 5;
const PHONE_ROWS = 3;

/**
 * The meta in one block, led by one thing: the patch's top five, as five
 * large hero cards (rank, tier, win and ban rates), in the tier list's
 * order. Under them the three lists a player asks for next — highest win
 * rate, most banned, most played — side by side as short ranked lines, then
 * the tiers as one compact bar opening the tier list, and the week's
 * biggest moves on each rate as one strip. On a phone the five cards and
 * the week's moves scroll sideways.
 *
 * Everything comes from the synced rates; nothing here is an opinion.
 */
export function HomeMeta({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const counts = ORDER_TIERS.map((tier) => ({ tier, n: rankingFull.filter((e) => e.tier === tier).length })).filter(
    (c) => c.n > 0,
  );
  const top = rankingFull.slice(0, TOP);
  const reliable = rankingFull.filter((e) => !e.lowSample);
  // One rise and one drop per rate: six moves.
  const movers = moversWeek(
    allHeroes.map((h) => ({ slug: h.slug, series: trendsOf(h.slug).all })),
    1,
  );
  const lists: { title: string; entries: RankedEntry[]; value: (e: RankedEntry) => number }[] = [
    { title: t("home.meta.win"), entries: firstNBy(reliable, (e) => e.winRate, ROWS), value: (e) => e.winRate },
    { title: t("home.meta.ban"), entries: firstNBy(rankingFull, (e) => e.banRate, ROWS), value: (e) => e.banRate },
    { title: t("home.meta.pick"), entries: firstNBy(rankingFull, (e) => e.pickRate, ROWS), value: (e) => e.pickRate },
  ];

  return (
    <section aria-labelledby="home-meta" className={className}>
      <SectionTitle
        id="home-meta"
        lead={t("home.meta.lead", { date: longDate(locale, measure), n: rankingFull.length })}
        action={{ href: "/tier-list", label: t("home.fullTierList") }}
      >
        {t("home.meta.title", { version: patchCurrent.version })}
      </SectionTitle>

      {top.length > 0 && (
        <>
          <h3 className="type-subtitle text-chalk-100">{t("home.meta.top5")}</h3>
          <ol className={cn(SCROLL_ROW, "mt-4 lg:grid lg:grid-cols-5 lg:gap-4")}>
            {top.map((e, i) => (
              <li key={e.hero.slug} className="w-[44vw] max-w-[13rem] shrink-0 snap-start sm:w-[30vw] lg:w-auto lg:max-w-none">
                <TopCard entry={e} rank={i + 1} locale={locale} t={t} />
              </li>
            ))}
          </ol>
        </>
      )}

      {/* Proportional bar: the width of a tier is its share of the ranked heroes. */}
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 sm:mt-10">
        <span className="font-heading text-base font-bold uppercase text-chalk-300">{t("home.meta.tiers")}</span>
        <Link
          href="/tier-list"
          className="group block min-w-[14rem] flex-1"
          aria-label={t("home.meta.splitLabel", { n: rankingFull.length })}
        >
          <ul aria-hidden className="bevel-sm flex h-9 gap-[3px] overflow-hidden">
            {counts.map((c) => (
              <li
                key={c.tier}
                style={{ flexGrow: c.n }}
                className={cn(
                  "flex min-w-0 basis-0 items-center justify-center gap-1.5 transition-[filter] group-hover:brightness-110",
                  COLOR_TIER[c.tier],
                )}
              >
                <span className="display-caps pr-[0.1em] text-lg leading-none">{c.tier}</span>
                <span className="hidden font-heading text-sm font-bold opacity-75 sm:inline">{c.n}</span>
              </li>
            ))}
          </ul>
        </Link>
      </div>
      <p className="sr-only">
        {counts.map((c) => t("home.meta.tierCount", { tier: c.tier, n: c.n })).join(", ")}
      </p>

      <div className="mt-10 grid gap-x-8 gap-y-8 md:grid-cols-3">
        {lists.map((l) => (
          <RateList key={l.title} title={l.title} entries={l.entries} value={l.value} locale={locale} />
        ))}
      </div>

      <WeekList movers={movers} locale={locale} t={t} />
    </section>
  );
}

/**
 * One of the top five: the tall portrait, its rank outlined in the corner
 * and its tier crest, the name, then the win rate in gold and the ban rate
 * beside it — the two rates the tier list's score is made of.
 */
function TopCard({ entry: e, rank, locale, t }: { entry: RankedEntry; rank: number; locale: Locale; t: T }) {
  const portrait = e.hero.images.portrait ?? e.hero.images.icon;
  return (
    <Link href={`/heroes/${e.hero.slug}`} className="hero-tile group">
      <span className="scheme-dark bevel relative block aspect-[3/4] overflow-hidden bg-night-800">
        {portrait ? (
          <Image
            src={portrait}
            alt=""
            fill
            sizes="(min-width: 1600px) 18rem, (min-width: 1024px) 18vw, (min-width: 640px) 30vw, 44vw"
            className="object-cover object-top"
          />
        ) : (
          <span aria-hidden className="display-caps grid size-full place-items-center text-4xl text-chalk-600">
            {e.hero.name.slice(0, 2)}
          </span>
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-night-950 via-night-950/80 to-transparent" />
        <span aria-hidden className="score score-outline absolute left-2.5 top-2 text-5xl sm:text-6xl">
          {rank}
        </span>
        <BadgeTier tier={e.tier} size="sm" className="absolute right-2.5 top-2.5" />
        <span className="absolute inset-x-0 bottom-0 p-3">
          <span className="display-caps block truncate pr-[0.15em] text-xl text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-2xl">
            {e.hero.name}
          </span>
          <span aria-hidden className="mt-2 grid grid-cols-2 gap-2">
            <span className="min-w-0">
              <span className="score block text-[1.4rem] sm:text-[1.6rem] xl:text-[2rem]">{percentage(locale, e.winRate)}</span>
              <span className="mt-1 block truncate text-xs text-chalk-400">{t("home.meta.moverRate.winRate")}</span>
            </span>
            <span className="min-w-0">
              <span className="score block text-[1.4rem] text-chalk-200 sm:text-[1.6rem] xl:text-[2rem]">{percentage(locale, e.banRate)}</span>
              <span className="mt-1 block truncate text-xs text-chalk-400">{t("home.meta.moverRate.banRate")}</span>
            </span>
          </span>
        </span>
      </span>
      <span className="sr-only">
        {t("home.meta.topLabel", {
          rank,
          tier: e.tier,
          win: percentage(locale, e.winRate),
          ban: percentage(locale, e.banRate),
        })}
      </span>
    </Link>
  );
}

function RateList({
  title,
  entries,
  value,
  locale,
}: {
  title: string;
  entries: RankedEntry[];
  value: (e: RankedEntry) => number;
  locale: Locale;
}) {
  return (
    <div className="min-w-0">
      <h3 className="type-subtitle border-b border-night-700 pb-2 text-chalk-100">{title}</h3>
      <ol className="divide-y divide-night-800">
        {entries.map((e, i) => (
          // Three rows on a phone: lists of five stacked ran two screens.
          <li key={e.hero.slug} className={cn(i >= PHONE_ROWS && "max-md:hidden")}>
            <Link href={`/heroes/${e.hero.slug}`} className="group flex min-h-11 items-center gap-3 py-2">
              <span aria-hidden className="score score-outline w-5 shrink-0 text-right text-xl">
                {i + 1}
              </span>
              <HeroPortrait source={e.hero.images.icon ?? e.hero.images.portrait} name={e.hero.name} size="icon" decorative />
              <span className="min-w-0 flex-1 truncate font-heading text-lg font-bold uppercase leading-none text-chalk-100 transition-colors group-hover:text-gold-400">
                {e.hero.name}
              </span>
              <span className="score shrink-0 pr-[0.1em] text-2xl">{percentage(locale, value(e))}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The week's meta movers: the biggest rise and drop of the win, ban and pick
 * rates, as one strip. The arrow and the colour double the sign; the rate is
 * named on each entry, since a ban rate moves by points where a win rate
 * moves by tenths.
 */
function WeekList({ movers, locale, t }: { movers: MoversMeasure[]; locale: Locale; t: T }) {
  const rows = movers.flatMap(({ measure, rises, drops }) => [
    ...rises.map((m) => ({ ...m, measure, rise: true })),
    ...drops.map((m) => ({ ...m, measure, rise: false })),
  ]);
  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="type-subtitle text-chalk-100">{t("home.meta.week")}</h3>
        <ActionLink href="/meta#movers" className="text-sm">
          {t("home.meta.moversAll")}
        </ActionLink>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-chalk-500">{t("home.meta.weekEmpty")}</p>
      ) : (
        <ul className={cn(SCROLL_ROW, "mt-3 gap-2 lg:grid lg:grid-cols-3 xl:grid-cols-6")}>
          {rows.map(({ slug, measure, variation: v, rise }) => {
            const h = heroesBySlug.get(slug);
            if (!h) return null;
            const Icon = rise ? TrendingUp : TrendingDown;
            return (
              <li key={`${measure}-${slug}`} className="w-[13rem] shrink-0 snap-start lg:w-auto lg:min-w-0">
                <Link href={`/heroes/${slug}`} className="card-link group flex min-h-11 items-center gap-2.5 p-2">
                  <HeroPortrait source={h.images.icon ?? h.images.portrait} name={h.name} size="icon" decorative />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate font-heading font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-400">
                      {h.name}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-sm font-semibold tabular-nums",
                        rise ? "text-azure-400" : "text-blood-400",
                      )}
                    >
                      <Icon size={14} aria-hidden />
                      <span aria-hidden>
                        {formatGap(v.gap, locale)} {t("counters.pts")}
                      </span>
                      <span aria-hidden className="truncate font-normal text-chalk-500">
                        {t(`home.meta.moverRate.${measure}`)}
                      </span>
                      <span className="sr-only">
                        {t(`home.meta.moverRateFull.${measure}`)} {describeGap(t, locale, v.gap, v.days)}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
