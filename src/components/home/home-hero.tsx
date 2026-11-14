import Image from "next/image";
import { ArrowRight, Search, Trophy } from "lucide-react";
import Link from "@/components/link";
import { BadgeTier } from "@/components/ui";
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
 * First screen of the home page: what the site is, a hero search that works
 * without JavaScript, and the day's state of the game in one rail — live
 * patch, date of the rates, next tournament, the month's StarLight skin and
 * the server clock. The hero of the day carries the artwork; its
 * illustration is the page's largest image, loaded first.
 */
export function HomeHero({ locale }: { locale: Locale }) {
  const t = createT(locale);
  const lang = LOCALE_INTL[locale];
  const featured = heroOfTheDay();
  const ranked = featured ? rankingFull.find((e) => e.hero.slug === featured.hero.slug) : null;

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
    <section aria-labelledby="home-title" className="relative overflow-hidden border-b border-night-700/70">
      {featured && (
        <div aria-hidden className="absolute inset-0 lg:left-[34%]">
          <Image
            src={featured.illustration}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 66vw, 100vw"
            className="object-cover object-[60%_20%]"
          />
          {/* Solid where the text sits: on a phone the whole width, from `lg` the left edge of the art. */}
          <div className="absolute inset-0 bg-night-950/80 lg:bg-transparent lg:bg-linear-to-r lg:from-night-950 lg:via-night-950/50 lg:to-night-950/10" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-night-950 to-transparent" />
        </div>
      )}

      <div className="page-wrap relative grid grid-cols-1 gap-6 pb-6 pt-6 sm:pb-10 sm:pt-14 lg:min-h-[32rem] lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:gap-10 lg:pt-20">
        <div className="min-w-0 max-w-2xl">
          <h1
            id="home-title"
            className="font-heading text-[2rem] font-bold leading-[1.05] text-chalk-100 sm:text-5xl lg:text-[3.6rem]"
          >
            {t("home.title", { version: patchCurrent.version })}
          </h1>
          <p className="mt-3 max-w-xl leading-relaxed text-chalk-300 sm:mt-5 sm:text-lg">
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
            className="bevel-sm mt-5 flex max-w-xl items-stretch border border-night-600 bg-night-950/80 focus-within:border-gold-500/70 sm:mt-7"
          >
            <label htmlFor="home-search" className="sr-only">
              {t("home.search.label")}
            </label>
            <Search size={18} aria-hidden className="ml-3 shrink-0 self-center text-chalk-500" />
            <input
              id="home-search"
              name="q"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder={t("home.search.placeholder")}
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-chalk-100 outline-none placeholder:text-chalk-500"
            />
            <button
              type="submit"
              className="shrink-0 bg-gold-500 px-4 font-semibold text-night-950 transition-colors hover:bg-gold-400 active:bg-gold-600 sm:px-5"
            >
              {t("home.search.submit")}
            </button>
          </form>
          <p className="mt-2.5">
            <SearchAllButton label={t("home.search.all")} />
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-7 sm:flex sm:flex-wrap sm:gap-3">
            <Link
              href="/heroes"
              className="bevel-sm flex items-center justify-center gap-2 border border-night-600 bg-night-950/60 px-3 py-2.5 text-sm font-semibold sm:px-5 sm:text-base text-chalk-100 transition-colors hover:border-gold-500/60 hover:text-gold-400"
            >
              {t("home.browse")}
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link
              href="/tier-list"
              className="bevel-sm flex items-center justify-center gap-2 border border-night-600 bg-night-950/60 px-3 py-2.5 text-sm font-semibold sm:px-5 sm:text-base text-chalk-100 transition-colors hover:border-gold-500/60 hover:text-gold-400"
            >
              <Trophy size={17} aria-hidden />
              {t("home.tierListCta")}
            </Link>
          </div>
        </div>

        {featured && (
          <Link
            href={`/heroes/${featured.hero.slug}`}
            className="bevel group block border border-night-600/80 bg-night-950/75 p-3 backdrop-blur-sm sm:p-4 transition-colors hover:border-gold-500/60"
          >
            <span className="block text-xs font-semibold text-gold-400">{t("featured.heroOfTheDay")}</span>
            <span className="mt-1 flex items-center gap-3">
              {ranked && <BadgeTier tier={ranked.tier} />}
              <span className="min-w-0">
                <span className="block truncate font-heading text-2xl font-bold leading-tight text-chalk-100 transition-colors group-hover:text-gold-400">
                  {featured.hero.name}
                </span>
                {featured.hero.title && (
                  <span className="block truncate text-sm text-chalk-400 max-sm:hidden">{featured.hero.title}</span>
                )}
              </span>
            </span>
            <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-chalk-300 sm:mt-3">
              <span>{featured.hero.roles.map((r) => t(`roles.${r}`)).join(", ")}</span>
              {ranked && <span>{t("home.winRate", { value: percentage(locale, ranked.winRate) })}</span>}
            </span>
            <span className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-gold-400 max-sm:hidden">
              {t("featured.seeSheet")}
              <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}
      </div>

      {/* The day's state of the game: every fact links to the page it comes from. */}
      <div className="relative border-t border-night-700/70 bg-night-950/85">
        <h2 className="sr-only">{t("home.rail.title")}</h2>
        <ul className="page-wrap grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-5">
          {rail.map((r) => (
            <li key={r.href}>
              <Link href={r.href} className="group flex h-full flex-col py-3 pr-3 transition-colors">
                <span className="text-xs text-chalk-500">{r.label}</span>
                <span className="truncate font-heading text-lg font-bold leading-tight text-chalk-100 transition-colors group-hover:text-gold-400">
                  {r.value}
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/tools/server-time" className="group flex h-full py-3 pr-3">
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
