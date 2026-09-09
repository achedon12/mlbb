import type { Metadata } from "next";
import { ListeArticles } from "@/components/article";
import { EnTetePage } from "@/components/ui";
import { articles } from "@/lib/contenu";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Patch notes",
  description:
    "Resume et analyse de chaque patch de Mobile Legends: Bang Bang : heros affaiblis, heros renforces, changements d'objets et lecture d'ensemble.",
  alternates: {
    canonical: "/patch-notes",
    types: { "application/rss+xml": [{ url: "/feed.xml", title: `${site.nom} — actualites` }] },
  },
  openGraph: {
    title: `Patch notes — ${site.nom}`,
    description: "Analyses du meta et guides de fond, en francais.",
    url: "/patch-notes",
  },
};

export default function PagePatchNotes() {
  const liste = articles("patch-notes");

  return (
    <>
      <EnTetePage
        titre="Patch notes"
        chapeau="Chaque mise a jour resumee et commentee : ce qui change vraiment en partie, plutot que la liste brute des valeurs modifiees."
      />
      <div className="mx-auto max-w-3xl px-4 py-14">
        <ListeArticles articles={liste} base="/patch-notes" />
      </div>
    </>
  );
}
