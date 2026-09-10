import type { Metadata } from "next";
import { donneesLd } from "@/lib/html";
import { notFound } from "next/navigation";
import { CorpsArticle } from "@/components/article";
import { article, articles, enHtml } from "@/lib/contenu";
import type { Langue } from "@/i18n/config";
import { donneesBillet, metaLangues } from "@/i18n/seo";

type Params = { params: Promise<{ locale: Langue; slug: string }> };

export function generateStaticParams() {
  return articles("actualites").map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const a = article("actualites", slug, locale);
  if (!a) return {};

  return {
    title: a.titre,
    description: a.chapeau,
    keywords: a.motsCles,
    alternates: metaLangues(locale, `/news/${slug}`),
    openGraph: {
      type: "article",
      title: a.titre,
      description: a.chapeau,
      url: `/${locale}/news/${slug}`,
      publishedTime: a.date,
      authors: [a.auteur],
    },
  };
}

export default async function PageArticle({ params }: Params) {
  const { locale, slug } = await params;
  const a = article("actualites", slug, locale);
  if (!a) notFound();

  const donneesStructurees = donneesBillet(a, `/news/${slug}`, locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
      />
      <CorpsArticle
        langue={locale}
        article={a}
        html={enHtml(a.contenu)}
        retour={{ href: "/news", label: "Toutes les actualites" }}
      />
    </>
  );
}
