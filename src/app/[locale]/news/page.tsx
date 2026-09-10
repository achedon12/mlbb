import type { Metadata } from "next";
import { ListeArticles } from "@/components/article";
import { EnTetePage } from "@/components/ui";
import { articles } from "@/lib/contenu";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaLangues } from "@/i18n/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return {
    title: t("pages.news.metaTitre"),
    description: t("pages.news.metaDescription"),
    alternates: { ...metaLangues(locale, "/news"), types: { "application/rss+xml": [{ url: "/feed.xml", title: `${site.nom}` }] } },
    openGraph: { title: `${t("pages.news.metaTitre")} — ${site.nom}`, description: t("pages.news.ogDescription"), url: `/${locale}/news` },
  };
}

export default async function PageActualites({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const liste = articles("actualites");

  return (
    <>
      <EnTetePage
        titre={t("pages.news.titre")}
        chapeau={t("pages.news.chapeau")}
      />
      <div className="mx-auto max-w-3xl px-4 py-14">
        <ListeArticles articles={liste} base="/news" />
      </div>
    </>
  );
}
