import type { Metadata } from "next";
import { serializeJsonLd } from "@/lib/html";
import { notFound } from "next/navigation";
import { BodyArticle } from "@/components/article";
import { article, articles, toHtml } from "@/lib/content";
import type { Locale } from "@/i18n/config";
import { postData, metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return articles("news").map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const a = article("news", slug, locale);
  if (!a) return {};

  return metaPage(locale, {
    title: a.title,
    description: a.summary,
    path: `/news/${slug}`,
    type: "article",
    keywords: a.keywords,
    published: a.date,
    author: a.author,
  });
}

export default async function ArticlePage({ params }: Params) {
  const { locale, slug } = await params;
  const a = article("news", slug, locale);
  if (!a) notFound();

  const structuredData = postData(a, `/news/${slug}`, locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <BodyArticle
        locale={locale}
        article={a}
        html={toHtml(a.content)}
        back={{ href: "/news", label: createT(locale)("pages.news.all") }}
      />
    </>
  );
}
