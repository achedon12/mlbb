import type { Metadata } from "next";
import { ListeHeros } from "@/components/liste-heros";
import { EnTetePage } from "@/components/ui";
import { herosDetails } from "@/data/heros";
import { roster } from "@/data/roster";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Tous les heros",
  description: `Les ${roster.length} heros de Mobile Legends: Bang Bang, filtrables par role et par position, avec ${herosDetails.length} fiches completes : competences, builds, forces, faiblesses et contres.`,
  alternates: { canonical: "/heros" },
  openGraph: {
    title: `Tous les heros — ${site.nom}`,
    description: `Les ${roster.length} heros de Mobile Legends: Bang Bang, filtrables par role et par position.`,
    url: "/heros",
  },
};

/**
 * Le catalogue est une liste : on l'expose en ItemList pour que les moteurs
 * comprennent la structure de la page plutot que d'y voir un mur de liens.
 */
const donneesStructurees = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Heros de Mobile Legends: Bang Bang",
  numberOfItems: roster.length,
  itemListElement: roster.map((h, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: h.nom,
    url: `${site.url}/heros/${h.slug}`,
  })),
};

export default function PageHeros() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
      />
      <EnTetePage
        titre="Heros"
        chapeau={`Les ${roster.length} heros du jeu, filtrables par role et par position. Les ${herosDetails.length} fiches marquees « Fiche » contiennent les competences, les builds, les contres et une analyse.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <ListeHeros heros={roster} />
      </div>
    </>
  );
}
