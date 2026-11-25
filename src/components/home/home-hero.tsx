import Image from "next/image";
import { ArrowRight, Search } from "lucide-react";
import Link from "@/components/link";
import { SearchAllButton } from "@/components/home/search-all-button";
import { ServerTimeChip } from "@/components/home/server-time-chip";
import { monthText } from "@/components/event-month";
import { shortDate } from "@/components/esports-parts";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { prefix } from "@/i18n/links";
import { createT } from "@/i18n/translations";
import { illustrations } from "@/lib/data";
import { sortedTournaments, tournamentStatus } from "@/lib/esports";
import { eventMonths, referenceDate } from "@/lib/events-server";
import { patchCurrent } from "@/lib/freshness";
import { measure, rankingFull } from "@/lib/tier-list";
import { cn } from "@/lib/utils";

/**
 * Featured hero: the head of the tier list, the first reliably measured hero
 * (enough games for stable rates) that has an official artwork the site may
 * show (`illustrations` keeps only those, `listed.ts`). It changes when the
 * meta does, not with the calendar: the poster shows who rules the patch.
 */
export function topOfMeta() {
  const entry = rankingFull.find((e) => !e.lowSample && illustrations[e.hero.slug] && Object.keys(illustrations[e.hero.slug]).length);
  if (!entry) return null;
  const [skin, illustration] = Object.entries(illustrations[entry.hero.slug])[0];
  return { hero: entry.hero, ranked: entry, skin, illustration };
}

/**
 * First screen of the home page: a game poster. The official artwork of the
 * meta's number one fills the screen edge to edge, the night closing in from
 * the left and the foot where the words sit. Over it, the page's one H1 set
 * large and tight, one line of fact (the patch, how many heroes were
 * measured and when), the hero search — the screen's first action, a plain
 * GET form that works without JavaScript — and two ways in. A small caption
 * names the hero on the art.
 *
 * On a phone the art is a band at the top, the title over its foot, so the
 * search shows on the first screen.
 *
 * Under the poster, the day's state of the game in one line of text: the
 * live patch, the next tournament, the month's StarLight skin and the
 * server clock, each a link to its page.
 *
 * Nothing here moves by itself: the artwork is the page's largest image,
 * loaded first in a frame sized before it arrives.
 */
export function HomeHero({ locale }: { locale: Locale }) {
  const t = createT(locale);
  const lang = LOCALE_INTL[locale];
  const featured = topOfMeta();

  const now = new Date();
  const tournament = sortedTournaments(now).find((x) => tournamentStatus(x, now) !== "finished");
  const status = tournament ? tournamentStatus(tournament, now) : null;
  const month = referenceDate.slice(0, 7);
  const starlight = eventMonths().find((m) => m.month === month)?.starlight[0];

  const facts: { href: string; label: string; value: string }[] = [
    {
      href: `/patch-notes/${patchCurrent.version}`,
      label: patchCurrent.date
        ? t("home.rail.patchSince", { date: shortDate(locale, patchCurrent.date) })
        : t("home.rail.patch"),
      value: patchCurrent.version,
    },
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
    <section aria-labelledby="home-title" className={cn("relative isolate", featured && "scheme-dark bg-night-950")}>
      <div className="relative overflow-hidden">
        {featured && (
          // On a phone a band at the top of the page; from `lg` the whole screen.
          <div aria-hidden className="relative h-[15rem] sm:h-[24rem] lg:absolute lg:inset-0 lg:h-auto">
            <Image
              src={featured.illustration}
              alt=""
              fill
              priority
              fetchPriority="high"
              sizes="100vw"
              className="object-cover object-[60%_20%] lg:object-[70%_22%]"
            />
            {/* Night closing in where the words sit: the foot, and from `lg` the left. */}
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-night-950 via-night-950/75 to-transparent lg:h-1/2" />
            <div className="absolute inset-y-0 left-0 hidden w-[62%] bg-linear-to-r from-night-950 via-night-950/80 to-transparent lg:block" />
          </div>
        )}

        <div
          className={cn(
            "page-wrap relative flex flex-col justify-end pb-10 sm:pb-14 lg:min-h-[clamp(38rem,calc(100svh-4rem),56rem)] lg:pb-20 lg:pt-24",
            featured ? "-mt-24 sm:-mt-36 lg:mt-0" : "pt-10",
          )}
        >
          <div className="max-w-[44rem]">
            <h1
              id="home-title"
              className="display-caps text-balance text-[clamp(2.15rem,1.2rem+3.4vw,4.6rem)] leading-[0.9] text-chalk-100"
            >
              {t("home.title", { version: patchCurrent.version })}
            </h1>
            <p className="mt-5 text-base text-chalk-300 sm:text-lg">
              {t("home.fact", { version: patchCurrent.version, n: rankingFull.length, date: shortDate(locale, measure) })}
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
              className="bevel mt-6 flex h-14 max-w-xl items-stretch bg-night-800/90 shadow-[inset_0_0_0_1px_var(--color-night-600)] transition-shadow focus-within:shadow-[inset_0_0_0_2px_var(--border-color-gold-400)] sm:mt-8 sm:h-16"
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

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
              <Link href="/tier-list" className="btn btn-primary px-6">
                {t("home.tierListCta")}
              </Link>
              <Link
                href="/heroes"
                className="group inline-flex min-h-11 items-center gap-2 font-heading text-base font-bold uppercase tracking-wide text-chalk-100 transition-colors hover:text-gold-300"
              >
                {t("home.browse")}
                <ArrowRight size={17} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {featured && (
            // The art's caption, at the foot of the poster on a wide screen.
            <p className="mt-10 text-sm text-chalk-400 lg:absolute lg:bottom-20 lg:right-[clamp(1rem,0.4rem+2.4vw,3rem)] lg:mt-0 lg:text-right">
              <Link href={`/heroes/${featured.hero.slug}`} className="font-heading text-base font-bold uppercase text-chalk-100 hover:text-gold-300">
                {featured.hero.name}
              </Link>
              <span className="block">{t("home.artCaption", { skin: featured.skin })}</span>
            </p>
          )}
        </div>
      </div>

      {/* The day's state of the game, as one line of text: each fact links to its page. */}
      <div className="border-y border-night-800 bg-night-950">
        <h2 className="sr-only">{t("home.rail.title")}</h2>
        <ul className="page-wrap flex flex-wrap items-baseline gap-x-6 gap-y-2 py-4 text-sm text-chalk-400">
          {facts.map(({ href, label, value }) => (
            <li key={href}>
              <Link href={href} className="group inline-flex min-h-11 items-baseline gap-2 py-2 sm:min-h-0 sm:py-0">
                <span>{label}</span>
                <span className="font-heading text-base font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-300">
                  {value}
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/tools/server-time" className="group inline-flex min-h-11 items-baseline py-2 sm:min-h-0 sm:py-0">
              <ServerTimeChip locale={lang} timeLabel={t("home.rail.serverTime")} resetLabel={t("home.rail.reset")} />
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
