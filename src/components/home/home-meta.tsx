import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { COLOR_TIER, SectionTitle } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { createT, type T } from "@/i18n/translations";
import { allHeroes, heroesBySlug } from "@/lib/data";
import { trendsOf } from "@/lib/evolution";
import { longDate, patchCurrent, percentage } from "@/lib/freshness";
import { firstNBy } from "@/lib/meta-report";
import { measure, ORDER_TIERS, rankingFull, type RankedEntry } from "@/lib/tier-list";
import { describeGap, formatGap, movesWeek } from "@/lib/trends";
import { cn } from "@/lib/utils";

/** Rows per list: five names read at a glance, the full table is one click away. */
const ROWS = 5;
const PHONE_ROWS = 3;

/**
 * The meta in one screen: how the ranked heroes split across tiers, who
 * sits at the top, and the three lists a player asks for first — highest
 * win rate, most banned, most played — plus the week's biggest moves.
 * Everything comes from the synced rates; nothing here is an opinion.
 */
export function HomeMeta({ locale }: { locale: Locale }) {
  const t = createT(locale);
  const counts = ORDER_TIERS.map((tier) => ({ tier, n: rankingFull.filter((e) => e.tier === tier).length })).filter(
    (c) => c.n > 0,
  );
  const top = rankingFull.filter((e) => e.tier === "S+");
  const reliable = rankingFull.filter((e) => !e.lowSample);
  const week = movesWeek(
    allHeroes.map((h) => ({ slug: h.slug, series: trendsOf(h.slug).all })),
    3,
  );

  const lists: { title: string; entries: RankedEntry[]; value: (e: RankedEntry) => number; href: string }[] = [
    { title: t("home.meta.win"), entries: firstNBy(reliable, (e) => e.winRate, ROWS), value: (e) => e.winRate, href: "/statistics" },
    { title: t("home.meta.ban"), entries: firstNBy(rankingFull, (e) => e.banRate, ROWS), value: (e) => e.banRate, href: "/statistics" },
    { title: t("home.meta.pick"), entries: firstNBy(rankingFull, (e) => e.pickRate, ROWS), value: (e) => e.pickRate, href: "/statistics" },
  ];

  return (
    <section aria-labelledby="home-meta" className="mx-auto max-w-6xl px-4 py-8 sm:py-16">
      <SectionTitle
        id="home-meta"
        lead={t("home.meta.lead", { date: longDate(locale, measure), n: rankingFull.length })}
        action={{ href: "/tier-list", label: t("home.fullTierList") }}
      >
        {t("home.meta.title", { version: patchCurrent.version })}
      </SectionTitle>

      {/* Proportional bar: the width of a tier is its share of the ranked heroes. */}
      <Link href="/tier-list" className="group block" aria-label={t("home.meta.splitLabel", { n: rankingFull.length })}>
        <ul aria-hidden className="bevel-sm flex h-9 overflow-hidden">
          {counts.map((c) => (
            <li
              key={c.tier}
              style={{ flexGrow: c.n }}
              className={cn(
                "flex min-w-0 basis-0 items-center justify-center gap-1.5 border-r border-night-950 font-heading text-sm font-bold last:border-r-0",
                COLOR_TIER[c.tier],
              )}
            >
              <span>{c.tier}</span>
              <span className="hidden font-medium opacity-80 sm:inline">{c.n}</span>
            </li>
          ))}
        </ul>
      </Link>
      <p className="sr-only">
        {counts.map((c) => t("home.meta.tierCount", { tier: c.tier, n: c.n })).join(", ")}
      </p>

      {top.length > 0 && (
        <div className="mt-6 sm:mt-8">
          <h3 className="font-heading text-lg font-bold text-chalk-100">
            {t("home.meta.topTier", { n: top.length })}
          </h3>
          <ul className="mt-3 grid grid-cols-6 gap-x-2 gap-y-3 sm:grid-cols-8">
            {top.map((e) => (
              <li key={e.hero.slug}>
                <Link
                  href={`/heroes/${e.hero.slug}`}
                  className="group flex flex-col items-center gap-1.5 text-center"
                >
                  <HeroPortrait
                    source={e.hero.images.portrait ?? e.hero.images.icon}
                    name={e.hero.name}
                    size="thumb"
                    decorative
                    className="size-11 border border-night-700 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:border-gold-500/60 sm:size-16"
                  />
                  <span className="w-full truncate text-[0.7rem] font-semibold text-chalk-300 sm:text-xs transition-colors group-hover:text-gold-400">
                    {e.hero.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {lists.map((l) => (
          <RateList key={l.title} title={l.title} entries={l.entries} value={l.value} locale={locale} />
        ))}
        <WeekList rises={week.rises} drops={week.drops} locale={locale} t={t} />
      </div>
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
    <div className="bevel border border-night-700/70 bg-night-900/60 p-3 sm:p-4">
      <h3 className="font-heading text-base font-bold text-chalk-100">{title}</h3>
      <ol className="mt-2 space-y-1">
        {entries.map((e, i) => (
          // Three rows on a phone: four lists of five stacked ran two screens.
          <li key={e.hero.slug} className={cn(i >= PHONE_ROWS && "max-sm:hidden")}>
            <Link
              href={`/heroes/${e.hero.slug}`}
              className="group flex items-center gap-2.5 py-0.5"
            >
              <span aria-hidden className="w-3 shrink-0 text-right text-xs tabular-nums text-chalk-600">
                {i + 1}
              </span>
              <HeroPortrait source={e.hero.images.icon ?? e.hero.images.portrait} name={e.hero.name} size="small" decorative />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk-200 transition-colors group-hover:text-gold-400">
                {e.hero.name}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-chalk-300">{percentage(locale, value(e))}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The week's three biggest rises and drops; the arrow and the colour double the sign. */
function WeekList({
  rises,
  drops,
  locale,
  t,
}: {
  rises: ReturnType<typeof movesWeek>["rises"];
  drops: ReturnType<typeof movesWeek>["drops"];
  locale: Locale;
  t: T;
}) {
  const rows = [
    ...rises.map((m) => ({ ...m, rise: true })),
    ...drops.map((m) => ({ ...m, rise: false })),
  ];
  return (
    <div className="bevel border border-night-700/70 bg-night-900/60 p-3 sm:p-4">
      <h3 className="font-heading text-base font-bold text-chalk-100">{t("home.meta.week")}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-chalk-500">{t("home.meta.weekEmpty")}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map(({ slug, variation: v, rise }) => {
            const h = heroesBySlug.get(slug);
            if (!h) return null;
            const Icon = rise ? TrendingUp : TrendingDown;
            return (
              <li key={slug}>
                <Link href={`/heroes/${slug}`} className="group flex items-center gap-2.5 py-0.5">
                  <HeroPortrait source={h.images.icon ?? h.images.portrait} name={h.name} size="small" decorative />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk-200 transition-colors group-hover:text-gold-400">
                    {h.name}
                  </span>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums",
                      rise ? "text-emerald-400" : "text-blood-500",
                    )}
                  >
                    <Icon size={14} aria-hidden />
                    <span aria-hidden>{formatGap(v.gap, locale)} {t("counters.pts")}</span>
                    <span className="sr-only">{describeGap(t, locale, v.gap, v.days)}</span>
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
