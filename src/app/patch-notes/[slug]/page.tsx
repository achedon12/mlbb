import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CorpsArticle } from "@/components/article";
import { article, articles, enHtml } from "@/lib/contenu";
import { site } from "@/lib/site";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return articles("patch-notes").map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const a = article("patch-notes", slug);
  if (!a) return {};

  return {
    title: a.titre,
    description: a.chapeau,
    keywords: a.motsCles,
    alternates: { canonical: `/patch-notes/${slug}` },
    openGraph: {
      type: "article",
      title: a.titre,
      description: a.chapeau,
      url: `/patch-notes/${slug}`,
      publishedTime: a.date,
      authors: [a.auteur],
    },
  };
}

export default async function PageArticle({ params }: Params) {
  const { slug } = await params;
  const a = article("patch-notes", slug);
  if (!a) notFound();

  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.titre,
    description: a.chapeau,
    datePublished: a.date,
    dateModified: a.date,
    inLanguage: "fr-FR",
    keywords: a.motsCles.join(", "),
    author: { "@type": "Person", name: a.auteur, url: `https://github.com/${a.auteur}` },
    publisher: { "@type": "Organization", name: site.nom, url: site.url },
    mainEntityOfPage: `${site.url}/patch-notes/${slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
      />
      <CorpsArticle
        article={a}
        html={enHtml(a.contenu)}
        retour={{ href: "/patch-notes", label: "Tous les patch notes" }}
      />
    </>
  );
}
