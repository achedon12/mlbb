import type { Metadata } from "next";
import { GuideCard } from "@/components/guide";
import { Breadcrumb } from "@/components/breadcrumb";
import { Dex } from "@/components/mascot";
import { SectionTitle } from "@/components/ui";
import motion from "@/components/catalogue-motion.module.css";
import { cn } from "@/lib/utils";
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
    card: true,
  });
}

/**
 * Guides hub: strategy guides, then one guide per lane. No search: thirteen
 * cards read at a glance. Each card is the guide's lead artwork with its
 * title over it; the first strategy guide takes the room of a cover story,
 * and Dex, map in hand, introduces the shelf.
 */
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
      <div>
        <div className="page-wrap grid items-end gap-x-10 gap-y-4 pb-6 pt-3 sm:pb-10 sm:pt-5 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <Breadcrumb
              crumbs={[{ name: t("pages.guides.title") }]}
              className="mb-2.5 [&_ol]:flex-nowrap [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs sm:mb-3"
            />
            <h1 className="type-giant text-chalk-100">{t("pages.guides.title")}</h1>
            <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
            <div className="mt-1 flex items-end gap-4">
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-chalk-300 sm:text-base">{t("pages.guides.lead")}</p>
            </div>
            <p className="mt-3 flex items-baseline gap-2 text-sm text-chalk-400">
              <span aria-hidden className="score text-4xl">{list.length}</span>
              <span aria-hidden>{t("pages.guides.nGuides", { n: list.length }).replace(String(list.length), "").trim()}</span>
              <span className="sr-only">{t("pages.guides.nGuides", { n: list.length })}</span>
            </p>
          </div>
          <Dex pose="carte" height={210} priority className="mx-auto hidden sm:inline-block lg:mx-0" />
        </div>
        <div aria-hidden className="eclat-rule" />
      </div>
      <div className="page-wrap space-y-14 py-10 sm:space-y-20 sm:py-14">
        {GUIDE_KINDS.map((kind) => {
          const ofKind = list.filter((g) => g.kind === kind);
          if (ofKind.length === 0) return null;
          const heading = `guides-${kind}`;
          const featured = kind === "strategy";
          return (
            <section key={kind} aria-labelledby={heading}>
              <SectionTitle id={heading} lead={t(kind === "strategy" ? "pages.guides.strategyLead" : "pages.guides.rolesLead")}>
                {t(kind === "strategy" ? "pages.guides.strategy" : "pages.guides.roles")}
              </SectionTitle>
              <ul
                className={cn(
                  "grid gap-3 sm:grid-cols-2 sm:gap-4",
                  featured ? "lg:grid-cols-4" : "lg:grid-cols-3 2xl:grid-cols-5",
                  featured && motion.rise,
                )}
              >
                {ofKind.map((g, i) => (
                  <li key={g.slug} className={cn(featured && i === 0 && "sm:col-span-2 lg:row-span-2")}>
                    <GuideCard
                      guide={g}
                      minutes={readingMinutes(g.content)}
                      locale={locale}
                      showKind={false}
                      large={featured && i === 0}
                    />
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
