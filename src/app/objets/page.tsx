import type { Metadata } from "next";
import { Carte, EnTetePage } from "@/components/ui";
import { objets } from "@/data/objets";
import type { CategorieObjet } from "@/lib/types";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Objets",
  description:
    "Tous les objets de Mobile Legends: Bang Bang par categorie : statistiques, effets passifs, et surtout dans quelle situation chaque objet vaut la peine d'etre achete.",
  alternates: { canonical: "/objets" },
  openGraph: {
    title: `Objets — ${site.nom}`,
    description: "Statistiques, passifs et usage reel de chaque objet.",
    url: "/objets",
  },
};

const CATEGORIES: CategorieObjet[] = ["Attaque", "Magie", "Defense", "Mouvement"];

export default function PageObjets() {
  return (
    <>
      <EnTetePage
        titre="Objets"
        chapeau="Les statistiques comptent moins que le moment ou l'on achete. Chaque objet indique donc a qui il sert et dans quelle situation il devient le bon choix."
      />

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-14">
        {CATEGORIES.map((categorie) => {
          const liste = objets.filter((o) => o.categorie === categorie);
          if (liste.length === 0) return null;

          return (
            <section key={categorie}>
              <h2 className="font-titre text-2xl font-bold text-craie-100">{categorie}</h2>
              <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {liste.map((o) => (
                  <Carte key={o.slug} id={o.slug}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-titre text-lg font-bold text-craie-100">{o.nom}</h3>
                      <span className="shrink-0 text-sm text-or-400">{o.prix} or</span>
                    </div>

                    <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      {Object.entries(o.statistiques).map(([cle, valeur]) => (
                        <div key={cle} className="flex gap-1.5">
                          <dt className="text-craie-500">{cle}</dt>
                          <dd className="font-medium text-craie-100">{valeur}</dd>
                        </div>
                      ))}
                    </dl>

                    {o.passif && (
                      <p className="mt-4 border-l-2 border-or-500/50 pl-3 text-sm leading-relaxed text-craie-300">
                        <span className="font-semibold text-or-400">{o.passif.nom} — </span>
                        {o.passif.description}
                      </p>
                    )}

                    <p className="mt-4 border-t border-nuit-800 pt-3 text-sm leading-relaxed text-craie-500">
                      {o.usage}
                    </p>
                  </Carte>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
