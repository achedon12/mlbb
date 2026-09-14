import type { Metadata } from "next";
import { TeamAnalysis } from "@/components/team-analysis";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { heroLabel } from "@/i18n/hero-data";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import type { TypeDamage } from "@/lib/composition";
import { catalogTeam } from "@/lib/composition-data";
import { RANKS_CLASSES } from "@/lib/tier-list";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.team.metaTitle"),
    description: t("pages.team.metaDescription"),
    share: t("pages.team.ogDescription"),
    path: "/tools/team",
    keywords: ["team composition", "team comp", "analyzer", "synergy", "counter", "Mobile Legends", "MLBB"],
  });
}

export default async function TeamPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  // The `heroData` catalog stays on the server: the three damage labels
  // leave already resolved.
  const damage = (key: TypeDamage) => heroLabel(t, "damage", key) ?? key;

  return (
    <>
      <PageHeader title={t("pages.team.title")} lead={t("pages.team.lead")}>
        <Link
          href="/draft"
          className="mt-5 inline-block text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
        >
          {t("pages.team.draftLink")} →
        </Link>
      </PageHeader>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <TeamAnalysis
          heroes={catalogTeam()}
          ranks={RANKS_CLASSES}
          labelsDamage={{ physical: damage("physical"), magic: damage("magic"), mixed: damage("mixed") }}
        />

        <p className="mt-14 border-t border-night-800 pt-6 text-sm leading-relaxed text-chalk-500">
          {t("pages.team.rating")}
        </p>
      </div>
    </>
  );
}
