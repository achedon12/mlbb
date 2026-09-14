import type { Metadata } from "next";
import { TierListMaker, type TierHero } from "@/components/tier-list-maker";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { dataTool, metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { allHeroes } from "@/lib/data";
import { serializeJsonLd } from "@/lib/html";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { rankingOfRank, ORDER_TIERS, RANKS_CLASSES } from "@/lib/tier-list";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.tierMaker.title"),
    description: t("pages.seo.tierMaker.description"),
    path: "/tools/tier-list-maker",
    keywords: ["tier list maker", "tier list", "create", "share", "Mobile Legends", "MLBB"],
  });
}

/**
 * The roster reduced to the thumbnail and filters, and our tier list for each
 * rank as indices into that roster (tier by tier, from strongest to
 * weakest): a few KB to prefill the list at any rank.
 */
function data() {
  const roster: TierHero[] = allHeroes.map((h) => ({
    slug: h.slug,
    name: h.name,
    icon: h.images.icon ?? h.images.portrait,
    roles: h.roles,
    lanes: h.lanes,
  }));
  const hint = new Map(roster.map((h, i) => [h.slug, i]));
  const groups: Partial<Record<MeasuredRank, number[][]>> = Object.fromEntries(
    RANKS_CLASSES.map((rank) => {
      const entries = rankingOfRank(rank);
      return [
        rank,
        ORDER_TIERS.map((p) => entries.filter((e) => e.tier === p).flatMap((e) => hint.get(e.hero.slug) ?? [])),
      ];
    }),
  );
  return { roster, groups };
}

export default async function TierListMakerPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const { roster, groups } = data();
  const structuredData = dataTool(locale, {
    name: t("pages.tierMaker.title"),
    description: t("pages.seo.tierMaker.description"),
    path: "/tools/tier-list-maker",
    category: "UtilitiesApplication",
  });
  const heading2 = "font-heading text-2xl font-bold text-chalk-100";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader
        title={t("pages.tierMaker.title")}
        lead={t("pages.tierMaker.lead")}
        crumbs={[{ name: t("nav.tierList.label"), href: "/tier-list" }, { name: t("pages.tierMaker.crumb") }]}
      />
      <div className="mx-auto max-w-5xl space-y-14 px-4 py-10">
        <ExtendMessages messages={messagesPage(locale, ["pages.tierMakerUI"])}>
          <TierListMaker heroes={roster} groups={groups} ranks={RANKS_CLASSES} />
        </ExtendMessages>

        <section className="max-w-3xl">
          <h2 className={heading2}>{t("pages.tierMaker.howToTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-chalk-300">
            <li>{t("pages.tierMaker.step1")}</li>
            <li>{t("pages.tierMaker.step2")}</li>
            <li>{t("pages.tierMaker.step3")}</li>
            <li>{t("pages.tierMaker.step4")}</li>
          </ol>
        </section>

        <section className="max-w-3xl">
          <h2 className={heading2}>{t("pages.tierMaker.methodTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-chalk-300">{t("pages.tierMaker.method")}</p>
          <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/tier-list" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
              {t("pages.tierMaker.tierListLink")} →
            </Link>
            <Link href="/quiz" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
              {t("pages.tierMaker.quizLink")} →
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
