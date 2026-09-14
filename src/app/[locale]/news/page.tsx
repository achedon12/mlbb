import type { Metadata } from "next";
import { ListArticles } from "@/components/article";
import { PageHeader } from "@/components/ui";
import { articles } from "@/lib/content";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  const meta = metaPage(locale, {
    title: t("pages.news.metaTitle"),
    description: t("pages.news.metaDescription"),
    share: t("pages.news.ogDescription"),
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
      />
      <div className="mx-auto max-w-3xl px-4 py-14">
        <ListArticles articles={list} base="/news" locale={locale} />
      </div>
    </>
  );
}
