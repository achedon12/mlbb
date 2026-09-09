import type { Metadata } from "next";
import { ListeHeros } from "@/components/liste-heros";
import { EnTetePage } from "@/components/ui";
import { heros, herosAnalyses, nombreSkins } from "@/lib/donnees";
import { tauxParSlug } from "@/lib/tier-list";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Tous les heros",
  description: `Les ${heros.length} heros de Mobile Legends: Bang Bang, filtrables par role et par position : portraits, skins, statistiques, et ${herosAnalyses.length} analyses redigees.`,
  alternates: { canonical: "/heros" },
  openGraph: {
    title: `Tous les heros — ${site.nom}`,
    description: `Les ${heros.length} heros de Mobile Legends: Bang Bang, avec leurs ${nombreSkins} skins.`,
    url: "/heros",
  },
};

const donneesStructurees = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Heros de Mobile Legends: Bang Bang",
  numberOfItems: heros.length,
  itemListElement: heros.map((h, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: h.nom,
    url: `${site.url}/heros/${h.slug}`,
  })),
};

export default async function PageHeros({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  // On n'envoie au client que les champs affiches par les vignettes.
  const apercus = heros.map((h) => {
    const taux = tauxParSlug.get(h.slug);
    return {
      slug: h.slug,
      nom: h.nom,
      roles: h.roles,
      lanes: h.lanes,
      visuels: h.visuels,
      skins: h.skins.length,
      analyse: h.analyse !== null,
      victoire: taux?.victoire ?? null,
      palier: taux?.palier ?? null,
    };
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
      />
      <EnTetePage
        titre="Heros"
        chapeau={`Les ${heros.length} heros du jeu et leurs ${nombreSkins} skins, filtrables par role et par position. Les ${herosAnalyses.length} fiches marquees « Analyse » contiennent en plus un commentaire, des builds et des contres.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <ListeHeros heros={apercus} rechercheInitiale={q ?? ""} />
      </div>
    </>
  );
}
