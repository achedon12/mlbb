import type { Metadata } from "next";
import { OpenAnchor } from "@/components/open-anchor";
import { propsCardSkin } from "@/components/skin-card";
import { WikiCredit } from "@/components/wiki-credit";
import { SkinExplorer } from "@/components/skin-explorer";
import { SkinGrid } from "@/components/skin-grid";
import { FreshnessLine } from "@/components/freshness";
import Link from "@/components/link";
import { Pager } from "@/components/pager";
import { Foldable } from "@/components/foldable";
import { Score, SectionTitle } from "@/components/ui";
import { heroArt, skinArt } from "@/components/hero-art";
import { DexSays } from "@/components/mascot";
import { ENTRANCE, PosterHeader } from "@/components/poster-header";
import { RarityGem, SkinArtTile } from "@/components/skins/skin-tile";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage, metaPaged } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import {
  isOrigin,
  groupByDate,
  seriesLabel,
  readRelease,
  newest,
  seriesStats,
  type SkinCatalog,
} from "@/lib/skin-catalog";
import {
  calendarYears,
  catalogSkins,
  dateReference,
  dataListSkins,
  catalogHeroes,
  releasedSkins,
} from "@/lib/skin-catalog-server";
import { sync } from "@/lib/data";
import { formatRelease } from "@/lib/skins";
import { monthYear } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { pageCount, pageHref, paging, slicePage } from "@/lib/pager";
import { cn } from "@/lib/utils";

/** Series listed per page: twelve fill one screen of a phone. */
export const SERIES_BY_PAGE = 12;
/** Series shown at all: beyond that the explorer is the way in. */
export const SERIES_LISTED = 24;

/** How many pages the series list holds, for the routes to prerender them. */
export const pagesCalendar = () => pageCount(SERIES_LISTED, SERIES_BY_PAGE);

const PATH = "/skins/calendar";
/** Up to this many skins, the month's own are shown as full artworks. */
const MONTH_POSTERS = 3;

function description(locale: Locale): string {
  const t = createT(locale);
  const released = releasedSkins();
  const years = calendarYears();
  const last = newest(released, 1)[0];
  const heroes = catalogHeroes();
  return t("pages.seo.skinsCalendar.description", {
    n: new Intl.NumberFormat(LOCALE_INTL[locale]).format(released.length),
    start: years.at(-1) ?? "",
    end: years[0] ?? "",
    latest: last ? `${last.name} (${heroes.get(last.hero)?.name ?? last.hero})` : "—",
    date: last?.release ? formatRelease(last.release, LOCALE_INTL[locale]) : "—",
  });
}

export function metaCalendar(locale: Locale, page = 1): Metadata {
  const t = createT(locale);
  return metaPaged(
    metaPage(locale, {
      title: t("pages.seo.skinsCalendar.title"),
      description: description(locale),
      path: PATH,
      keywords: ["MLBB skins", "skin release date", "Mobile Legends skins", "Collector", "StarLight", "Epic", "Legend"],
    }),
    locale,
    PATH,
    page,
  );
}

/** Intensity of a calendar cell, relative to the busiest month. */
function tint(n: number, max: number): string {
  if (n === 0) return "bg-night-900/40 text-chalk-600";
  const part = n / max;
  if (part <= 0.25) return "bg-gold-500/15 text-chalk-200";
  if (part <= 0.5) return "bg-gold-500/30 text-chalk-100";
  if (part <= 0.75) return "bg-gold-500/55 text-chalk-100";
  return "bg-gold-500/85 text-night-950";
}

