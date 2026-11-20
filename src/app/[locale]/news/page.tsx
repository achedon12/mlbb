import type { Metadata } from "next";
import { ListArticles } from "@/components/article";
import { ENTRANCE } from "@/components/editorial-poster";
import { ActionLink, PageHeader } from "@/components/ui";
import { articles } from "@/lib/content";
import { languageName, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  const meta = metaPage(locale, {
    title: t("pages.news.metaTitle"),
    description: t("pages.news.metaDescription", { language: languageName(locale) }),
    share: t("pages.news.ogDescription", { language: languageName(locale) }),
    path: "/news",
  });
  return {
    ...meta,
    alternates: { ...meta.alternates, types: { "application/rss+xml": [{ url: "/feed.xml", title: site.name }] } },
  };
}

export default async function NewsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  const list = articles("news", locale);

  return (
    <>
      <PageHeader
        title={t("pages.news.title")}
        lead={t("pages.news.lead")}
        actions={
          <ActionLink href="/guides">{t("pages.guides.all")}</ActionLink>
        }
      />
      <div className={`page-wrap py-8 sm:py-12 ${ENTRANCE}`}>
        <ListArticles articles={list} base="/news" locale={locale} feature />
      </div>
    </>
  );
}
