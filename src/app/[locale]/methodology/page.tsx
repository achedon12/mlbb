import type { Metadata } from "next";
import { heroArt, StageHeader } from "@/components/stage";
import { Prose } from "@/components/prose";
import type { Locale } from "@/i18n/config";
import { LOCALES } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { sync } from "@/lib/data";
import { historyStart } from "@/lib/evolution";
import { dateMeasure, longDate } from "@/lib/freshness";
import { SOURCE_HOMES } from "@/lib/page-sources";
import { legal, site } from "@/lib/site";
import { GAP_FRAGILE, THRESHOLD_RELIABILITY, TIERS, WEIGHT_BAN } from "@/lib/tier-list";
import { DAYS_IMPACT, MEASURES_MIN_IMPACT, THRESHOLD_IMPACT, THRESHOLD_NOTABLE } from "@/lib/trends";
import { DAILY_DAYS } from "../../../../scripts/measures.mjs";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("editorial.methodology.title"),
    description: t("editorial.methodology.metaDescription"),
    path: "/methodology",
  });
}

/**
 * « Méthode et sources »: where each piece of data comes from, what the site
 * computes itself and with which thresholds, what is translated by a machine,
 * and how to report an error. The rules are not copied into the text: every
 * figure is the constant the code uses (`tier-list.ts`, `trends.ts`,
 * `scripts/measures.mjs`), passed as a variable, so the page cannot drift
 * from the computation.
 */
export default async function MethodologyPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const bound = (tier: string) => number.format(TIERS.find(([x]) => x === tier)?.[1] ?? 0);
  const start = historyStart();

  return (
    <>
      <StageHeader
        compact
        title={t("editorial.methodology.title")}
        lead={t("editorial.methodology.lead")}
        art={heroArt("yve")}
        artPosition="55% 22%"
      />
      <Prose
        locale={locale}
        messageKey="methodology"
        variables={{
          // Keys are the {placeholders} of the catalogue text.
          fandom: SOURCE_HOMES.fandom,
          liquipedia: SOURCE_HOMES.liquipedia,
          stats: SOURCE_HOMES.stats,
          issues: `${site.repository}/issues`,
          contact: legal.contact,
          synced: longDate(locale, sync.date),
          measured: longDate(locale, dateMeasure),
          historyStart: start ? longDate(locale, start) : "—",
          dailyDays: String(DAILY_DAYS),
          weightBan: number.format(WEIGHT_BAN),
          tierSPlus: bound("S+"),
          tierS: bound("S"),
          tierA: bound("A"),
          tierB: bound("B"),
          reliability: number.format(THRESHOLD_RELIABILITY),
          gapFragile: number.format(GAP_FRAGILE),
          notable: number.format(THRESHOLD_NOTABLE),
          daysImpact: String(DAYS_IMPACT),
          minImpact: String(MEASURES_MIN_IMPACT),
          thresholdImpact: number.format(THRESHOLD_IMPACT),
          languages: String(LOCALES.length),
          others: String(LOCALES.length - 1),
        }}
      />
    </>
  );
}
