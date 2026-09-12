import type { Metadata } from "next";
import { donneesLd } from "@/lib/html";
import { notFound } from "next/navigation";
import { CorpsArticle } from "@/components/article";
import { article, articles, enHtml } from "@/lib/contenu";
import type { Langue } from "@/i18n/config";
import { donneesBillet, metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";

type Params = { params: Promise<{ locale: Langue; slug: string }> };

export function generateStaticParams() {
  return articles("actualites").map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const a = article("actualites", slug, locale);
  if (!a) return {};

  return metaPage(locale, {
    titre: a.title,
    description: a.summary,
    chemin: `/news/${slug}`,
    type: "article",
    motsCles: a.keywords,
    publie: a.date,
    auteur: a.author,
  });
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
        html={enHtml(a.content)}
        retour={{ href: "/news", label: creerT(locale)("pages.news.all") }}
      />
    </>
  );
}
