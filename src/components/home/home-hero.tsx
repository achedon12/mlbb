import Image from "next/image";
import { ArrowRight, Search, Trophy } from "lucide-react";
import Link from "@/components/link";
import { BadgeTier, Score } from "@/components/ui";
import { SearchAllButton } from "@/components/home/search-all-button";
import { ServerTimeChip } from "@/components/home/server-time-chip";
import { monthText } from "@/components/event-month";
import { shortDate } from "@/components/esports-parts";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { prefix } from "@/i18n/links";
import { createT } from "@/i18n/translations";
import { allHeroes, illustrations } from "@/lib/data";
import { sortedTournaments, tournamentStatus } from "@/lib/esports";
import { eventMonths, referenceDate } from "@/lib/events-server";
import { patchCurrent, percentage } from "@/lib/freshness";
import { measure, rankingFull } from "@/lib/tier-list";

/**
 * Featured hero, chosen by the day of the year.
 *
 * A random draw would change the visual on every reload — the home page
 * must stay recognizable from one visit to the next during the day.
 */
function heroOfTheDay() {
  const eligible = allHeroes.filter((h) => illustrations[h.slug]);
  if (eligible.length === 0) return null;
  const day = Math.floor(Date.now() / 86_400_000);
  const hero = eligible[day % eligible.length];
  return { hero, illustration: Object.values(illustrations[hero.slug])[0] };
}

/**
 * First screen of the home page, built as a poster: the hero of the day's
 * official artwork across the page, its name in giant slanted capitals over
 * the art and its win rate as the one big figure. Beside it, what the site
 * is and a hero search that works without JavaScript; under it, the day's
 * state of the game in one rail — live patch, date of the rates, next
 * tournament, the month's StarLight skin and the server clock.
 *
 * The artwork is the page's largest image: loaded first, in a frame whose
 * size is set before it arrives, so nothing moves when it does.
 */
export function HomeHero({ locale }: { locale: Locale }) {
  const t = createT(locale);
  const lang = LOCALE_INTL[locale];
  const featured = heroOfTheDay();
  const ranked = featured ? rankingFull.find((e) => e.hero.slug === featured.hero.slug) : null;
  const rate = ranked ? new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ranked.winRate) : null;

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
      {featured && (
        // On a phone the art is a block at the top of the page; from `lg` it
        // fills the right of the screen, behind both columns.
        <div aria-hidden className="relative h-[25rem] sm:h-[32rem] lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[72%]">
          <Image
            src={featured.illustration}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 72vw, 100vw"
            className="affiche-art object-cover object-[62%_22%]"
          />
          {/* Night closing in where the text sits: under the name, and from `lg` on the left edge. */}
          <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-night-950 via-night-950/70 to-transparent" />
          <div className="absolute inset-y-0 left-0 hidden w-2/3 bg-linear-to-r from-night-950 via-night-950/60 to-transparent lg:block" />
        </div>
      )}

      <div className="page-wrap relative grid grid-cols-1 gap-8 pb-8 sm:pb-12 lg:min-h-[clamp(38rem,calc(90svh-4rem),54rem)] lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:items-end lg:gap-12 lg:pb-16 lg:pt-16">
        <div className="order-2 min-w-0 lg:order-none">
          <h1 id="home-title" className="display-caps text-[clamp(2.1rem,1.3rem+2.2vw,3.1rem)] leading-[0.94] tracking-[0.01em] text-chalk-100">
            {t("home.title", { version: patchCurrent.version })}
          </h1>
          <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
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
        </div>

        {featured && (
          // Pulled up over the art on a phone; from `lg`, the right column, over the art.
          <div className="relative order-1 -mt-44 min-w-0 sm:-mt-56 lg:order-none lg:mt-0">
            <Link href={`/heroes/${featured.hero.slug}`} className="group block w-fit max-w-full">
              <span className="block font-heading text-base font-bold uppercase text-gold-400">{t("featured.heroOfTheDay")}</span>
              <span className="affiche-name type-giant mt-1 block break-words text-chalk-100 transition-colors group-hover:text-gold-300">
                {featured.hero.name}
              </span>
              {featured.hero.title && (
                <span className="mt-2 block text-base text-chalk-300 sm:text-lg">{featured.hero.title}</span>
              )}
            </Link>
            {ranked && rate && (
              <div className="mt-4 flex items-end gap-4 sm:mt-6 sm:gap-5">
                <BadgeTier tier={ranked.tier} size="lg" />
                <p className="min-w-0">
                  <span aria-hidden>
                    <Score value={rate} unit="%" className="text-[clamp(3.75rem,2.2rem+5vw,7rem)]" />
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
      </div>

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
