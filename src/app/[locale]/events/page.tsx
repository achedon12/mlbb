import type { Metadata } from "next";
import { CreditWiki } from "@/components/credit-wiki";
import { MonthContent, SourceList, heroName, monthLabel, monthText } from "@/components/event-month";
import { LigneFraicheur } from "@/components/fraicheur";
import Link from "@/components/lien";
import { Carte, EnTetePage, TitreSection } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import { donneesListeSkins } from "@/lib/catalogue-skins-serveur";
import { synchro } from "@/lib/donnees";
import { shiftMonth, type EventMonth, type MonthStatus } from "@/lib/events";
import { eventMonths, eventSources, monthByKey, referenceDate, sourcesForMonth } from "@/lib/events-server";
import { donneesLd } from "@/lib/html";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Langue }> };

const PATH = "/events";
/** Months detailed in the timeline; older ones stay one click away, in the index. */
const TIMELINE_MONTHS = 12;

const currentMonth = referenceDate.slice(0, 7);

function description(locale: Langue): string {
  const t = creerT(locale);
  const all = eventMonths();
  const latest = all.find((m) => m.month <= currentMonth && m.starlight.length > 0);
  const s = latest?.starlight[0];
  return t("pages.seo.events.description", {
    n: all.length,
    start: all.length ? monthText(locale, all.at(-1)!.month) : "—",
    end: all.length ? monthText(locale, all[0].month) : "—",
    latest: s
      ? `${t("pages.events.skinOf", { skin: s.nom, hero: heroName(s.heros) })}, ${monthText(locale, latest!.month)}`
      : "—",
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.events.title"),
    description: description(locale),
    chemin: PATH,
    motsCles: ["MLBB events", "MLBB Starlight", "Starlight skin this month", "MLBB Collector skin", "Grand Collection", "Mobile Legends"],
  });
}

