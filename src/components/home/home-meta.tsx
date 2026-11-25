import Image from "next/image";
import Link from "@/components/link";
import { Face } from "@/components/home/face";
import { SCROLL_ROW } from "@/components/home/scroll-row";
import { COLOR_TIER } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { allHeroes, heroesBySlug } from "@/lib/data";
import { trendsOf } from "@/lib/evolution";
import { longDate, patchCurrent, percentage } from "@/lib/freshness";
import { firstNBy } from "@/lib/meta-report";
import { leaderOf, measure, ORDER_TIERS, rankingFull, type RankedEntry } from "@/lib/tier-list";
import { describeGap, formatGap, moversWeek, type MoversMeasure } from "@/lib/trends";
import { cn } from "@/lib/utils";

/** Heroes in the patch's top: five read at a glance, the full ranking is one click away. */
const TOP = 5;
/** Rows per short list; three on a phone, where the lists stack. */
const ROWS = 5;
const PHONE_ROWS = 3;

/**
 * The meta, opening on one typographic moment: the number one's name set
 * as large as the screen allows, beside its ban rate — the figure that put
 * it there — and its win rate. Then the patch's top five as a strip of
 * portraits with no frame, the rank in a large outlined figure over each;
 * the three lists a player asks for next (highest win rate, most banned,
 * most played) as three typographic columns split by hairlines; the tiers
 * as one thin bar opening the tier list; and the week's biggest moves as a
 * line of text.
 *
 * Everything comes from the synced rates; nothing here is an opinion.
 */
