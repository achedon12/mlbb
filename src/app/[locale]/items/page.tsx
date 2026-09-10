import type { Metadata } from "next";
import { ListeObjets } from "@/components/liste-objets";
import { EnTetePage } from "@/components/ui";
import visuels from "@/data/jeu/visuels.json";
import { categoriesObjets, NOM_CATEGORIE, objets } from "@/lib/donnees";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Objets",
  description: `Les ${objets.length} objets de Mobile Legends: Bang Bang : statistiques, effets uniques, passifs, recettes et prix, avec leur visuel.`,
  alternates: { canonical: "/items" },
  openGraph: {
    title: `Objets — ${site.nom}`,
    description: `Les ${objets.length} objets du jeu, avec statistiques, passifs et recettes.`,
    url: "/items",
  },
};

const images = visuels.objets as Record<string, string>;

export default function PageObjets() {
  const apercus = objets.map((o) => ({ ...o, image: images[o.slug] ?? null }));

  return (
    <>
      <EnTetePage
        titre="Objets"
        chapeau={`Les ${objets.length} objets de la boutique. Cliquez sur un objet pour voir le detail ; filtrez par categorie ou cherchez directement une statistique.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <ListeObjets
          objets={apercus}
          categories={categoriesObjets}
          nomCategorie={NOM_CATEGORIE}
        />
      </div>
    </>
  );
}
