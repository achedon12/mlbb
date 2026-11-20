import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { HeroTile } from "@/components/hero-tile";
import { ActionLink, COLOR_TIER, SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { allHeroes, heroesBySlug } from "@/lib/data";
import { trendsOf } from "@/lib/evolution";
import { longDate, patchCurrent, percentage } from "@/lib/freshness";
import { firstNBy } from "@/lib/meta-report";
import { measure, ORDER_TIERS, rankingFull, type RankedEntry } from "@/lib/tier-list";
import { describeGap, formatGap, moversWeek, type MoversMeasure } from "@/lib/trends";
import { cn } from "@/lib/utils";

/** Rows per list: five names read at a glance, the full table is one click away. */
const ROWS = 5;
const PHONE_ROWS = 3;
/** S+ heroes drawn as portraits; the rest of the tier is in the tier list. */
const TOP_TILES = 12;

/**
 * The meta in one screen: how the ranked heroes split across tiers, who
 * sits at the top, and the three lists a player asks for first — highest
 * win rate, most banned, most played — plus the week's biggest moves on
 * each of those three rates.
 *
 * One thing leads: the S+ heroes, as a row of portraits with their win rate
 * in gold. The other lists follow at two weights, never as equal columns —
 * the best win rates as portraits too, the bans and picks as short ranked
 * lines beside them, the week's moves as one strip underneath.
 * Everything comes from the synced rates; nothing here is an opinion.
 */
export function HomeMeta({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  const counts = ORDER_TIERS.map((tier) => ({ tier, n: rankingFull.filter((e) => e.tier === tier).length })).filter(
    (c) => c.n > 0,
  );
  const top = rankingFull.filter((e) => e.tier === "S+");
  const reliable = rankingFull.filter((e) => !e.lowSample);
  // One rise and one drop per rate: six rows, the size of the other lists.
  const movers = moversWeek(
    allHeroes.map((h) => ({ slug: h.slug, series: trendsOf(h.slug).all })),
    1,
  );
  const win = firstNBy(reliable, (e) => e.winRate, ROWS);
  const lists: { title: string; entries: RankedEntry[]; value: (e: RankedEntry) => number }[] = [
    { title: t("home.meta.ban"), entries: firstNBy(rankingFull, (e) => e.banRate, ROWS), value: (e) => e.banRate },
    { title: t("home.meta.pick"), entries: firstNBy(rankingFull, (e) => e.pickRate, ROWS), value: (e) => e.pickRate },
  ];
  const portrait = (e: RankedEntry) => e.hero.images.portrait ?? e.hero.images.icon;

  return (
    <section aria-labelledby="home-meta" className={className}>
      <SectionTitle
        id="home-meta"
        lead={t("home.meta.lead", { date: longDate(locale, measure), n: rankingFull.length })}
        action={{ href: "/tier-list", label: t("home.fullTierList") }}
      >
        {t("home.meta.title", { version: patchCurrent.version })}
      </SectionTitle>

      {/* Proportional bar: the width of a tier is its share of the ranked heroes. */}
      <Link href="/tier-list" className="group block" aria-label={t("home.meta.splitLabel", { n: rankingFull.length })}>
        <ul aria-hidden className="bevel flex h-11 gap-[3px] overflow-hidden sm:h-12">
          {counts.map((c) => (
            <li
              key={c.tier}
              style={{ flexGrow: c.n }}
              className={cn(
                "flex min-w-0 basis-0 items-baseline justify-center gap-1.5 pt-2.5 transition-[filter] group-hover:brightness-110 sm:pt-3",
                COLOR_TIER[c.tier],
              )}
            >
              <span className="display-caps text-xl leading-none sm:text-2xl">{c.tier}</span>
              <span className="hidden font-heading text-sm font-bold opacity-75 sm:inline">{c.n}</span>
            </li>
          ))}
        </ul>
      </Link>
      <p className="sr-only">
        {counts.map((c) => t("home.meta.tierCount", { tier: c.tier, n: c.n })).join(", ")}
      </p>

      {top.length > 0 && (
        <div className="mt-8 sm:mt-10">
          <h3 className="type-subtitle text-chalk-100">{t("home.meta.topTier", { n: top.length })}</h3>
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 2xl:grid-cols-12">
            {top.slice(0, TOP_TILES).map((e, i) => (
              <li key={e.hero.slug} className={cn(i >= 6 && "max-sm:hidden", i >= 8 && "sm:max-lg:hidden")}>
                <HeroTile
                  href={`/heroes/${e.hero.slug}`}
                  name={e.hero.name}
                  portrait={portrait(e)}
                  figure={percentage(locale, e.winRate)}
                  label={t("home.winRate", { value: percentage(locale, e.winRate) })}
                  sizes="(min-width: 1536px) 8rem, (min-width: 1024px) 15vw, (min-width: 640px) 23vw, 31vw"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h3 className="type-subtitle text-chalk-100">{t("home.meta.win")}</h3>
          <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
            {win.map((e, i) => (
              <li key={e.hero.slug} className={cn(i >= PHONE_ROWS && "max-sm:hidden")}>
                <HeroTile
                  href={`/heroes/${e.hero.slug}`}
                  name={e.hero.name}
                  portrait={portrait(e)}
                  rank={i + 1}
                  figure={percentage(locale, e.winRate)}
                  label={t("home.winRate", { value: percentage(locale, e.winRate) })}
                  sizes="(min-width: 1024px) 11vw, (min-width: 640px) 18vw, 31vw"
                />
              </li>
            ))}
          </ol>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {lists.map((l) => (
            <RateList key={l.title} title={l.title} entries={l.entries} value={l.value} locale={locale} />
          ))}
        </div>
      </div>

      <WeekList movers={movers} locale={locale} t={t} />
    </section>
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
      <h3 className="type-subtitle text-chalk-100">{title}</h3>
      <ol className="mt-3 divide-y divide-night-800">
        {entries.map((e, i) => (
          // Three rows on a phone: lists of five stacked ran two screens.
          <li key={e.hero.slug} className={cn(i >= PHONE_ROWS && "max-sm:hidden")}>
            <Link href={`/heroes/${e.hero.slug}`} className="group flex items-center gap-3 py-2">
              <span aria-hidden className="score score-outline w-5 shrink-0 text-right text-xl">
                {i + 1}
              </span>
              <HeroPortrait source={e.hero.images.icon ?? e.hero.images.portrait} name={e.hero.name} size="icon" decorative />
              <span className="min-w-0 flex-1 truncate font-heading text-lg font-bold uppercase leading-none text-chalk-100 transition-colors group-hover:text-gold-400">
                {e.hero.name}
              </span>
              <span className="score shrink-0 text-2xl">{percentage(locale, value(e))}</span>
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
        <ul className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {rows.map(({ slug, measure, variation: v, rise }) => {
            const h = heroesBySlug.get(slug);
            if (!h) return null;
            const Icon = rise ? TrendingUp : TrendingDown;
            return (
              <li key={`${measure}-${slug}`} className="min-w-0">
                <Link href={`/heroes/${slug}`} className="card-link group flex items-center gap-2.5 p-2">
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
