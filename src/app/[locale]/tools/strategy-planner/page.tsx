import type { Metadata } from "next";
import { Foldable } from "@/components/foldable";
import Link from "@/components/link";
import { StrategyPlanner, type PlannerHero, type PlannerMarker } from "@/components/strategy-planner";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { dataTool, metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { allHeroes } from "@/lib/data";
import { serializeJsonLd } from "@/lib/html";
import { OBJECTIVES } from "@/lib/retribution";
import { MARKERS, type MarkerKey } from "@/lib/strategy-plan";

type Params = { params: Promise<{ locale: Locale }> };

const PATH = "/tools/strategy-planner";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.strategyPlanner.title"),
    description: t("pages.seo.strategyPlanner.description"),
    path: PATH,
    keywords: ["strategy planner", "MLBB map", "rotation", "whiteboard", "Turtle", "Lord", "Mobile Legends", "MLBB"],
  });
}

export default async function StrategyPlannerPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  // The roster reduced to what a token needs: a name and an icon.
  const heroes: PlannerHero[] = allHeroes.map((h) => ({ slug: h.slug, name: h.name, icon: h.images.icon ?? h.images.portrait }));
  const markers = Object.fromEntries(
    MARKERS.map((m) => [m, { name: t(`pages.map.point.${m}.name`), image: OBJECTIVES[m].image }]),
  ) as Record<MarkerKey, PlannerMarker>;
  const structuredData = dataTool(locale, {
    name: t("pages.strategyPlanner.title"),
    description: t("pages.seo.strategyPlanner.description"),
    path: PATH,
    category: "GameApplication",
  });
  const heading2 = "font-heading text-2xl font-bold text-chalk-100";
  const link = "font-semibold text-gold-400 transition-colors hover:text-gold-500";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader
        title={t("pages.strategyPlanner.title")}
        lead={t("pages.strategyPlanner.lead")}
        crumbs={[{ name: t("nav.mapGuide.label"), href: "/map" }, { name: t("pages.strategyPlanner.crumb") }]}
      />
      <div className="page-wrap space-y-10 pb-10 pt-5">
        <ExtendMessages messages={messagesPage(locale, ["pages.strategyPlannerUI"])}>
          <StrategyPlanner heroes={heroes} markers={markers} />
        </ExtendMessages>

        <section className="max-w-3xl">
          <h2 className={heading2}>{t("pages.strategyPlanner.howToTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <Foldable label={t("pages.strategyPlanner.howToOpen")} className="mt-3">
            <ol className="list-decimal space-y-2 pl-5 leading-relaxed text-chalk-300">
              <li>{t("pages.strategyPlanner.step1")}</li>
              <li>{t("pages.strategyPlanner.step2")}</li>
              <li>{t("pages.strategyPlanner.step3")}</li>
              <li>{t("pages.strategyPlanner.step4")}</li>
            </ol>
          </Foldable>
          <p className="mt-4 leading-relaxed text-chalk-300">{t("pages.strategyPlanner.mapNote")}</p>
          <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/map" className={link}>
              {t("pages.strategyPlanner.mapLink")} →
            </Link>
            <Link href="/tools/timer" className={link}>
              {t("pages.strategyPlanner.timerLink")} →
            </Link>
            <Link href="/draft" className={link}>
              {t("pages.strategyPlanner.draftLink")} →
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
