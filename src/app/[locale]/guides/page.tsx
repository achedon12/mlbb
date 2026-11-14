import type { Metadata } from "next";
import { GuideCard } from "@/components/guide";
import { PageHeader, SectionTitle } from "@/components/ui";
import { GUIDE_KINDS, guides, readingMinutes } from "@/lib/guides";
import { serializeJsonLd } from "@/lib/html";
import type { Locale } from "@/i18n/config";
import { guidesHubData, metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.guides.metaTitle"),
    description: t("pages.guides.metaDescription"),
    path: "/guides",
  });
}

/** Guides hub: strategy guides, then one guide per lane. No search: thirteen cards read at a glance. */
export default async function GuidesPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const list = guides(locale);

  const structuredData = guidesHubData(locale, {
    name: t("pages.guides.ldName"),
    description: t("pages.guides.metaDescription"),
    path: "/guides",
    guides: list.map((g) => ({ title: g.title, slug: g.slug })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader
        title={t("pages.guides.title")}
        lead={t("pages.guides.lead")}
        meta={[t("pages.guides.nGuides", { n: list.length })]}
      />
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:space-y-16 sm:py-14">
        {GUIDE_KINDS.map((kind) => {
          const ofKind = list.filter((g) => g.kind === kind);
          if (ofKind.length === 0) return null;
          const heading = `guides-${kind}`;
          return (
            <section key={kind} aria-labelledby={heading}>
              <SectionTitle id={heading} lead={t(kind === "strategy" ? "pages.guides.strategyLead" : "pages.guides.rolesLead")}>
                {t(kind === "strategy" ? "pages.guides.strategy" : "pages.guides.roles")}
              </SectionTitle>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ofKind.map((g) => (
                  <li key={g.slug}>
                    <GuideCard guide={g} minutes={readingMinutes(g.content)} locale={locale} showKind={false} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
