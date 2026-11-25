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

/** The H1's "Mobile Legends:" opening, split from the rest so the poster can set it as a smaller line. */
export function splitTitle(title: string): [string, string] {
  const m = /^(.+?\s?:)\s+(.+)$/.exec(title);
  return m ? [m[1], m[2]] : ["", title];
}

/**
 * A few sparks over the art: a dozen gold points that brighten and fade in
 * place, at fixed positions (the server and the browser draw the same).
 * CSS only, opacity and transform (globals.css, "Home poster"); gone under
 * reduced motion.
 */
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const r = (n: number) => ((i * 73 + n * 41) % 97) / 97;
  return {
    left: `${(40 + r(1) * 56).toFixed(1)}%`,
    top: `${(8 + r(2) * 70).toFixed(1)}%`,
    delay: `${(-r(3) * 6).toFixed(1)}s`,
    size: `${(2 + r(4) * 3).toFixed(1)}px`,
  };
});

function Sparks() {
  return (
    <div className="home-sparks">
      {SPARKS.map((p, i) => (
        <i key={i} style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDelay: p.delay }} />
      ))}
    </div>
  );
}

/**
 * First screen of the home page: a game poster. The official artwork of the
 * meta's number one fills the screen edge to edge at every width, the night
 * closing in only where the words sit (the left of the screen, the foot);
 * the art settles once on arrival and a few sparks glint over it.
 *
 * Over it, the page's one H1 set huge (its "Mobile Legends:" opening as a
 * smaller line above), one line of fact, the hero search — the screen's
 * first action, a plain GET form that works without JavaScript — and two
 * ways in. A caption names the hero and the skin on the art.
 *
 * Under the poster, the day's state of the game in one thin line of text:
 * the live patch, the next tournament, the month's StarLight skin and the
 * server clock, each a link to its page.
 *
 * The artwork is the page's largest image, loaded first in a frame sized
 * before it arrives; its arrival and the sparks rest under reduced motion.
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
  const [kicker, headline] = splitTitle(t("home.title", { version: patchCurrent.version }));

  return (
    <section aria-labelledby="home-title" className={cn("relative isolate", featured && "scheme-dark bg-night-950")}>
      <div className="relative overflow-hidden">
        {featured && (
          <div aria-hidden className="absolute inset-0">
            <div className="home-art absolute inset-0">
              <Image
                src={featured.illustration}
                alt=""
                fill
                priority
                fetchPriority="high"
                sizes="100vw"
                className="object-cover object-[64%_18%] lg:object-[70%_20%]"
              />
            </div>
            {/* Night only where the words sit: the foot, and from `lg` the left of the screen. */}
            <div className="absolute inset-x-0 bottom-0 h-[72%] bg-linear-to-t from-night-950 via-night-950/75 to-transparent lg:h-[42%] lg:via-night-950/30" />
            <div className="absolute inset-y-0 left-0 hidden w-[58%] bg-linear-to-r from-night-950/90 via-night-950/45 to-transparent lg:block" />
            <Sparks />
          </div>
        )}

        <div
          className={cn(
            "page-wrap relative flex flex-col justify-end",
            featured
              ? "min-h-[calc(100svh-4rem)] pb-8 pt-40 sm:pb-14 lg:min-h-[clamp(40rem,calc(100svh-7rem),60rem)] lg:pb-16"
              : "py-10",
          )}
        >
          <div className="max-w-[min(100%,54rem)]">
            <h1 id="home-title" className="text-chalk-100 [text-shadow:0_2px_28px_rgb(6_8_15_/_0.55)]">
              {kicker && (
                <span className="block font-heading text-[clamp(1.05rem,0.85rem+0.8vw,1.6rem)] font-bold uppercase tracking-wide text-gold-300">
                  {kicker}
                </span>
              )}{" "}
              <span className="affiche-name display-caps mt-2 block text-balance pr-[0.1em] text-[clamp(2.5rem,0.8rem+6.3vw,7.25rem)] leading-[0.86]">
                {headline}
              </span>
            </h1>
            <p className="mt-5 text-base text-chalk-200 sm:text-lg">
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
              className="bevel mt-6 flex h-14 max-w-xl items-stretch bg-night-950/85 shadow-[inset_0_0_0_1px_var(--color-night-600)] transition-shadow focus-within:shadow-[inset_0_0_0_2px_var(--border-color-gold-400)] sm:h-16"
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
                className="min-w-0 flex-1 bg-transparent px-3 text-base text-chalk-100 outline-none placeholder:text-chalk-400 sm:text-lg"
              />
              <button
                type="submit"
                className="shrink-0 bg-gold-400 px-4 font-heading text-base font-bold uppercase tracking-wide text-night-950 transition-colors hover:bg-gold-300 active:bg-gold-600 sm:px-7 sm:text-lg"
              >
                {t("home.search.submit")}
              </button>
            </form>
            <p className="mt-2">
              <SearchAllButton label={t("home.search.all")} />
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
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
            <p className="hidden text-right text-sm text-chalk-300 lg:absolute lg:bottom-16 lg:right-[clamp(1rem,0.4rem+2.4vw,3rem)] lg:block">
              <Link href={`/heroes/${featured.hero.slug}`} className="font-heading text-lg font-bold uppercase text-chalk-100 hover:text-gold-300">
                {featured.hero.name}
              </Link>
              <span className="block">{t("home.artCaption", { skin: featured.skin })}</span>
            </p>
          )}
        </div>
      </div>

      {/* The day's state of the game, as one thin line of text: each fact links to its page. */}
      <div className="border-t border-night-800 bg-night-950">
        <h2 className="sr-only">{t("home.rail.title")}</h2>
        <ul className="page-wrap relative flex gap-x-7 overflow-x-auto whitespace-nowrap py-1 text-sm text-chalk-400 [scrollbar-width:none]">
          {facts.map(({ href, label, value }) => (
            <li key={href} className="shrink-0">
              <Link href={href} className="group inline-flex min-h-11 items-center gap-2">
                <span>{label}</span>
                <span className="font-heading text-base font-bold uppercase text-chalk-100 transition-colors group-hover:text-gold-300">
                  {value}
                </span>
              </Link>
            </li>
          ))}
          <li className="shrink-0">
            <Link href="/tools/server-time" className="group inline-flex min-h-11 items-center">
              <ServerTimeChip locale={lang} timeLabel={t("home.rail.serverTime")} resetLabel={t("home.rail.reset")} />
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