export function SkinsCalendar({ locale, page = 1 }: { locale: Locale; page?: number }) {
  const t = createT(locale);
  const localeHtml = LOCALE_INTL[locale];
  const count = new Intl.NumberFormat(localeHtml);
  const heroes = catalogHeroes();
  const released = releasedSkins();
  const years = calendarYears();
  const groups = groupByDate(released, "recent");
  const series = seriesStats(released);

  const monthCurrent = dateReference.slice(0, 7);
  const ceMonth = released.filter((s) => s.release?.startsWith(monthCurrent));
  const recent = newest(released, 12);
  const seriesListed = series.slice(0, SERIES_LISTED);
  const viewSeries = paging(seriesListed.length, page, SERIES_BY_PAGE);
  const seriesPage = slicePage(seriesListed, viewSeries.page, SERIES_BY_PAGE);
  const lastMonth = recent[0]?.release?.slice(0, 7) ?? null;
  // The poster: the latest artworks as slanted panels.
  const poster = recent.flatMap((s) => skinArt(s.hero, s.name) ?? []).slice(0, 5);
  // Each series shows the artwork of its most recent skin that has one.
  const seriesArt = new Map<string, string>();
  for (const s of newest(released, released.length)) {
    if (!s.series || seriesArt.has(s.series)) continue;
    const art = skinArt(s.hero, s.name);
    if (art) seriesArt.set(s.series, art);
  }
  // A series none of whose skins has its own artwork shows its hero's.
  for (const s of released) {
    if (!s.series || seriesArt.has(s.series)) continue;
    const art = heroArt(s.hero);
    if (art) seriesArt.set(s.series, art);
  }

  // Excluded, and counted to say so: announced skins, or dates after the measurement.
  const others = catalogSkins().skins.filter((s) => !isOrigin(s) && !released.includes(s));
  const upcomingCount = others.filter((s) => s.availability === "Upcoming").length;
  const futureCount = others.filter((s) => s.availability !== "Upcoming" && readRelease(s.release)).length;
  const accuracy = { day: 0, month: 0, year: 0 };
  for (const s of released) {
    const d = readRelease(s.release)!;
    accuracy[d.day ? "day" : d.month ? "month" : "year"] += 1;
  }

  const formatCourt = new Intl.DateTimeFormat(localeHtml, { month: "short", timeZone: "UTC" });
  const formatLong = new Intl.DateTimeFormat(localeHtml, { month: "long", year: "numeric", timeZone: "UTC" });
  const maxMonth = Math.max(1, ...groups.flatMap((a) => a.month.filter((m) => m.month).map((m) => m.skins.length)));

  const nSkins = (n: number) =>
    t(n === 1 ? "pages.skinsCalendar.nSkins1" : "pages.skinsCalendar.nSkins", { n: count.format(n) });

  const grid = (list: SkinCatalog[]) => (
    <SkinGrid cards={list.map((s) => propsCardSkin(s, heroes.get(s.hero)?.name ?? s.hero, t, localeHtml, count))} />
  );

  const structuredData = dataListSkins(locale, {
    name: t("pages.skinsCalendar.title"),
    description: description(locale),
    path: PATH,
    elements: years.map((a) => ({ name: t("pages.skinsCalendar.year.title", { year: a }), path: `${PATH}/${a}` })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PosterHeader
        title={t("pages.skinsCalendar.title")}
        art={poster}
        tall
        lead={t("pages.skinsCalendar.lead", {
          n: count.format(released.length),
          start: years.at(-1) ?? "",
          end: years[0] ?? "",
        })}
        crumbs={[{ name: t("pages.skinsCalendar.crumbSkins"), href: "/skins" }, { name: t("pages.skinsCalendar.crumb") }]}
      >
        <FreshnessLine locale={locale} className="mt-4" />
      </PosterHeader>

      {/* Section anchors before they were named in English, still found in shared links. */}
      <OpenAnchor aliases={{ "ce-mois": "this-month", derniers: "latest", explorateur: "explorer" }} />
      <div className="page-wrap space-y-12 pb-10 pt-8 sm:space-y-20 sm:pt-12">
        <section id="this-month" className={`scroll-mt-24 ${ENTRANCE}`}>
          <SectionTitle>{t("pages.skinsCalendar.thisMonthTitle", { month: monthYear(locale, dateReference) })}</SectionTitle>
          {ceMonth.length > 0 && ceMonth.length <= MONTH_POSTERS ? (
            // A short month gets its artworks in full, not a row of thumbnails.
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ceMonth.map((s) => {
                const art = skinArt(s.hero, s.name);
                const card = propsCardSkin(s, heroes.get(s.hero)?.name ?? s.hero, t, localeHtml, count);
                return (
                  <li key={s.id} className={ceMonth.length === 1 ? "sm:col-span-2" : undefined}>
                    <SkinArtTile
                      href={card.href}
                      art={art ?? s.image}
                      position={art ? "50% 25%" : "50% 15%"}
                      name={s.name}
                      color={card.color}
                      priority
                      kicker={
                        <>
                          <RarityGem color={card.color} />
                          {card.hero} · {card.rarity}
                        </>
                      }
                    >
                      {card.details.length > 0 && <span className="mt-1 block truncate text-xs text-chalk-300">{card.details.join(" · ")}</span>}
                    </SkinArtTile>
                  </li>
                );
              })}
            </ul>
          ) : ceMonth.length > 0 ? (
            grid(ceMonth)
          ) : (
            <DexSays pose="dodo" height={110}>
              <p className="leading-relaxed text-chalk-200">
                {t("pages.skinsCalendar.thisMonthEmpty", {
                  month: monthYear(locale, dateReference),
                  latest: lastMonth ? monthYear(locale, `${lastMonth}-01`) : "—",
                })}{" "}
                <a href="#latest" className="font-semibold text-gold-400 hover:text-gold-500">
                  {t("pages.skinsCalendar.seeLatest")}
                </a>
              </p>
            </DexSays>
          )}
        </section>

        <section id="latest" className="scroll-mt-24">
          <SectionTitle lead={t("pages.skinsCalendar.latestLead")}>{t("pages.skinsCalendar.latestTitle")}</SectionTitle>
          {grid(recent)}
        </section>

        <section id="explorer" className="scroll-mt-24">
          <SectionTitle lead={t("pages.skinsCalendar.exploreLead")}>{t("pages.skinsCalendar.exploreTitle")}</SectionTitle>
          <ExtendMessages messages={messagesPage(locale, ["pages.skinsCalendarUI"])}>
            <SkinExplorer
              heroes={[...heroes.values()].sort((a, b) => a.name.localeCompare(b.name, "en")).map((h) => [h.slug, h.name])}
              series={series.map((s) => s.series)}
              years={years}
              reference={dateReference}
            >
              {/*
                Fourteen columns of counts: the grid used to sit in a
                horizontal scroller a phone had to drag. Cells reserve no
                width of their own and the spacing tightens below `sm`, so
                the heat map fits 390 px — it stays a grid, where a card per
                year would lose the very thing it shows.
              */}
              <div className="relative">
                <table className="w-full border-separate border-spacing-[2px] text-center text-[0.65rem] sm:min-w-[30rem] sm:border-spacing-1 sm:text-xs">
                  <caption className="mb-2 text-left text-sm text-chalk-500">{t("pages.skinsCalendar.tableLegend")}</caption>
                  <thead>
                    <tr className="text-chalk-500">
                      <th scope="col" className="text-left font-medium">
                        {t("pages.skinsCalendar.colYear")}
                      </th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} scope="col" className="font-medium">
                          <abbr title={formatLong.format(Date.UTC(2024, i, 1)).replace(/\s*\d{4}.*$/, "")} className="no-underline">
                            {formatCourt.format(Date.UTC(2024, i, 1)).replace(".", "")}
                          </abbr>
                        </th>
                      ))}
                      <th scope="col" className="font-medium">
                        <abbr title={t("pages.skinsCalendar.unknownMonth")} className="no-underline">
                          ?
                        </abbr>
                      </th>
                      <th scope="col" className="font-medium">
                        {t("pages.skinsCalendar.colTotal")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((a) => {
                      const byMonth = new Map(a.month.map((m) => [m.month, m.skins.length]));
                      return (
                        <tr key={a.year}>
                          <th scope="row" className="pr-1 text-left">
                            <Link href={`${PATH}/${a.year}`} className="font-heading text-sm font-bold text-chalk-100 hover:text-gold-400">
                              {a.year}
                            </Link>
                          </th>
                          {Array.from({ length: 12 }, (_, i) => {
                            const n = byMonth.get(i + 1) ?? 0;
                            const label = t("pages.skinsCalendar.monthCell", {
                              month: formatLong.format(Date.UTC(a.year, i, 1)),
                              n,
                            });
                            return (
                              <td key={i} className="p-0">
                                {n > 0 ? (
                                  <Link
                                    href={`${PATH}/${a.year}#m-${String(i + 1).padStart(2, "0")}`}
                                    aria-label={label}
                                    title={label}
                                    className={cn("bevel-sm block py-1.5 tabular-nums transition-[background-color,color] hover:bg-gold-300 hover:text-night-950 sm:min-w-6", tint(n, maxMonth))}
                                  >
                                    {n}
                                  </Link>
                                ) : (
                                  <span className={cn("bevel-sm block py-1.5 sm:min-w-6", tint(0, maxMonth))} aria-label={label} />
                                )}
                              </td>
                            );
                          })}
                          <td className="py-1.5 tabular-nums text-chalk-400">{byMonth.get(null) || ""}</td>
                          <td className="py-1.5 font-semibold tabular-nums text-chalk-100">{count.format(a.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SkinExplorer>
          </ExtendMessages>
        </section>

        <section id="series" className="scroll-mt-24">
          <SectionTitle lead={t("pages.skinsCalendar.seriesLead")}>{t("pages.skinsCalendar.seriesTitle")}</SectionTitle>
          <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {seriesPage.map((s) => {
              const start = readRelease(s.first)?.year;
              const end = readRelease(s.last)?.year;
              return (
                <li key={s.series}>
                  {/* Plain link: the explorer reads its filters from the address on load. */}
                  <SkinArtTile
                    plain
                    href={`?serie=${encodeURIComponent(s.series)}#explorer`}
                    art={seriesArt.get(s.series) ?? null}
                    name={seriesLabel(t, s.series)}
                    aspect="aspect-[4/3] sm:aspect-[16/8]"
                    nameClassName="text-[clamp(1.3rem,0.9rem+1.4vw,2.25rem)]"
                    sizes="(min-width: 1024px) 24vw, 48vw"
                    figure={<Score value={count.format(s.total)} className="text-[1.9rem] sm:text-[2.6rem]" />}
                  >
                    <span className="mt-1 block text-xs tabular-nums text-chalk-300">
                      {t("pages.skinsCalendar.seriesDetail", {
                        n: nSkins(s.total),
                        period: start && end && start !== end ? `${start}–${end}` : String(start ?? end ?? "—"),
                      })}
                    </span>
                  </SkinArtTile>
                </li>
              );
            })}
          </ul>
          <Pager paging={viewSeries} href={(n) => pageHref(PATH, null, n)} t={t} className="justify-start" />
        </section>

        <section id="dates" className="scroll-mt-24">
          {/* How reliable the dates are: the check behind the calendar, folded. */}
          <Foldable label={t("pages.skinsCalendar.datesTitle")}>
          <div className="max-w-3xl space-y-3 leading-relaxed text-chalk-300">
            <p>
              {t("pages.skinsCalendar.datesPrecision", {
                day: count.format(accuracy.day),
                month: count.format(accuracy.month),
                year: count.format(accuracy.year),
              })}
            </p>
            {upcomingCount + futureCount > 0 && (
              <p>{t("pages.skinsCalendar.datesSkipped", { upcoming: count.format(upcomingCount), future: count.format(futureCount) })}</p>
            )}
            <p>{t("pages.skinsCalendar.datesOrigin")}</p>
            <p>
              <Link href="/tools/collection" className="font-semibold text-gold-400 hover:text-gold-500">
                {t("pages.skinsCalendar.collectionLink")} →
              </Link>
            </p>
          </div>
          <WikiCredit t={t} href={sync.source} messageKey="pages.skinsCalendar.source" className="mt-4" />
          </Foldable>
        </section>
      </div>
    </>
  );
}
