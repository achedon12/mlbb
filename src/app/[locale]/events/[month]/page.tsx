import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreditWiki } from "@/components/credit-wiki";
import { MonthContent, SourceList, heroName, monthLabel, monthSummary, monthText } from "@/components/event-month";
import { LigneFraicheur } from "@/components/fraicheur";
import Link from "@/components/lien";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import { lienSkin } from "@/lib/catalogue-skins";
import { anneesCalendrier, donneesListeSkins } from "@/lib/catalogue-skins-serveur";
import { synchro } from "@/lib/donnees";
import { OTHER_MODES, monthStatus, neighbours } from "@/lib/events";
import { monthByKey, monthKeys, referenceDate, sourcesForMonth } from "@/lib/events-server";
import { donneesLd } from "@/lib/html";

type Params = { params: Promise<{ locale: Langue; month: string }> };

export const dynamicParams = false;

/** Only months with at least one skin get a page. */
export function generateStaticParams() {
  return monthKeys().map((month) => ({ month }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, month } = await params;
  const m = monthByKey(month);
  if (!m) return {};
  const t = creerT(locale);
  const english = monthLabel("en", m.month);
  return metaPage(locale, {
    titre: t("pages.events.month.title", { month: monthText(locale, m.month) }),
    description: t("pages.seo.eventsMonth.metaDescription", {
      month: monthText(locale, m.month),
      summary: monthSummary(t, locale, m).join(" "),
    }),
    chemin: `/events/${m.month}`,
    motsCles: [`MLBB Starlight ${english}`, `MLBB events ${english}`, `Mobile Legends skins ${english}`, "MLBB Collector skin"],
  });
}

export default async function EventMonthPage({ params }: Params) {
  const { locale, month } = await params;
  const m = monthByKey(month);
  if (!m) notFound();

  const t = creerT(locale);
  const keys = monthKeys();
  const { previous, next } = neighbours(keys, m.month);
  const status = monthStatus(m.month, referenceDate);
  const year = m.month.slice(0, 4);
  const title = t("pages.events.month.title", { month: monthText(locale, m.month) });
  const summary = monthSummary(t, locale, m);
  const link = "font-semibold text-gold-400 transition-colors hover:text-gold-500";
  const skins = [...m.starlight, ...m.collector, ...OTHER_MODES.flatMap((k) => m.others[k])];

  const structuredData = donneesListeSkins(locale, {
    nom: title,
    description: summary.join(" "),
    chemin: `/events/${m.month}`,
    elements: skins.map((s) => ({
      nom: `${s.nom} (${heroName(s.heros)})`,
      chemin: s.ancre ? lienSkin(s) : `/heroes/${s.heros}/skins`,
    })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(structuredData) }} />
      <EnTetePage
        titre={title}
        chapeau={summary.join(" ")}
        miettes={[
          { nom: t("pages.events.breadcrumb"), href: "/events" },
          {
            nom: monthLabel(locale, m.month),
            freres: keys
              .filter((k) => k.startsWith(year))
              .reverse()
              .map((k) => ({ nom: monthLabel(locale, k), href: `/events/${k}` })),
          },
        ]}
      >
        {status !== "past" && (
          <p className="mt-4">
            <span className="bevel-sm inline-block bg-gold-500 px-2 py-0.5 text-xs font-semibold text-night-950">
              {t(`pages.events.status.${status}`)}
            </span>
          </p>
        )}
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
        {status === "announced" && (
          <div className="max-w-3xl space-y-2 text-chalk-300">
            <p>{t("pages.events.month.announced")}</p>
            <SourceList sources={sourcesForMonth(m.month)} t={t} locale={locale} />
          </div>
        )}

        <MonthContent month={m} t={t} locale={locale} variant="page" />

        <nav
          aria-label={t("pages.events.month.navMonths")}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-night-800 pt-6 text-sm"
        >
          {previous ? (
            <Link href={`/events/${previous}`} rel="prev" className={link}>
              ← {monthLabel(locale, previous)}
            </Link>
          ) : (
            <span />
          )}
          <Link href="/events" className="text-chalk-300 transition-colors hover:text-gold-400">
            {t("pages.events.month.allMonths")}
          </Link>
          {next ? (
            <Link href={`/events/${next}`} rel="next" className={link}>
              {monthLabel(locale, next)} →
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <section className="space-y-3">
          <SourceList sources={sourcesForMonth(m.month)} t={t} locale={locale} />
          {anneesCalendrier().includes(Number(year)) && (
            <p className="text-sm">
              <Link href={`/skins/calendar/${year}`} className={link}>
                {t("pages.events.month.yearLink", { year })} →
              </Link>
            </p>
          )}
          <CreditWiki t={t} href={synchro.source} cle="pages.events.source" />
        </section>
      </div>
    </>
  );
}
