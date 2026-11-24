import Image from "next/image";
import { ArrowRight, Search, Trophy } from "lucide-react";
import Link from "@/components/link";
import { BadgeTier, Score } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { DexSays } from "@/components/mascot";
import { HomeStage } from "@/components/home/home-stage";
import { SearchAllButton } from "@/components/home/search-all-button";
import { ServerTimeChip } from "@/components/home/server-time-chip";
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
 * First screen of the home page, built as a poster on a stage: the official
 * artwork of the meta's number one across the page, its name in giant
 * slanted capitals over the art and its win rate as the one big figure,
 * counting up. Behind it a slow glow in the brand's gold and blue, embers
 * rising from the foot, and every layer shifting a little with the pointer
 * (`HomeStage`). Dex presents the live patch in his bubble. Beside it, what the site
 * is, a hero search that works without JavaScript and the site's key
 * figures, counting up as they come into view; under it, the day's
 * state of the game in one rail — live patch, date of the rates, next
 * tournament, the month's StarLight skin and the server clock.
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

  const rail: { href: string; label: string; value: string }[] = [
    {
      href: `/patch-notes/${patchCurrent.version}`,
      label: patchCurrent.date
        ? t("home.rail.patchSince", { date: shortDate(locale, patchCurrent.date) })
        : t("home.rail.patch"),
      value: patchCurrent.version,
    },
    { href: "/tier-list", label: t("home.rail.rates"), value: shortDate(locale, measure) },
    ...(tournament && status && tournament.startDate
      ? [
          {
            href: `/esports/${tournament.slug}`,
            label:
              status === "live"
                ? t("home.rail.esportsLive")
                : t("home.rail.esportsNext", { date: shortDate(locale, tournament.startDate) }),
            value: tournament.shortName,
          },
        ]
      : []),
    ...(starlight
      ? [{ href: "/events", label: t("home.rail.starlight", { month: monthText(locale, month) }), value: starlight.name }]
      : []),
  ];

  return (
    <section aria-labelledby="home-title" className="relative isolate overflow-hidden">
      <HomeStage className="relative">
        {/* The brand's glow, drifting slowly behind the whole poster. */}
        <div aria-hidden className="stage-glow" />
        {featured && (
          // On a phone the art is a block at the top of the page; from `lg` it
          // fills the right of the screen, behind both columns.
          <div aria-hidden className="relative h-[25rem] overflow-hidden sm:h-[32rem] lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[72%]">
            <div className="stage-art">
              <Image
                src={featured.illustration}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 72vw, 100vw"
                className="affiche-art object-cover object-[62%_22%]"
              />
            </div>
            {/* Night closing in where the text sits: under the name, and from `lg` on the left edge. */}
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-night-950 via-night-950/70 to-transparent" />
            <div className="absolute inset-y-0 left-0 hidden w-2/3 bg-linear-to-r from-night-950 via-night-950/60 to-transparent lg:block" />
            <Embers />
          </div>
        )}

        <div className="page-wrap relative grid grid-cols-1 gap-8 pb-8 sm:pb-12 lg:min-h-[clamp(38rem,calc(90svh-4rem),54rem)] lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:items-end lg:gap-12 lg:pb-16 lg:pt-16">
          <div className="order-2 min-w-0 lg:order-none">
            <h1 id="home-title" className="display-caps text-[clamp(2.1rem,1.3rem+2.2vw,3.1rem)] leading-[0.94] tracking-[0.01em] text-chalk-100">
              {t("home.title", { version: patchCurrent.version })}
            </h1>
            <div aria-hidden className="eclat stage-blade mt-4 h-[3px] w-24" />
            <p className="mt-4 max-w-xl leading-relaxed text-chalk-300 sm:text-lg">
              {t("home.lead", { heroes: allHeroes.length })}
            </p>

            {/*
              A plain GET form: the hero list reads `?q=`, so the search works
              before hydration and without JavaScript at all.
            */}
            <form
              role="search"
              action={prefix("/heroes", locale)}
              method="get"
              className="bevel-sm mt-6 flex max-w-xl items-stretch bg-night-800 shadow-[inset_0_0_0_1px_var(--color-night-600)] focus-within:shadow-[inset_0_0_0_1px_var(--color-gold-400)] sm:mt-8"
            >
              <label htmlFor="home-search" className="sr-only">
                {t("home.search.label")}
              </label>
              <Search size={18} aria-hidden className="ml-3.5 shrink-0 self-center text-chalk-500" />
              <input
                id="home-search"
                name="q"
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                placeholder={t("home.search.placeholder")}
                className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-base text-chalk-100 outline-none placeholder:text-chalk-500"
              />
              <button
                type="submit"
                className="shrink-0 bg-gold-400 px-4 font-heading text-base font-bold uppercase tracking-wide text-night-950 transition-[background-color,transform] hover:bg-gold-300 active:translate-y-px active:bg-gold-600 sm:px-6"
              >
                {t("home.search.submit")}
              </button>
            </form>
            <p className="mt-3">
              <SearchAllButton label={t("home.search.all")} />
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <Link href="/heroes" className="btn btn-secondary px-3 text-sm sm:px-5 sm:text-base">
                {t("home.browse")}
                <ArrowRight size={17} aria-hidden />
              </Link>
              <Link href="/tier-list" className="btn btn-secondary px-3 text-sm sm:px-5 sm:text-base">
                <Trophy size={17} aria-hidden />
                {t("home.tierListCta")}
              </Link>
            </div>

            {/* The site in four figures, counting up the first time they show. */}
            <ul aria-label={t("home.figures.title")} className="mt-8 grid max-w-xl grid-cols-4 gap-3 sm:mt-10">
              {figures.map((f) => (
                <li key={f.label} className="min-w-0">
                  <CountUp value={f.value} locale={lang} className="figure block text-[clamp(1.9rem,1.4rem+1.6vw,2.6rem)] leading-none text-chalk-100" />
                  <span className="mt-1.5 block text-xs leading-snug text-chalk-400 sm:text-sm">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {featured && (
            // Pulled up over the art on a phone; from `lg`, the right column, over the art.
            <div className="relative order-1 -mt-44 min-w-0 sm:-mt-56 lg:order-none lg:mt-0">
              <Link href={`/heroes/${featured.hero.slug}`} className="group block w-fit max-w-full">
                <span className="block font-heading text-base font-bold uppercase text-gold-400">
                  {t("featured.topMeta")}
                </span>
                <span className="affiche-name type-giant mt-1 block break-words text-chalk-100 transition-colors group-hover:text-gold-300">
                  {featured.hero.name}
                </span>
                {featured.hero.title && (
                  <span className="mt-2 block text-base text-chalk-300 sm:text-lg">{featured.hero.title}</span>
                )}
              </Link>
              {ranked && (
                <div className="mt-4 flex items-end gap-4 sm:mt-6 sm:gap-5">
                  <BadgeTier tier={ranked.tier} size="lg" />
                  <p className="min-w-0">
                    <span aria-hidden>
                      <Score
                        value={<CountUp value={ranked.winRate} decimals={1} locale={lang} />}
                        unit="%"
                        className="text-[clamp(3.75rem,2.2rem+5vw,7rem)]"
                      />
                      <span className="mt-2.5 block text-sm text-chalk-300">
                        {t("home.winRate", { value: "" }).trim()} · {featured.hero.roles.map((r) => t(`roles.${r}`)).join(", ")}
                      </span>
                    </span>
                    <span className="sr-only">
                      {t("home.winRate", { value: percentage(locale, ranked.winRate) })}, {featured.hero.roles.map((r) => t(`roles.${r}`)).join(", ")}
                    </span>
                  </p>
                  <Link
                    href={`/heroes/${featured.hero.slug}`}
                    className="btn btn-primary btn-sm mb-1 ml-auto hidden sm:inline-flex lg:ml-6"
                  >
                    {t("featured.seeSheet")}
                    <ArrowRight size={15} aria-hidden />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/*
            Dex presents the live patch: under the buttons on a phone, in the
            poster's top corner from `lg`, where the art leaves the sky free.
          */}
          <DexSays
            pose="salut"
            height={96}
            side="right"
            className="stage-dex order-3 lg:absolute lg:right-[clamp(1rem,0.4rem+2.4vw,3rem)] lg:top-8 lg:order-none"
          >
            <span className="block text-sm leading-snug sm:text-base">
              {featured
                ? t("home.stage.dexPatch", { version: patchCurrent.version, n: changed, hero: featured.hero.name })
                : t("home.stage.dexPatchAlone", { version: patchCurrent.version, n: changed })}
            </span>
            <Link
              href={`/patch-notes/${patchCurrent.version}`}
              className="mt-2 inline-flex items-center gap-1 font-heading text-sm font-bold uppercase text-gold-400 hover:text-gold-300"
            >
              {t("home.stage.dexCta")}
              <ArrowRight size={14} aria-hidden />
            </Link>
          </DexSays>
        </div>
      </HomeStage>
      {/* The day's state of the game: every fact links to the page it comes from. */}
      <div className="relative bg-night-900">
        <div aria-hidden className="eclat-rule" />
        <h2 className="sr-only">{t("home.rail.title")}</h2>
        <ul className="page-wrap grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {rail.map((r) => (
            <li key={r.href} className="min-w-0">
              <Link href={r.href} className="group flex h-full flex-col py-3.5 pr-3 transition-colors sm:py-4">
                <span className="text-xs text-chalk-500">{r.label}</span>
                <span className="display-caps mt-1 truncate text-[1.6rem] leading-none text-chalk-100 transition-colors group-hover:text-gold-400">
                  {r.value}
                </span>
              </Link>
            </li>
          ))}
          <li className="min-w-0">
            <Link href="/tools/server-time" className="group flex h-full py-3.5 pr-3 sm:py-4">
              <ServerTimeChip
                locale={lang}
                timeLabel={t("home.rail.serverTime")}
                resetLabel={t("home.rail.reset")}
              />
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
