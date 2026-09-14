import type { Metadata } from "next";
import { WinRateCalculator } from "@/components/win-rate-calculator";
import { PageHeader } from "@/components/ui";
import { serializeJsonLd } from "@/lib/html";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { dataTool, metaPage } from "@/i18n/seo";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.winRate.title"),
    description: t("pages.seo.winRate.description"),
    path: "/tools/win-rate",
    keywords: ["win rate", "winrate", "calculator", "Mobile Legends", "MLBB"],
  });
}

export default async function WinRateToolPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const structuredData = dataTool(locale, {
    name: t("pages.winRate.title"),
    description: t("pages.seo.winRate.description"),
    path: "/tools/win-rate",
    category: "UtilitiesApplication",
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <PageHeader title={t("pages.winRate.title")} lead={t("pages.winRate.lead")} />
      <div className="mx-auto max-w-3xl space-y-12 px-4 py-12">
        <WinRateCalculator />

        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.winRate.methodTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-4 leading-relaxed text-chalk-300">
            <p>{t("pages.winRate.method1")}</p>
            <p>{t("pages.winRate.method2")}</p>
          </div>
        </section>
      </div>
    </>
  );
}
