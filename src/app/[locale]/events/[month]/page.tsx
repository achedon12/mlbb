import type { Metadata } from "next";
import { WikiCredit } from "@/components/wiki-credit";
import { MonthContent, SourceList, heroName, monthLabel, monthSummary, monthText } from "@/components/event-month";
import { FreshnessLine } from "@/components/freshness";
import Link from "@/components/link";
import { eventArt } from "@/components/events/event-feature";
import { MonthNav } from "@/components/events/month-nav";
import { heroArt } from "@/components/hero-art";
import { ENTRANCE, PosterHeader } from "@/components/poster-header";
import { Score } from "@/components/ui";
import { UpcomingReminder, reminderMonths } from "@/components/upcoming-reminder";
import type { Locale } from "@/i18n/config";
import { metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { linkSkin } from "@/lib/skin-catalog";
import { LOCALE_INTL } from "@/i18n/config";
import { calendarYears, dataListSkins } from "@/lib/skin-catalog-server";
import { heroesBySlug, sync } from "@/lib/data";
import { HeroTile } from "@/components/hero-tile";
import { OTHER_MODES, monthStatus, neighbours } from "@/lib/events";
import { monthByKey, monthKeys, referenceDate, sourcesForMonth } from "@/lib/events-server";
import { serializeJsonLd } from "@/lib/html";
import { eventMonthData } from "@/lib/structured-data";
import { NotFoundPage } from "@/components/not-found-page";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale; month: string }> };

/**
 * Only months with at least one skin get a page. The build renders the months
 * people look for — the last past month, the current one and the announced
 * ones —; the archive, ten years of months in every language, is rendered on
 * its first request then cached until the next deploy. A month without a page
 * still falls on the 404 (`monthByKey`).
 */
export const dynamicParams = true;