export function HomeMeta({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const counts = ORDER_TIERS.map((tier) => ({ tier, n: rankingFull.filter((e) => e.tier === tier).length })).filter(
    (c) => c.n > 0,
  );
  const leader = leaderOf(rankingFull);
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
      {/* The moment: the number one's name, huge, and the figure that made it. */}
      <div className="grid items-end gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h2 id="home-meta" className="text-chalk-100">
            {leader ? (
              <>
                <Link
                  href={`/heroes/${leader.hero.slug}`}
                  className="display-caps block break-words pr-[0.1em] text-[clamp(4.5rem,1rem+13vw,13rem)] leading-[0.8] transition-colors hover:text-gold-300"
                >
                  {leader.hero.name}
                </Link>
                <span className="mt-4 block font-heading text-[clamp(1.5rem,1.1rem+1.3vw,2.25rem)] font-bold uppercase leading-tight text-chalk-200">
                  {t("home.meta.rules", { version: patchCurrent.version })}
                </span>
              </>
            ) : (
              <span className="type-section">{t("home.meta.title", { version: patchCurrent.version })}</span>
            )}
          </h2>
          <p className="mt-4 max-w-xl text-chalk-400">
            {t("home.meta.lead", { date: longDate(locale, measure), n: rankingFull.length })}{" "}
            <Link href="/tier-list" className="font-semibold text-gold-400 underline decoration-1 underline-offset-4 hover:text-gold-300">
              {t("home.fullTierList")}
            </Link>
          </p>
        </div>
        {leader && (
          <dl className="flex gap-10 lg:flex-col lg:items-end lg:gap-6 lg:text-right">
            <div>
              <dt className="sr-only">{t("pages.heroDetail.stat.banRate")}</dt>
              <dd className="score text-[clamp(4rem,2rem+6vw,8rem)]">{percentage(locale, leader.banRate)}</dd>
              <dd aria-hidden className="mt-2 text-sm text-chalk-400">
                {t("pages.heroDetail.stat.banRate")}
              </dd>
            </div>
            <div>
              <dt className="sr-only">{t("home.meta.moverRateFull.winRate")}</dt>
              <dd className="score score-outline text-[clamp(2.5rem,1.6rem+2.6vw,4rem)]">{percentage(locale, leader.winRate)}</dd>
              <dd aria-hidden className="mt-2 text-sm text-chalk-400">
                {t("home.meta.moverRateFull.winRate")}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {top.length > 0 && (
        <div className="mt-16 sm:mt-20">
          <h3 className="font-heading text-lg font-bold uppercase text-chalk-300">{t("home.meta.top5")}</h3>
          <ol className={cn(SCROLL_ROW, "mt-4 gap-4 lg:grid lg:grid-cols-5 lg:gap-6")}>
            {top.map((e, i) => (
              <li key={e.hero.slug} className="w-[42vw] max-w-[13rem] shrink-0 snap-start sm:w-[28vw] lg:w-auto lg:max-w-none">
                <TopPortrait entry={e} rank={i + 1} locale={locale} t={t} />
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-16 grid border-t border-night-800 md:grid-cols-3">
        {lists.map((l, i) => (
          <RateList
            key={l.title}
            title={l.title}
            entries={l.entries}
            value={l.value}
            locale={locale}
            className={cn("pt-6 md:px-8", i === 0 && "md:pl-0", i > 0 && "max-md:mt-8 md:border-l md:border-night-800", i === 2 && "md:pr-0")}
          />
        ))}
      </div>

      {/* Proportional bar: the width of a tier is its share of the ranked heroes. */}
      <Link
        href="/tier-list"
        className="group mt-12 block"
        aria-label={t("home.meta.splitLabel", { n: rankingFull.length })}
      >
        <span aria-hidden className="flex gap-[3px]">
          {counts.map((c) => (
            <span key={c.tier} style={{ flexGrow: c.n }} className="min-w-0 basis-0">
              <span className="flex items-baseline gap-1.5 pb-2">
                <span className="display-caps pr-[0.1em] text-xl text-chalk-100 transition-colors group-hover:text-gold-300">{c.tier}</span>
                <span className="font-heading text-sm font-bold text-chalk-500 max-sm:hidden">{c.n}</span>
              </span>
              <span className={cn("block h-1.5 transition-[filter] group-hover:brightness-110", COLOR_TIER[c.tier])} />
            </span>
          ))}
        </span>
      </Link>
      <p className="sr-only">
        {counts.map((c) => t("home.meta.tierCount", { tier: c.tier, n: c.n })).join(", ")}
      </p>

      <WeekLine movers={movers} locale={locale} t={t} />
    </section>
  );
}

/**
 * One of the top five: the tall portrait with no frame, fading into the
 * page at its foot, its rank in a large outlined figure over the fade, then
 * on the page the name and the two rates the tier list's score is made of.
 */
function TopPortrait({ entry: e, rank, locale, t }: { entry: RankedEntry; rank: number; locale: Locale; t: T }) {
  const portrait = e.hero.images.portrait ?? e.hero.images.icon;
  return (
    <Link href={`/heroes/${e.hero.slug}`} className="group block transition-transform duration-200 hover:-translate-y-0.5">
      <span className="relative block aspect-[4/5] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]">
        {portrait && (
          <Image
            src={portrait}
            alt=""
            fill
            sizes="(min-width: 1600px) 18rem, (min-width: 1024px) 18vw, (min-width: 640px) 28vw, 42vw"
            className="object-cover object-[50%_18%] transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
      </span>
      <span aria-hidden className="score score-outline relative -mt-14 block pl-1 text-[4.5rem] sm:-mt-16 sm:text-[5.5rem]">
        {rank}
      </span>
      <span className="mt-2 block truncate font-heading text-xl font-bold uppercase leading-tight text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-2xl">
        {e.hero.name}
      </span>
      <span aria-hidden className="mt-1 flex flex-wrap gap-x-3 text-sm tabular-nums text-chalk-400">
        <span>
          <span className="font-semibold text-chalk-100">{percentage(locale, e.winRate)}</span> {t("home.meta.moverRate.winRate")}
        </span>
        <span>
          <span className="font-semibold text-chalk-100">{percentage(locale, e.banRate)}</span> {t("home.meta.moverRate.banRate")}
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
  className,
}: {
  title: string;
  entries: RankedEntry[];
  value: (e: RankedEntry) => number;
  locale: Locale;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <h3 className="font-heading text-lg font-bold uppercase text-chalk-300">{title}</h3>
      <ol className="mt-2">
        {entries.map((e, i) => (
          // Three rows on a phone: lists of five stacked ran two screens.
          <li key={e.hero.slug} className={cn(i >= PHONE_ROWS && "max-md:hidden")}>
            <Link href={`/heroes/${e.hero.slug}`} className="group flex min-h-12 items-center gap-3 py-1.5">
              <span aria-hidden className="w-4 shrink-0 text-right font-heading text-sm font-bold text-chalk-500">
                {i + 1}
              </span>
              <Face source={e.hero.images.icon ?? e.hero.images.portrait} name={e.hero.name} />
              <span className="min-w-0 flex-1 truncate font-heading text-lg font-bold uppercase leading-none text-chalk-100 transition-colors group-hover:text-gold-300">
                {e.hero.name}
              </span>
              <span className="shrink-0 font-heading text-lg font-bold tabular-nums text-chalk-200">{percentage(locale, value(e))}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The week's meta movers, as one line of text: the biggest rise and drop of
 * the win, ban and pick rates. The arrow and the colour double the sign; the
 * rate is named on each, since a ban rate moves by points where a win rate
 * moves by tenths.
 */
function WeekLine({ movers, locale, t }: { movers: MoversMeasure[]; locale: Locale; t: T }) {
  const rows = movers.flatMap(({ measure, rises, drops }) => [
    ...rises.map((m) => ({ ...m, measure, rise: true })),
    ...drops.map((m) => ({ ...m, measure, rise: false })),
  ]);
  return (
    <div className="mt-10 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
      <h3 className="font-heading text-lg font-bold uppercase text-chalk-300">{t("home.meta.week")}</h3>
      {rows.length === 0 ? (
        <p className="text-chalk-500">{t("home.meta.weekEmpty")}</p>
      ) : (
        <ul className="contents">
          {rows.map(({ slug, measure, variation: v, rise }) => {
            const h = heroesBySlug.get(slug);
            if (!h) return null;
            return (
              <li key={`${measure}-${slug}`}>
                <Link href={`/heroes/${slug}`} className="group inline-flex min-h-11 items-baseline gap-1.5">
                  <span aria-hidden className={cn("font-bold", rise ? "text-azure-400" : "text-blood-400")}>
                    {rise ? "↑" : "↓"}
                  </span>
                  <span className="font-heading text-base font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-300">
                    {h.name}
                  </span>
                  <span aria-hidden className={cn("font-semibold tabular-nums", rise ? "text-azure-400" : "text-blood-400")}>
                    {formatGap(v.gap, locale)} {t("counters.pts")}
                  </span>
                  <span aria-hidden className="text-chalk-500">{t(`home.meta.moverRate.${measure}`)}</span>
                  <span className="sr-only">
                    {t(`home.meta.moverRateFull.${measure}`)} {describeGap(t, locale, v.gap, v.days)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/meta#movers" className="inline-flex min-h-11 items-baseline font-semibold text-gold-400 underline decoration-1 underline-offset-4 hover:text-gold-300">
        {t("home.meta.moversAll")}
      </Link>
    </div>
  );
}
