import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { categoriesObjets, nomCategorie, objets } from "@/lib/donnees";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Objets",
  description: `Les ${objets.length} objets de Mobile Legends: Bang Bang : statistiques, effets uniques, passifs, recette et prix, classes par categorie.`,
  alternates: { canonical: "/objets" },
  openGraph: {
    title: `Objets — ${site.nom}`,
    description: `Les ${objets.length} objets du jeu, avec statistiques, passifs et recettes.`,
    url: "/objets",
  },
};

export default function PageObjets() {
  return (
    <>
      <EnTetePage
        titre="Objets"
        chapeau={`Les ${objets.length} objets de la boutique, avec leurs statistiques, leurs effets et leur recette. Les valeurs sont extraites du wiki a chaque synchronisation.`}
      />

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-14">
        {categoriesObjets.map((categorie) => {
          const liste = objets.filter((o) => o.categorie === categorie);

          return (
            <section key={categorie}>
              <div className="flex items-baseline gap-3">
                <h2 className="font-titre text-2xl font-bold text-craie-100">
                  {nomCategorie(categorie)}
                </h2>
                <span className="text-sm text-craie-500">{liste.length}</span>
              </div>
              <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

              {/* Grille dense : les objets se comparent mieux cote a cote. */}
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {liste.map((o) => (
                  <article
                    key={o.slug}
                    id={o.slug}
                    className="biseau flex flex-col border border-nuit-700/70 bg-nuit-900/60 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-titre font-bold leading-tight text-craie-100">
                        {o.nom}
                      </h3>
                      {o.prix !== null && (
                        <span className="shrink-0 font-titre text-sm text-or-400">{o.prix}</span>
                      )}
                    </div>

                    {o.resume && (
                      <p className="mt-0.5 text-xs uppercase tracking-wide text-craie-500">
                        {o.resume}
                      </p>
                    )}

                    {o.bonus && (
                      <p className="mt-3 text-sm leading-snug text-craie-300">{o.bonus}</p>
                    )}

                    {o.unique && (
                      <p className="mt-2 text-sm leading-snug text-azur-400">{o.unique}</p>
                    )}

                    {o.passif && (
                      <p className="mt-3 border-l-2 border-or-500/50 pl-3 text-xs leading-relaxed text-craie-500">
                        {o.passif}
                      </p>
                    )}

                    {o.actif && (
                      <p className="mt-2 border-l-2 border-azur-500/50 pl-3 text-xs leading-relaxed text-craie-500">
                        {o.actif}
                      </p>
                    )}

                    {o.recette.length > 0 && (
                      <p className="mt-auto pt-3 text-xs text-craie-500">
                        <span className="text-craie-300">Recette : </span>
                        {o.recette.join(" + ")}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
