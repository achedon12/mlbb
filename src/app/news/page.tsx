import type { Metadata } from "next";
import { ListeArticles } from "@/components/article";
import { EnTetePage } from "@/components/ui";
import { articles } from "@/lib/contenu";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Actualites et guides",
  description:
    "Analyses du meta, guides de fond et lectures de patch de Mobile Legends: Bang Bang, en francais. Disponible en flux RSS.",
  alternates: {
    canonical: "/news",
    types: { "application/rss+xml": [{ url: "/feed.xml", title: `${site.nom} — actualites` }] },
  },
  openGraph: {
    title: `Actualites et guides — ${site.nom}`,
    description: "Analyses du meta et guides de fond, en francais.",
    url: "/news",
  },
};

export default function PageActualites() {
  const liste = articles("actualites");

  return (
    <>
      <EnTetePage
        titre="Actualites et guides"
        chapeau="Des articles de fond plutot que des breves : ce qui change dans le meta, pourquoi, et ce qu'il faut en faire en partie."
      />
      <div className="mx-auto max-w-3xl px-4 py-14">
        <ListeArticles articles={liste} base="/news" />
      </div>
    </>
  );
}
