import Image from "next/image";
import { ArrowRight, CalendarClock, Clock, Layers, Search, Sparkles, Trophy } from "lucide-react";
import Link from "@/components/link";
import { BadgeTier, Score } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { HomeStage } from "@/components/home/home-stage";
import { SearchAllButton } from "@/components/home/search-all-button";
import { ServerTimeChip } from "@/components/home/server-time-chip";
import { SCROLL_ROW } from "@/components/home/scroll-row";
import { monthText } from "@/components/event-month";
import { shortDate } from "@/components/esports-parts";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { prefix } from "@/i18n/links";
import { createT } from "@/i18n/translations";
import { allHeroes, countItems, illustrations } from "@/lib/data";
import { sortedTournaments, tournamentStatus } from "@/lib/esports";
import { eventMonths, referenceDate } from "@/lib/events-server";
import { patchCurrent, percentage } from "@/lib/freshness";
import { groupAdjustments } from "@/lib/meta-report";
import { measure, rankingFull } from "@/lib/tier-list";
import { cn } from "@/lib/utils";

/**
 * Featured hero: the head of the tier list, the first reliably measured hero
 * (enough games for stable rates) that has an official artwork the site may
 * show (`illustrations` keeps only those, `listed.ts`). It changes when the
 * meta does, not with the calendar: the poster says who rules the patch.
 */
function topOfMeta() {
  const entry = rankingFull.find((e) => !e.lowSample && illustrations[e.hero.slug] && Object.keys(illustrations[e.hero.slug]).length);
  if (!entry) return null;
  return { hero: entry.hero, ranked: entry, illustration: Object.values(illustrations[entry.hero.slug])[0] };
}

/**
 * Embers rising from the foot of the poster: a dozen sparks, placed and
 * timed by a fixed sequence (the server and the browser draw the same ones),
 * gold for most, two in ally blue. CSS only, transforms and opacity
 * (globals.css, "Brand stage"); they rest under `prefers-reduced-motion`.
 */
const EMBERS = Array.from({ length: 14 }, (_, i) => {
  const r = (n: number) => ((i * 73 + n * 37) % 97) / 97;
  return {
    left: `${(6 + r(1) * 88).toFixed(1)}%`,
    size: `${(2 + r(2) * 3).toFixed(1)}px`,
    duration: `${(7 + r(3) * 7).toFixed(1)}s`,
    delay: `${(-r(4) * 12).toFixed(1)}s`,
    drift: `${((r(5) - 0.5) * 60).toFixed(0)}px`,
    blue: i % 7 === 3,
  };
});

