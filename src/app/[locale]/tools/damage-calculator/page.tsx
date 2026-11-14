import type { Metadata } from "next";
import { DamageCalculator } from "@/components/damage-calculator";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { dataTool, metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { damageCalculatorData } from "@/lib/build-catalog";
import { SOURCES } from "@/lib/build-simulator";
import { serializeJsonLd } from "@/lib/html";

type Params = { params: Promise<{ locale: Locale }> };

const PATH = "/tools/damage-calculator";

/** Wiki pages the formula comes from; the rest of `SOURCES` concerns the build simulator. */
const FORMULA_SOURCES = [SOURCES.physicalDefense, SOURCES.magicDefense, SOURCES.penetration, SOURCES.crit];

/** "https://.../wiki/Physical_defense" to "Physical defense": the wiki page's own title. */
const wikiPage = (url: string) => decodeURIComponent(url.split("/wiki/")[1] ?? url).replace(/_/g, " ");

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.damageCalculator.title"),
    description: t("pages.seo.damageCalculator.description"),
    path: PATH,
    keywords: ["damage calculator", "penetration", "defense", "effective HP", "Mobile Legends", "MLBB"],
  });
}

export default async function DamageCalculatorPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const structuredData = dataTool(locale, {
    name: t("pages.damageCalculator.title"),
    description: t("pages.seo.damageCalculator.description"),
    path: PATH,
    category: "GameApplication",
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader title={t("pages.damageCalculator.title")} lead={t("pages.damageCalculator.lead")} />
      <div className="mx-auto max-w-5xl space-y-12 px-4 py-8">
        {/* The stat labels and the item picker's come from the build simulator's section. */}
        <ExtendMessages messages={messagesPage(locale, ["pages.damageCalculatorUI", "pages.buildSimulatorUI"])}>
          <DamageCalculator data={damageCalculatorData(locale, t)} />
        </ExtendMessages>

        <section aria-labelledby="method-title" className="max-w-3xl">
          <h2 id="method-title" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.damageCalculator.methodTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-4 leading-relaxed text-chalk-300">
            <p>{t("pages.damageCalculator.method1")}</p>
            <p>{t("pages.damageCalculator.method2")}</p>
            <p>{t("pages.damageCalculator.method3")}</p>
            <p>{t("pages.damageCalculator.method4")}</p>
          </div>
          <h3 className="mt-6 text-sm font-semibold text-chalk-300">{t("pages.damageCalculator.sourcesTitle")}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-chalk-500">
            {FORMULA_SOURCES.map((url) => (
              <li key={url}>
                <a href={url} rel="noopener" className="underline transition-colors hover:text-gold-400">
                  {t("pages.damageCalculator.sourceWiki", { page: wikiPage(url) })}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