export default async function EventsPage({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const htmlLang = LOCALE_HTML[locale];
  const numbers = new Intl.NumberFormat(htmlLang);
  const all = eventMonths();
  const nextMonth = shiftMonth(currentMonth, 1);
  const thisMonth = monthByKey(currentMonth);
  const announced = all.filter((m) => m.month > currentMonth).reverse();
  const past = all.filter((m) => m.month < currentMonth);
  const timeline = past.slice(0, TIMELINE_MONTHS);
  const latest = past[0];
  const link = "font-semibold text-or-400 transition-colors hover:text-or-500";
  const externalLink = "font-semibold text-or-400 hover:underline";
  const skinCount = (n: number) =>
    t(n === 1 ? "pages.calendrierSkins.nSkins1" : "pages.calendrierSkins.nSkins", { n: numbers.format(n) });

  const byYear = new Map<string, EventMonth[]>();
  for (const m of all) byYear.set(m.month.slice(0, 4), [...(byYear.get(m.month.slice(0, 4)) ?? []), m]);
  const monthFormat = new Intl.DateTimeFormat(htmlLang, { month: "long", timeZone: "UTC" });
  const monthOnly = (month: string) => {
    const text = monthFormat.format(new Date(`${month}-01T00:00:00Z`));
    return text.charAt(0).toLocaleUpperCase(htmlLang) + text.slice(1);
  };

  const badge = (status: MonthStatus) =>
    status !== "past" && (
      <span className="biseau-sm inline-block bg-or-500 px-2 py-0.5 text-xs font-semibold text-nuit-950">
        {t(`pages.events.status.${status}`)}
      </span>
    );

  const monthBlock = (m: EventMonth, status: MonthStatus) => (
    <Carte className={cn(status !== "past" && "border-or-500/60")}>
      <article aria-labelledby={`m-${m.month}`}>
        <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h3 id={`m-${m.month}`} className="font-titre text-xl font-bold text-craie-100 sm:text-2xl">
            <Link href={`${PATH}/${m.month}`} className="transition-colors hover:text-or-400">
              {monthLabel(locale, m.month)}
            </Link>
          </h3>
          {badge(status)}
          <span className="text-sm text-craie-500">{skinCount(m.total)}</span>
        </header>
        <MonthContent month={m} t={t} locale={locale} variant="timeline" />
        <p className="mt-6 text-sm">
          <Link href={`${PATH}/${m.month}`} className={link}>
            {t("pages.events.monthDetails", { month: monthText(locale, m.month) })} →
          </Link>
        </p>
      </article>
    </Carte>
  );

  const structuredData = donneesListeSkins(locale, {
    nom: t("pages.events.title"),
    description: description(locale),
    chemin: PATH,
    elements: all.map((m) => ({
      nom: t("pages.events.month.title", { month: monthText(locale, m.month) }),
      chemin: `${PATH}/${m.month}`,
    })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(structuredData) }} />
      <EnTetePage
        titre={t("pages.events.title")}
        chapeau={t("pages.events.lead", {
          n: numbers.format(all.length),
          start: all.length ? monthText(locale, all.at(-1)!.month) : "—",
          end: all.length ? monthText(locale, all[0].month) : "—",
        })}
        miettes={[{ nom: t("pages.events.breadcrumb") }]}
      >
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section id="this-month" className="scroll-mt-24">
          <TitreSection>{t("pages.events.thisMonthTitle", { month: monthText(locale, currentMonth) })}</TitreSection>
          <Carte className="border-or-500/60">
            <div className="mb-6">{badge("current")}</div>
            {thisMonth ? (
              <MonthContent month={thisMonth} t={t} locale={locale} variant="timeline" />
            ) : (
              <p className="max-w-2xl leading-relaxed text-craie-300">
                {t("pages.events.thisMonthEmpty", {
                  month: monthText(locale, currentMonth),
                  latest: latest ? monthText(locale, latest.month) : "—",
                })}{" "}
                {latest && (
                  <Link href={`${PATH}/${latest.month}`} className={link}>
                    {t("pages.events.seeMonth", { month: monthText(locale, latest.month) })} →
                  </Link>
                )}
              </p>
            )}
            <h3 className="mt-8 font-titre text-lg font-semibold text-craie-100">{t("pages.events.everyMonthTitle")}</h3>
            <ul className="mt-3 list-disc space-y-3 pl-5 leading-relaxed text-craie-300 marker:text-or-400">
              <li>
                {t("pages.events.ruleStarlight")}{" "}
                <a
                  href={eventSources.starlight.url}
                  rel="noreferrer nofollow"
                  target="_blank"
                  className={cn(externalLink, "text-sm")}
                >
                  {t("pages.events.sourcePage", { page: eventSources.starlight.title })}
                </a>{" "}
                ·{" "}
                <Link href="/tools/server-time" className={cn(link, "text-sm")}>
                  {t("pages.events.serverTimeLink")} →
                </Link>
              </li>
              <li>
                {t("pages.events.ruleCollector")}{" "}
                <a
                  href={eventSources.collector.url}
                  rel="noreferrer nofollow"
                  target="_blank"
                  className={cn(externalLink, "text-sm")}
                >
                  {t("pages.events.sourcePage", { page: eventSources.collector.title })}
                </a>
              </li>
            </ul>
          </Carte>
        </section>

        <section id="upcoming" className="scroll-mt-24">
          <TitreSection>
            {announced.length > 0
              ? t("pages.events.upcomingTitle")
              : t("pages.events.nextMonthTitle", { month: monthText(locale, nextMonth) })}
          </TitreSection>
          {announced.length > 0 ? (
            <ol className="space-y-6">
              {announced.map((m) => (
                <li key={m.month} className="space-y-3">
                  {monthBlock(m, "announced")}
                  <p className="max-w-3xl text-sm text-craie-400">{t("pages.events.month.announced")}</p>
                  <SourceList sources={sourcesForMonth(m.month)} t={t} locale={locale} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="max-w-2xl leading-relaxed text-craie-300">
              {t("pages.events.nextMonthUnknown", { month: monthText(locale, nextMonth) })}
            </p>
          )}
        </section>

        {timeline.length > 0 && (
          <section id="recent-months" className="scroll-mt-24">
            <TitreSection chapeau={t("pages.events.recentLead", { n: timeline.length })}>
              {t("pages.events.recentTitle")}
            </TitreSection>
            <ol className="space-y-6">
              {timeline.map((m) => (
                <li key={m.month}>{monthBlock(m, "past")}</li>
              ))}
            </ol>
          </section>
        )}

        <section id="all-months" className="scroll-mt-24">
          <TitreSection chapeau={t("pages.events.allMonthsLead")}>{t("pages.events.allMonthsTitle")}</TitreSection>
          <div className="space-y-5">
            {[...byYear].map(([year, months]) => (
              <div key={year} className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
                <h3 className="w-14 shrink-0 font-titre text-lg font-bold text-craie-100">{year}</h3>
                <ul className="flex flex-wrap gap-2">
                  {[...months].reverse().map((m) => (
                    <li key={m.month}>
                      <Link
                        href={`${PATH}/${m.month}`}
                        title={t("pages.calendrierSkins.caseMois", { mois: monthText(locale, m.month), n: m.total })}
                        className={cn(
                          "biseau-sm inline-block border px-2.5 py-1 text-xs transition-colors hover:border-or-500/60 hover:text-or-400",
                          m.month === currentMonth ? "border-or-500/60 text-or-400" : "border-nuit-700 text-craie-300",
                        )}
                      >
                        {monthOnly(m.month)} <span className="text-craie-500">· {m.total}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="sources" className="scroll-mt-24">
          <TitreSection>{t("pages.events.aboutTitle")}</TitreSection>
          <div className="max-w-3xl space-y-3 leading-relaxed text-craie-300">
            <p>{t("pages.events.aboutLists")}</p>
            <SourceList sources={[eventSources.starlight, eventSources.collector]} t={t} locale={locale} />
            <p>{t("pages.events.aboutCatalogue")}</p>
            <p>{t("pages.events.aboutLeaks")}</p>
            <p>
              <Link href="/skins/calendar" className={link}>
                {t("pages.events.calendarLink")} →
              </Link>
            </p>
          </div>
          <CreditWiki t={t} href={synchro.source} cle="pages.events.source" />
        </section>
      </div>
    </>
  );
}