export function generateStaticParams() {
  const keys = [...monthKeys()].sort();
  const firstRecent = keys.findIndex((month) => monthStatus(month, referenceDate) !== "past");
  const start = firstRecent === -1 ? keys.length - 1 : Math.max(0, firstRecent - 1);
  return keys.slice(start).map((month) => ({ month }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, month } = await params;
  const m = monthByKey(month);
  if (!m) return notFoundMetadata(locale);
  const t = createT(locale);
  const english = monthLabel("en", m.month);
  return metaPage(locale, {
    title: t("pages.events.month.title", { month: monthText(locale, m.month) }),
    description: t("pages.seo.eventsMonth.metaDescription", {
      month: monthText(locale, m.month),
      summary: monthSummary(t, locale, m).join(" "),
    }),
    path: `/events/${m.month}`,
    keywords: [`MLBB Starlight ${english}`, `MLBB events ${english}`, `Mobile Legends skins ${english}`, "MLBB Collector skin"],
  });
}

export default async function EventMonthPage({ params }: Params) {
  const { locale, month } = await params;
  const m = monthByKey(month);
  if (!m) return <NotFoundPage />;

  const t = createT(locale);
  const keys = monthKeys();
  const { previous, next } = neighbours(keys, m.month);
  const status = monthStatus(m.month, referenceDate);
  const year = m.month.slice(0, 4);
  const title = t("pages.events.month.title", { month: monthText(locale, m.month) });
  const summary = monthSummary(t, locale, m);
  const link = "font-semibold text-gold-400 transition-colors hover:text-gold-500";
  const monthArt = (key: string) => {
    const x = monthByKey(key);
    return x ? ([...x.starlight, ...x.collector].map(eventArt).find(Boolean) ?? null) : null;
  };
  const skins = [...m.starlight, ...m.collector, ...OTHER_MODES.flatMap((k) => m.others[k])];
  // The poster: the month's StarLight skin, else its first headline skin with an artwork.
  const headline = [...m.starlight, ...m.collector, ...skins];
  const art = headline.map(eventArt).find(Boolean) ?? (headline[0] ? heroArt(headline[0].hero) : null);
  const numbers = new Intl.NumberFormat(LOCALE_INTL[locale]);
  // The way on from the month, shown under its title and again at its end:
  // the pages of the heroes it features, then the calendars and the tier list.
  const featured = [...new Set(headline.map((s) => s.hero))].filter((slug) => heroesBySlug.has(slug)).slice(0, 4);
  const calendarHref = calendarYears().includes(Number(year)) ? `/skins/calendar/${year}` : "/skins/calendar";
  const chip = "bevel-sm bg-night-800/90 px-2.5 py-1 text-chalk-200 transition-colors hover:bg-night-700 hover:text-gold-300";

  const structuredData = dataListSkins(locale, {
    name: title,
    description: summary.join(" "),
    path: `/events/${m.month}`,
    elements: skins.map((s) => ({
      name: `${s.name} (${heroName(s.hero)})`,
      path: s.anchor ? linkSkin(s) : `/heroes/${s.hero}/skins`,
    })),
  });

  // The month itself as an in-game event, its StarLight pass and releases.
  const eventData = eventMonthData(locale, {
    name: title,
    description: summary.join(" "),
    path: `/events/${m.month}`,
    month: m.month,
    image: art,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(eventData) }} />
      <PosterHeader
        title={title}
        lead={summary.join(" ")}
        crumbs={[
          { name: t("pages.events.breadcrumb"), href: "/events" },
          {
            name: monthLabel(locale, m.month),
            siblings: keys
              .filter((k) => k.startsWith(year))
              .reverse()
              .map((k) => ({ name: monthLabel(locale, k), href: `/events/${k}` })),
          },
        ]}
        art={art}
        tall
        kicker={status !== "past" ? t(`pages.events.status.${status}`) : undefined}
        aside={
          <p className="flex items-end gap-3 lg:flex-col lg:items-end lg:gap-1">
            <Score value={numbers.format(m.total)} className="text-[clamp(4.5rem,2.6rem+5vw,8rem)]" />
            <span className="pb-2 text-sm text-chalk-300 lg:pb-0">
              {t(m.total === 1 ? "pages.skinsCalendar.nSkins1" : "pages.skinsCalendar.nSkins", { n: numbers.format(m.total) })}
            </span>
          </p>
        }
      >
        <FreshnessLine locale={locale} className="mt-4" />
        <nav aria-label={t("pages.events.month.next.related")} className="mt-5">
          <ul className="flex flex-wrap gap-2 text-sm">
            {featured.slice(0, 3).map((slug) => (
              <li key={slug}>
                <Link href={`/heroes/${slug}`} className={chip}>
                  {t("pages.events.month.next.heroLink", { name: heroesBySlug.get(slug)!.name })}
                </Link>
              </li>
            ))}
            <li>
              <Link href={calendarHref} className={chip}>
                {t("nav.skinsCalendar.label")}
              </Link>
            </li>
            {next && (
              <li>
                <Link href={`/events/${next}`} className={chip}>
                  {monthLabel(locale, next)} →
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </PosterHeader>

      <div className="page-wrap space-y-14 py-12">
        {status === "announced" && (
          <div className="max-w-3xl space-y-2 text-chalk-300">
            <p>{t("pages.events.month.announced")}</p>
            <SourceList sources={sourcesForMonth(m.month)} t={t} locale={locale} />
          </div>
        )}

        {reminderMonths().includes(m.month) && <UpcomingReminder locale={locale} month={m.month} />}

        <div className={ENTRANCE}>
          <MonthContent month={m} t={t} locale={locale} variant="page" />
        </div>

        {/* The month under way: the next one is what to wait for. */}
        {status === "current" && <UpcomingReminder locale={locale} />}

        <MonthNav
          label={t("pages.events.month.navMonths")}
          all={t("pages.events.month.allMonths")}
          previous={previous ? { href: `/events/${previous}`, name: monthLabel(locale, previous), art: monthArt(previous) } : null}
          next={next ? { href: `/events/${next}`, name: monthLabel(locale, next), art: monthArt(next) } : null}
        />

        <section aria-labelledby="month-next">
          <h2 id="month-next" className="type-section text-chalk-100">
            {t("pages.events.month.next.title")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          {/* The heroes of the month on one side, the other calendars on the
              other: the block fills the row instead of a lone portrait. */}
          <div className={cn("mt-6 grid gap-6", featured.length > 0 && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10")}>
            {featured.length > 0 && (
              <div>
                <h3 className="type-subtitle text-chalk-200">{t("pages.events.month.next.heroes")}</h3>
                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
                  {featured.map((slug) => {
                    const h = heroesBySlug.get(slug)!;
                    return (
                      <li key={slug}>
                        <HeroTile
                          href={`/heroes/${slug}`}
                          name={h.name}
                          portrait={h.images.portrait}
                          sizes="(min-width: 1024px) 11rem, (min-width: 640px) 22vw, 30vw"
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <ul className={cn("grid content-start gap-2.5", featured.length > 0 ? "sm:grid-cols-3 lg:mt-10 lg:grid-cols-1" : "sm:grid-cols-3")}>
              {[
                { href: "/events", label: t("pages.events.month.allMonths"), name: "events" },
                { href: calendarHref, label: t("nav.skinsCalendar.label"), name: "calendar" },
                { href: "/tier-list", label: t("nav.tierList.label"), name: "tier-list" },
              ].map((l) => (
                <li key={l.name}>
                  <Link
                    href={l.href}
                    className="bevel group flex items-center justify-between gap-3 bg-night-800 px-4 py-3.5 font-heading text-base font-bold uppercase text-chalk-100 transition-colors hover:bg-night-700 hover:text-gold-300"
                  >
                    {l.label}
                    <span aria-hidden className="text-gold-400 transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <SourceList sources={sourcesForMonth(m.month)} t={t} locale={locale} />
          {calendarYears().includes(Number(year)) && (
            <p className="text-sm">
              <Link href={`/skins/calendar/${year}`} className={link}>
                {t("pages.events.month.yearLink", { year })} →
              </Link>
            </p>
          )}
          <WikiCredit t={t} href={sync.source} messageKey="pages.events.source" />
        </section>
      </div>
    </>
  );
}
