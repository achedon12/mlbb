import type { Metadata } from "next";
import { propsCardSkin } from "@/components/skin-card";
import { WikiCredit } from "@/components/wiki-credit";
import { SkinExplorer } from "@/components/skin-explorer";
import { SkinGrid } from "@/components/skin-grid";
import { FreshnessLine } from "@/components/freshness";
import Link from "@/components/link";
import { PageHeader, SectionTitle } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage } from "@/i18n/seo";
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
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Locale }> };

const PATH = "/skins/calendar";

function description(locale: Locale): string {
  const t = createT(locale);
  const released = releasedSkins();
  const years = calendarYears();
  const last = newest(released, 1)[0];
  const heroes = catalogHeroes();
  return t("pages.seo.skinsCalendar.description", {
    n: new Intl.NumberFormat(LOCALE_HTML[locale]).format(released.length),
    debut: years.at(-1) ?? "",
    fin: years[0] ?? "",
    dernier: last ? `${last.name} (${heroes.get(last.hero)?.name ?? last.hero})` : "—",
    date: last?.release ? formatRelease(last.release, LOCALE_HTML[locale]) : "—",
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.skinsCalendar.title"),
    description: description(locale),
    path: PATH,
    keywords: ["MLBB skins", "skin release date", "Mobile Legends skins", "Collector", "StarLight", "Epic", "Legend"],
  });
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

export default async function SkinsCalendarPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const localeHtml = LOCALE_HTML[locale];
  const count = new Intl.NumberFormat(localeHtml);
  const heroes = catalogHeroes();
  const released = releasedSkins();
  const years = calendarYears();
  const groups = groupByDate(released, "recent");
  const series = seriesStats(released);

  const monthCurrent = dateReference.slice(0, 7);
  const ceMonth = released.filter((s) => s.release?.startsWith(monthCurrent));
  const recent = newest(released, 12);
  const lastMonth = recent[0]?.release?.slice(0, 7) ?? null;

  // Excluded, and counted to say so: announced skins, or dates after the measurement.
  const others = catalogSkins().skins.filter((s) => !isOrigin(s) && !released.includes(s));
  const upcomingCount = others.filter((s) => s.availability === "Upcoming").length;
  const futureCount = others.filter((s) => s.availability !== "Upcoming" && readRelease(s.release)).length;
  const accuracy = { jour: 0, mois: 0, annee: 0 };
  for (const s of released) {
    const d = readRelease(s.release)!;
    accuracy[d.day ? "jour" : d.month ? "mois" : "annee"] += 1;
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
    elements: years.map((a) => ({ name: t("pages.skinsCalendar.year.title", { annee: a }), path: `${PATH}/${a}` })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader
        title={t("pages.skinsCalendar.title")}
        lead={t("pages.skinsCalendar.lead", {
          n: count.format(released.length),
          debut: years.at(-1) ?? "",
          fin: years[0] ?? "",
        })}
        crumbs={[{ name: t("pages.skinsCalendar.crumbSkins"), href: "/skins" }, { name: t("pages.skinsCalendar.crumb") }]}
      >
        <FreshnessLine locale={locale} className="mt-4" />
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section id="ce-mois" className="scroll-mt-24">
          <SectionTitle>{t("pages.skinsCalendar.thisMonthTitle", { mois: monthYear(locale, dateReference) })}</SectionTitle>
          {ceMonth.length > 0 ? (
            grid(ceMonth)
          ) : (
            <p className="max-w-2xl leading-relaxed text-chalk-300">
              {t("pages.skinsCalendar.thisMonthEmpty", {
                mois: monthYear(locale, dateReference),
                dernier: lastMonth ? monthYear(locale, `${lastMonth}-01`) : "—",
              })}{" "}
              <a href="#derniers" className="font-semibold text-gold-400 hover:text-gold-500">
                {t("pages.skinsCalendar.seeLatest")}
              </a>
            </p>
          )}
        </section>

        <section id="derniers" className="scroll-mt-24">
          <SectionTitle lead={t("pages.skinsCalendar.latestLead")}>{t("pages.skinsCalendar.latestTitle")}</SectionTitle>
          {grid(recent)}
        </section>

        <section id="explorateur" className="scroll-mt-24">
          <SectionTitle lead={t("pages.skinsCalendar.exploreLead")}>{t("pages.skinsCalendar.exploreTitle")}</SectionTitle>
          <ExtendMessages messages={messagesPage(locale, ["pages.skinsCalendarUI"])}>
            <SkinExplorer
              heroes={[...heroes.values()].sort((a, b) => a.name.localeCompare(b.name, "en")).map((h) => [h.slug, h.name])}
              series={series.map((s) => s.series)}
              years={years}
              reference={dateReference}
            >
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[30rem] border-separate border-spacing-1 text-center text-xs">
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
                              mois: formatLong.format(Date.UTC(a.year, i, 1)),
                              n,
                            });
                            return (
                              <td key={i} className="p-0">
                                {n > 0 ? (
                                  <Link
                                    href={`${PATH}/${a.year}#m-${String(i + 1).padStart(2, "0")}`}
                                    aria-label={label}
                                    title={label}
                                    className={cn("block min-w-6 py-1.5 tabular-nums hover:outline hover:outline-gold-400", tint(n, maxMonth))}
                                  >
                                    {n}
                                  </Link>
                                ) : (
                                  <span className={cn("block min-w-6 py-1.5", tint(0, maxMonth))} aria-label={label} />
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
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {series.slice(0, 24).map((s) => {
              const start = readRelease(s.first)?.year;
              const end = readRelease(s.last)?.year;
              return (
                <li
                  key={s.series}
                  className="bevel-sm flex items-baseline justify-between gap-3 border border-night-700/60 bg-night-900/40 px-3 py-2"
                >
                  {/* Plain link: the explorer reads its filters from the address on load. */}
                  <a
                    href={`?serie=${encodeURIComponent(s.series)}#explorateur`}
                    className="truncate font-semibold text-chalk-100 hover:text-gold-400"
                  >
                    {seriesLabel(t, s.series)}
                  </a>
                  <span className="shrink-0 text-xs tabular-nums text-chalk-500">
                    {t("pages.skinsCalendar.seriesDetail", {
                      n: nSkins(s.total),
                      periode: start && end && start !== end ? `${start}–${end}` : String(start ?? end ?? "—"),
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="dates" className="scroll-mt-24">
          <SectionTitle>{t("pages.skinsCalendar.datesTitle")}</SectionTitle>
          <div className="max-w-3xl space-y-3 leading-relaxed text-chalk-300">
            <p>
              {t("pages.skinsCalendar.datesPrecision", {
                jour: count.format(accuracy.jour),
                mois: count.format(accuracy.mois),
                annee: count.format(accuracy.annee),
              })}
            </p>
            {upcomingCount + futureCount > 0 && (
              <p>{t("pages.skinsCalendar.datesSkipped", { aVenir: count.format(upcomingCount), futurs: count.format(futureCount) })}</p>
            )}
            <p>{t("pages.skinsCalendar.datesOrigin")}</p>
            <p>
              <Link href="/tools/collection" className="font-semibold text-gold-400 hover:text-gold-500">
                {t("pages.skinsCalendar.collectionLink")} →
              </Link>
            </p>
          </div>
          <WikiCredit t={t} href={sync.source} messageKey="pages.skinsCalendar.source" />
        </section>
      </div>
    </>
  );
}
