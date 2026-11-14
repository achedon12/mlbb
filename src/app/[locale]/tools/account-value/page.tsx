import type { Metadata } from "next";
import { AccountValueEstimator } from "@/components/account-value-estimator";
import { FreshnessLine } from "@/components/freshness";
import Link from "@/components/link";
import { PageHeader, SectionTitle } from "@/components/ui";
import assumptionsData from "@/data/editorial/account-value.json";
import { emblems } from "@/data/emblems";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { dataTool, metaPage } from "@/i18n/seo";
import { createT, messagesPage, type T } from "@/i18n/translations";
import { CURRENCIES, RANKS, modelOf, type Assumptions } from "@/lib/account-value";
import { skinsCollectible } from "@/lib/collection";
import { serializeJsonLd } from "@/lib/html";
import { catalogSkins } from "@/lib/skin-catalog-server";

type Params = { params: Promise<{ locale: Locale }> };

const PATH = "/tools/account-value";

const ASSUMPTIONS = assumptionsData as Assumptions;
/** Tier costs, from the synced catalogue: rebuilt with it at every sync. */
const MODEL = (() => {
  const c = catalogSkins();
  return modelOf(skinsCollectible(c), c.heroes.length, emblems.length, ASSUMPTIONS);
})();

const description = (t: T) => t("pages.seo.accountValue.description", { skins: MODEL.tiers.reduce((a, b) => a + b.count, 0) });

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.accountValue.title"),
    description: description(t),
    path: PATH,
    keywords: ["MLBB account value", "account worth", "skins value", "diamonds", "Mobile Legends", "calculator"],
  });
}

const date = (locale: Locale, iso: string) =>
  new Intl.DateTimeFormat(LOCALE_HTML[locale], { dateStyle: "long", timeZone: "UTC" }).format(Date.parse(`${iso}T00:00:00Z`));

export default async function AccountValuePage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const count = new Intl.NumberFormat(LOCALE_HTML[locale]);
  const decimal = new Intl.NumberFormat(LOCALE_HTML[locale], { maximumFractionDigits: 4 });
  const percent = new Intl.NumberFormat(LOCALE_HTML[locale], { style: "percent", maximumFractionDigits: 0 });
  const r = ASSUMPTIONS.resale;
  const structuredData = dataTool(locale, {
    name: t("pages.accountValue.title"),
    description: description(t),
    path: PATH,
    category: "UtilitiesApplication",
  });

  const factors = [
    t("pages.accountValue.factorRank", {
      low: decimal.format(Math.min(...RANKS.map((k) => r.rank[k]))),
      high: decimal.format(Math.max(...RANKS.map((k) => r.rank[k]))),
    }),
    t("pages.accountValue.factorHeroes", { low: decimal.format(r.heroesMin), high: decimal.format(r.heroesMax) }),
    t("pages.accountValue.factorEmblems", { per: percent.format(r.perEmblem), n: emblems.length }),
    t("pages.accountValue.factorBinding", { social: decimal.format(r.binding.social) }),
  ];

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.accountValueUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader
        title={t("pages.accountValue.title")}
        lead={t("pages.accountValue.lead")}
      >
        <FreshnessLine locale={locale} className="mt-4" />
      </PageHeader>

      <div className="page-wrap space-y-12 py-8 sm:py-12">
        <p role="note" className="bevel-sm max-w-3xl border border-gold-500/30 bg-gold-500/5 p-4 text-sm leading-relaxed text-chalk-200">
          {t("pages.accountValue.warning")}
        </p>

        <AccountValueEstimator model={MODEL} assumptions={ASSUMPTIONS} />

        <section aria-labelledby="method-title" className="max-w-3xl">
          <SectionTitle id="method-title">{t("pages.accountValue.methodTitle")}</SectionTitle>
          <div className="space-y-4 leading-relaxed text-chalk-300">
            <p>{t("pages.accountValue.methodCost")}</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t("pages.accountValue.tableCaption")}</caption>
                <thead className="text-xs uppercase tracking-wide text-chalk-500">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">{t("pages.accountValue.colTier")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("pages.accountValue.colSkins")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">{t("pages.accountValue.colCost")}</th>
                    <th scope="col" className="py-2 font-medium">{t("pages.accountValue.colBasis")}</th>
                  </tr>
                </thead>
                <tbody>
                  {MODEL.tiers.map((tier) => (
                    <tr key={tier.tier} className="border-t border-night-800">
                      <th scope="row" className="py-2 pr-3 font-medium text-chalk-100">{t(`pages.accountValueUI.tier.${tier.tier}`)}</th>
                      <td className="py-2 pr-3 text-right tabular-nums">{count.format(tier.count)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-gold-400">{count.format(tier.cost)}</td>
                      <td className="py-2 text-chalk-400">
                        {tier.basis === "shop"
                          ? t("pages.accountValue.basisShop", { n: count.format(tier.priced) })
                          : t("pages.accountValue.basisDraw")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              {t("pages.accountValue.methodMoney", {
                usd: decimal.format(ASSUMPTIONS.usdPerDiamond),
                per100: decimal.format(Math.round(ASSUMPTIONS.usdPerDiamond * 10000) / 100),
              })}
            </p>
            <p>
              {t("pages.accountValue.methodResale", { low: percent.format(r.low), high: percent.format(r.high) })}
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {factors.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p>{t("pages.accountValue.methodLimits")}</p>

            <h3 className="pt-2 font-heading text-lg font-bold text-chalk-100">{t("pages.accountValue.ratesTitle")}</h3>
            <p className="text-sm">{t("pages.accountValue.ratesLead", { date: date(locale, ASSUMPTIONS.ratesDate) })}</p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {CURRENCIES.filter((c) => c !== "USD").map((c) => (
                <li key={c} className="bevel-sm border border-night-700/70 bg-night-950/50 px-2 py-1 tabular-nums">
                  1 USD = {decimal.format(ASSUMPTIONS.rates[c])} {c}
                </li>
              ))}
            </ul>
            <p className="text-xs text-chalk-500">
              <a href={ASSUMPTIONS.ratesSource} rel="noopener" className="underline transition-colors hover:text-gold-400">
                {t("pages.accountValue.ratesSource")}
              </a>
              {" · "}
              {t("pages.accountValue.checked", { date: date(locale, ASSUMPTIONS.checked) })}
            </p>

            <p>{t("pages.accountValue.methodPrivacy")}</p>
            <p className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/tools/collection" className="font-semibold text-gold-400 hover:text-gold-500">
                {t("pages.accountValue.collectionLink")} →
              </Link>
              <Link href="/skins" className="font-semibold text-gold-400 hover:text-gold-500">
                {t("pages.collection.skinsLink")} →
              </Link>
            </p>
          </div>
        </section>
      </div>
    </ExtendMessages>
  );
}
