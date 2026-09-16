import type { Metadata } from "next";
import { CollectionCalculator } from "@/components/collection-calculator";
import { FreshnessLine } from "@/components/freshness";
import Link from "@/components/link";
import { PageHeader, SectionTitle } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { dataTool, metaPage, metaPaged } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { catalogSkins } from "@/lib/skin-catalog-server";
import { coveragePrice } from "@/lib/collection";
import { pageCount, SIZE_CARDS } from "@/lib/pager";
import { serializeJsonLd } from "@/lib/html";

export const PATH_COLLECTION = "/tools/collection";
const PATH = PATH_COLLECTION;

/** Heroes the tool lists, and so how many pages of them it holds. */
export const pagesCollection = () => pageCount(catalogSkins().heroes.length, SIZE_CARDS);

function description(locale: Locale): string {
  const t = createT(locale);
  const c = coveragePrice(catalogSkins());
  return t("pages.seo.collection.description", { heroes: c.heroes, skins: c.skins });
}

export function metaCollection(locale: Locale, page = 1): Metadata {
  const t = createT(locale);
  return metaPaged(
    metaPage(locale, {
      title: t("pages.seo.collection.title"),
      description: description(locale),
      path: PATH,
      keywords: ["MLBB collection value", "skin value", "diamonds", "Mobile Legends skins", "calculator"],
    }),
    locale,
    PATH,
    page,
  );
}

export function Collection({ locale, page = 1 }: { locale: Locale; page?: number }) {
  const t = createT(locale);
  const count = new Intl.NumberFormat(LOCALE_HTML[locale]);
  const c = coveragePrice(catalogSkins());
  const structuredData = dataTool(locale, {
    name: t("pages.collection.title"),
    description: description(locale),
    path: PATH,
    category: "UtilitiesApplication",
  });

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.collectionUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader title={t("pages.collection.title")} lead={t("pages.collection.lead")}>
        <FreshnessLine locale={locale} className="mt-4" />
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
        <p role="note" className="bevel-sm max-w-3xl border border-gold-500/30 bg-gold-500/5 p-4 text-sm leading-relaxed text-chalk-200">
          {t("pages.collection.warning")}
        </p>

        <CollectionCalculator page={page} />

        <section className="max-w-3xl">
          <SectionTitle>{t("pages.collection.methodTitle")}</SectionTitle>
          <div className="space-y-4 leading-relaxed text-chalk-300">
            <p>
              {t("pages.collection.methodHeroes", {
                heroes: count.format(c.heroes),
                diamonds: count.format(c.heroDiamonds),
              })}
            </p>
            <p>
              {t("pages.collection.methodSkins", {
                skins: count.format(c.skins),
                diamonds: count.format(c.skinsDiamonds),
                others: count.format(c.skinsOtherCurrency),
                unpriced: count.format(c.skins - c.skinsDiamonds - c.skinsOtherCurrency),
              })}
            </p>
            <p>{t("pages.collection.methodStorage")}</p>
            <p className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/skins/calendar" className="font-semibold text-gold-400 hover:text-gold-500">
                {t("pages.collection.calendarLink")} →
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