function Embers() {
  return (
    <div aria-hidden className="stage-embers">
      {EMBERS.map((e, i) => (
        <i
          key={i}
          className={e.blue ? "is-azure" : undefined}
          style={
            {
              left: e.left,
              "--ember-size": e.size,
              "--ember-duration": e.duration,
              "--ember-delay": e.delay,
              "--ember-drift": e.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * First screen of the home page, one screen high from `lg`: a poster on a
 * stage. The official artwork of the meta's number one fills the right of
 * the screen, fading into the night, under a slow gold and blue glow, with
 * embers rising and every layer shifting a little with the pointer
 * (`HomeStage`, still under `prefers-reduced-motion`).
 *
 * The left column says what the site is and gets the visitor going: the
 * page's one H1, a one-line lead, the hero search as the largest control of
 * the screen (a plain GET form, working without JavaScript; Ctrl K opens
 * the global search), the two ways in (tier list, every hero) and four
 * quiet key figures counting up from zero. The right column names the
 * number one, its tier and its two rates — written once by the server, not
 * counted: they are the poster's message and must read right from the first
 * frame. On a phone the art is a short band at the top, the title over its
 * foot, so the search shows without scrolling; the number one follows.
 *
 * Under it, the day's state of the game in one rail — live patch, date of
 * the rates, next tournament, the month's StarLight skin and the server
 * clock — scrolling sideways on a phone.
 *
 * The artwork is the page's largest image: loaded first, in a frame whose
 * size is set before it arrives, so nothing moves when it does.
 */
export function HomeHero({ locale }: { locale: Locale }) {
  const t = createT(locale);
  const lang = LOCALE_INTL[locale];
  const featured = topOfMeta();
  const ranked = featured?.ranked ?? null;
  const groups = groupAdjustments(patchCurrent.adjustments ?? []);
  const changed = groups.buff.length + groups.nerf.length + groups.adjust.length;
  const figures = [
    { value: allHeroes.length, label: t("home.figures.heroes") },
    { value: changed, label: t("home.figures.changed") },
    { value: rankingFull.filter((e) => e.tier === "S+").length, label: t("home.figures.splus") },
    { value: countItems, label: t("home.figures.items") },
  ];

  const now = new Date();
  const tournament = sortedTournaments(now).find((x) => tournamentStatus(x, now) !== "finished");
  const status = tournament ? tournamentStatus(tournament, now) : null;
  const month = referenceDate.slice(0, 7);
  const starlight = eventMonths().find((m) => m.month === month)?.starlight[0];

  const rail: { href: string; label: string; value: string; icon: typeof Layers }[] = [
    {
      href: `/patch-notes/${patchCurrent.version}`,
      label: patchCurrent.date
        ? t("home.rail.patchSince", { date: shortDate(locale, patchCurrent.date) })
        : t("home.rail.patch"),
      value: patchCurrent.version,
      icon: Layers,
    },
    { href: "/tier-list", label: t("home.rail.rates"), value: shortDate(locale, measure), icon: CalendarClock },
    ...(tournament && status && tournament.startDate
      ? [
          {
            href: `/esports/${tournament.slug}`,
            label:
              status === "live"
                ? t("home.rail.esportsLive")
                : t("home.rail.esportsNext", { date: shortDate(locale, tournament.startDate) }),
            value: tournament.shortName,
            icon: Trophy,
          },
        ]
      : []),
    ...(starlight
      ? [
          {
            href: "/events",
            label: t("home.rail.starlight", { month: monthText(locale, month) }),
            value: starlight.name,
            icon: Sparkles,
          },
        ]
      : []),
  ];
  const decimal = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const roles = featured ? featured.hero.roles.map((r) => t(`roles.${r}`)).join(", ") : "";
  const railCell = "flex h-full min-h-11 items-start gap-3 border-l border-night-700 py-4 pl-4 pr-3";

  return (
    <section aria-labelledby="home-title" className={cn("relative isolate overflow-hidden", featured && "scheme-dark bg-night-950")}>
      <HomeStage className="relative">
        {/* The brand's glow, drifting slowly behind the whole poster. */}
        <div aria-hidden className="stage-glow" />
        {featured && (
          // On a phone the art is a band at the top of the page; from `lg` it
          // fills the right of the screen, behind both columns.
          <div aria-hidden className="relative h-[15rem] overflow-hidden sm:h-[22rem] lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[70%]">
            <div className="stage-art">
              <Image
                src={featured.illustration}
                alt=""
                fill
                priority
                fetchPriority="high"
                sizes="(min-width: 1024px) 70vw, 100vw"
                className="affiche-art object-cover object-[62%_22%]"
              />
            </div>
            {/* Night closing in where the text sits: under the title, and from `lg` on the left edge. */}
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-night-950 via-night-950/70 to-transparent" />
            <div className="absolute inset-y-0 left-0 hidden w-3/4 bg-linear-to-r from-night-950 via-night-950/70 to-transparent lg:block" />
            <Embers />
          </div>
        )}

        <div
          className={cn(
            "page-wrap relative grid grid-cols-1 gap-10 pb-10 sm:pb-14 lg:min-h-[clamp(36rem,calc(100svh-9.5rem),52rem)] lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:items-end lg:gap-12 lg:pb-16 lg:pt-16",
            featured ? "-mt-24 sm:-mt-32 lg:mt-0" : "pt-10",
          )}
        >
          <div className="min-w-0">
            <h1 id="home-title" className="display-caps text-[clamp(2.1rem,1.4rem+2.4vw,3.4rem)] leading-[0.94] tracking-[0.01em] text-chalk-100">
              {t("home.title", { version: patchCurrent.version })}
            </h1>
            <div aria-hidden className="eclat stage-blade mt-4 h-[3px] w-24" />
            <p className="mt-4 max-w-lg leading-relaxed text-chalk-300 sm:text-lg">
              {t("home.tagline", { heroes: allHeroes.length })}
            </p>

            {/*
              A plain GET form: the hero list reads `?q=`, so the search works
              before hydration and without JavaScript at all. The largest
              control of the screen, outlined in gold when it has the focus.
            */}
            <form
              role="search"
              action={prefix("/heroes", locale)}
              method="get"
              className="bevel mt-6 flex h-14 max-w-xl items-stretch bg-night-800 shadow-[inset_0_0_0_1px_var(--color-night-600)] transition-shadow focus-within:shadow-[inset_0_0_0_2px_var(--border-color-gold-400)] sm:mt-8 sm:h-16"
            >
              <label htmlFor="home-search" className="sr-only">
                {t("home.search.label")}
              </label>
              <Search size={20} aria-hidden className="ml-4 shrink-0 self-center text-gold-400" />
              <input
                id="home-search"
                name="q"
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                placeholder={t("home.search.placeholder")}
                className="min-w-0 flex-1 bg-transparent px-3 text-base text-chalk-100 outline-none placeholder:text-chalk-500 sm:text-lg"
              />
              <button
                type="submit"
                className="shrink-0 bg-gold-400 px-4 font-heading text-base font-bold uppercase tracking-wide text-night-950 transition-colors hover:bg-gold-300 active:bg-gold-600 sm:px-7 sm:text-lg"
              >
                {t("home.search.submit")}
              </button>
            </form>
            <p className="mt-3">
              <SearchAllButton label={t("home.search.all")} />
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <Link href="/tier-list" className="btn btn-primary px-3 text-sm sm:px-6 sm:text-base">
                <Trophy size={17} aria-hidden />
                {t("home.tierListCta")}
              </Link>
              <Link href="/heroes" className="btn btn-secondary px-3 text-sm sm:px-6 sm:text-base">
                {t("home.browse")}
                <ArrowRight size={17} aria-hidden />
              </Link>
            </div>

            {/* The site in four figures, counting up from zero the first time they show. */}
            <ul aria-label={t("home.figures.title")} className="mt-8 grid max-w-xl grid-cols-2 gap-y-4 sm:mt-10 sm:grid-cols-4">
              {figures.map((f) => (
                <li key={f.label} className="min-w-0 border-l border-night-700 pl-3">
                  <CountUp value={f.value} locale={lang} className="figure block text-[clamp(1.75rem,1.3rem+1.4vw,2.4rem)] leading-none text-chalk-100" />
                  <span className="mt-1.5 block text-xs leading-snug text-chalk-400 sm:text-sm">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {featured && (
            // The number one: after the search on a phone; from `lg`, the right column, over the art.
            <div className="relative min-w-0 lg:justify-self-end lg:text-right">
              <Link href={`/heroes/${featured.hero.slug}`} className="group block w-fit max-w-full lg:ml-auto">
                <span className="block font-heading text-base font-bold uppercase text-gold-400">
                  {t("featured.topMeta")}
                  {/* What "n°1" means: the tier list's score counts bans as well as wins. */}
                  <span className="font-sans text-sm font-normal normal-case text-chalk-400"> · {t("featured.topMetaHint")}</span>
                </span>
                <span className="affiche-name display-caps mt-1 block break-words pr-[0.12em] text-[clamp(3.5rem,1.5rem+8vw,8.5rem)] text-chalk-100 transition-colors group-hover:text-gold-300">
                  {featured.hero.name}
                </span>
                {featured.hero.title && (
                  <span className="mt-2 block text-base text-chalk-300 sm:text-lg">{featured.hero.title}</span>
                )}
              </Link>
              {ranked && (
                <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3 sm:mt-6 lg:justify-end">
                  <BadgeTier tier={ranked.tier} size="lg" />
                  {/* Written by the server, not counted: the poster's figures read right from the first frame. */}
                  <p className="min-w-0 text-left">
                    <span aria-hidden>
                      <Score
                        value={decimal.format(ranked.winRate)}
                        unit="%"
                        className="text-[clamp(3.25rem,2rem+4vw,6rem)]"
                      />
                      <span className="mt-2 block text-sm text-chalk-300">
                        {t("home.winRate", { value: "" }).trim()} · {roles}
                      </span>
                    </span>
                    <span className="sr-only">
                      {t("home.winRate", { value: percentage(locale, ranked.winRate) })},{" "}
                      {t("pages.heroDetail.stat.banRate")} {percentage(locale, ranked.banRate)}, {roles}
                    </span>
                  </p>
                  {/*
                    The ban rate beside the win rate, outlined as on the tier
                    list poster: a leader is often ranked first for being
                    feared, with a win rate close to 50 %.
                  */}
                  <p aria-hidden className="min-w-0 pb-6 text-left">
                    <Score
                      outline
                      value={decimal.format(ranked.banRate)}
                      unit="%"
                      className="text-[clamp(2rem,1.4rem+2vw,3.25rem)]"
                    />
                    <span className="mt-1.5 block text-sm text-chalk-400">{t("pages.heroDetail.stat.banRate")}</span>
                  </p>
                  <Link href={`/heroes/${featured.hero.slug}`} className="btn btn-secondary btn-sm mb-1 hidden sm:inline-flex">
                    {t("featured.seeSheet")}
                    <ArrowRight size={15} aria-hidden />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </HomeStage>

      {/* The day's state of the game: every fact links to the page it comes from. */}
      <div className="relative bg-night-900">
        <div aria-hidden className="eclat-rule" />
        <h2 className="sr-only">{t("home.rail.title")}</h2>
        <div className="page-wrap">
          <ul
            className={cn(SCROLL_ROW, "gap-0 py-0 lg:grid lg:grid-cols-[repeat(var(--cells),minmax(0,1fr))]")}
            style={{ "--cells": rail.length + 1 } as React.CSSProperties}
          >
            {rail.map(({ href, label, value, icon: Icon }) => (
              <li key={href} className="w-[12.5rem] shrink-0 snap-start lg:w-auto lg:min-w-0">
                <Link href={href} className={cn(railCell, "group transition-colors hover:bg-night-850")}>
                  <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-gold-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-chalk-400">{label}</span>
                    <span className="display-caps mt-1 block truncate pr-[0.15em] text-[1.6rem] leading-none text-chalk-100 transition-colors group-hover:text-gold-400">
                      {value}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            <li className="w-[13rem] shrink-0 snap-start lg:w-auto lg:min-w-0">
              <Link href="/tools/server-time" className={cn(railCell, "group transition-colors hover:bg-night-850")}>
                <Clock size={18} aria-hidden className="mt-0.5 shrink-0 text-gold-400" />
                <ServerTimeChip locale={lang} timeLabel={t("home.rail.serverTime")} resetLabel={t("home.rail.reset")} />
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
