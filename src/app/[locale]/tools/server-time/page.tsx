import type { Metadata } from "next";
import { ServerClock } from "@/components/server-clock";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import { Foldable } from "@/components/foldable";
import type { Locale } from "@/i18n/config";
import { dataTool, metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { patchDetails } from "@/lib/data";
import { serializeJsonLd } from "@/lib/html";
import { SERVER_OFFSET_MIN, TIME_RESET, TIME_SOURCES, endsOfSeason } from "@/lib/server-time";

type Params = { params: Promise<{ locale: Locale }> };

const PATH = "/tools/server-time";

/** Season ends announced in the synced patch notes; the component keeps the upcoming one. */
const ENDS = endsOfSeason(Object.values(patchDetails));

/**
 * Reference country of the FAQ examples, per language: their local reset
 * time, summer and winter alike, is computed from the server's time zone.
 */
const TIMEZONE_EXAMPLE: Record<Locale, string> = {
  fr: "Europe/Paris",
  en: "Europe/London",
  it: "Europe/Rome",
  es: "Europe/Madrid",
  id: "Asia/Jakarta",
};

/** The server's "wall clock" time converted into a time zone, at a given date. */
function serverTimeIn(locale: Locale, time: number, timezone: string, month = 0) {
  const instant = Date.UTC(2026, month, 5, time) - SERVER_OFFSET_MIN * 60_000;
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).format(
    instant,
  );
}

const instantRender = () => Date.now();

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.serverTime.title"),
    description: t("pages.seo.serverTime.description", { utc: serverTimeIn(locale, TIME_RESET, "UTC") }),
    path: PATH,
    keywords: ["server time", "daily reset", "weekly reset", "reset time", "Starlight", "Mobile Legends", "MLBB"],
  });
}

export default async function ServerTimePage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const utc = serverTimeIn(locale, TIME_RESET, "UTC");
  const example = TIMEZONE_EXAMPLE[locale];
  const announcement = ENDS.at(-1);
  const structuredData = dataTool(locale, {
    name: t("pages.serverTime.title"),
    description: t("pages.seo.serverTime.description", { utc }),
    path: PATH,
    category: "UtilitiesApplication",
  });

  const rules = [
    { title: t("pages.serverTime.timezoneTitle"), text: t("pages.serverTime.timezoneText") },
    { title: t("pages.serverTime.dailyTitle"), text: t("pages.serverTime.dailyText", { utc }) },
    { title: t("pages.serverTime.weeklyTitle"), text: t("pages.serverTime.weeklyText", { utc }) },
    { title: t("pages.serverTime.starlightTitle"), text: t("pages.serverTime.starlightText", { utc }) },
    { title: t("pages.serverTime.seasonTitle"), text: t("pages.serverTime.seasonText") },
    {
      title: t("pages.serverTime.updateTitle"),
      text: t("pages.serverTime.updateText", {
        start: serverTimeIn(locale, 18, "UTC"),
        end: serverTimeIn(locale, 22, "UTC"),
      }),
    },
  ];

  const faq = [
    {
      q: t("pages.serverTime.faq1q"),
      r: t("pages.serverTime.faq1a", {
        utc,
        summer: serverTimeIn(locale, TIME_RESET, example, 6),
        winter: serverTimeIn(locale, TIME_RESET, example, 0),
        manila: serverTimeIn(locale, TIME_RESET, "Asia/Manila"),
      }),
    },
    { q: t("pages.serverTime.faq2q"), r: t("pages.serverTime.faq2a") },
    { q: t("pages.serverTime.faq3q"), r: t("pages.serverTime.faq3a") },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader title={t("pages.serverTime.title")} lead={t("pages.serverTime.lead", { utc })} />
      <div className="mx-auto max-w-4xl space-y-8 px-4 pb-10 pt-6 sm:space-y-14">
        <ServerClock reference={instantRender()} ends={ENDS} />

        <Foldable label={t("common.method")}>
          <div className="space-y-10">
            <section aria-labelledby="rules-title">
              <h2 id="rules-title" className="font-heading text-xl font-bold text-chalk-100 sm:text-2xl">
                {t("pages.serverTime.rulesTitle")}
              </h2>
              <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {rules.map((r) => (
                  <div key={r.title} className="bevel-sm border border-night-700/70 bg-night-900/60 p-4">
                    <dt className="font-heading font-bold text-gold-400">{r.title}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-chalk-300">{r.text}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="faq-title">
              <h2 id="faq-title" className="font-heading text-xl font-bold text-chalk-100 sm:text-2xl">
                {t("pages.serverTime.faqTitle")}
              </h2>
              <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
              <div className="mt-5 space-y-6">
                {faq.map((e) => (
                  <div key={e.q}>
                    <h3 className="font-heading text-lg font-bold text-chalk-100">{e.q}</h3>
                    <p className="mt-1 leading-relaxed text-chalk-300">{e.r}</p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm">
                <Link href="/ranks" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
                  {t("pages.serverTime.ranksLink")} →
                </Link>
              </p>
            </section>

            <section aria-labelledby="sources-title" className="text-sm text-chalk-500">
              <h2 id="sources-title" className="font-semibold text-chalk-300">{t("pages.serverTime.sourcesTitle")}</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <a href={TIME_SOURCES.server} rel="noopener" className="underline transition-colors hover:text-gold-400">
                    {t("pages.serverTime.sourceServer")}
                  </a>
                </li>
                <li>
                  <a href={TIME_SOURCES.starlight} rel="noopener" className="underline transition-colors hover:text-gold-400">
                    {t("pages.serverTime.sourceStarlight")}
                  </a>
                </li>
                {announcement && (
                  <li>
                    <a href={announcement.link} rel="noopener" className="underline transition-colors hover:text-gold-400">
                      {t("pages.serverTime.sourcePatch", { v: announcement.patch, n: announcement.season })}
                    </a>
                  </li>
                )}
              </ul>
            </section>
          </div>
        </Foldable>
      </div>
    </>
  );
}
