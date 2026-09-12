import type { Metadata } from "next";
import { ListeArticles } from "@/components/article";
import { EnTetePage } from "@/components/ui";
import { articles } from "@/lib/contenu";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  const meta = metaPage(locale, {
    titre: t("pages.news.metaTitle"),
    description: t("pages.news.metaDescription"),
    partage: t("pages.news.ogDescription"),
    chemin: "/news",
  });
  return {
    ...meta,
    alternates: { ...meta.alternates, types: { "application/rss+xml": [{ url: "/feed.xml", title: site.nom }] } },
  };
}

export default async function PageActualites({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const liste = articles("actualites", locale);

  return (
    <>
      <EnTetePage
        titre={t("pages.news.title")}
        chapeau={t("pages.news.lead")}
      />
      <div className="mx-auto max-w-3xl px-4 py-14">
        <ListeArticles articles={liste} base="/news" langue={locale} />
      </div>
    </>
  );
}
