import type { Metadata } from "next";
import { Carte, EnTetePage } from "@/components/ui";
import { heros, objets, patchs, synchro } from "@/lib/donnees";
import { classementComplet } from "@/lib/tier-list";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "API publique",
  description:
    "Une API JSON ouverte sur les donnees Mobile Legends: Bang Bang du site : heros, competences, skins, objets, patchs et classement. Sans cle, sans inscription.",
  alternates: { canonical: "/api-doc" },
  openGraph: {
    title: `API publique — ${site.nom}`,
    description: "Heros, objets, patchs et classement en JSON, sans cle.",
    url: "/api-doc",
  },
};

interface Route {
  chemin: string;
  resume: string;
  parametres?: { nom: string; valeurs: string; role: string }[];
  exemple: string;
}

const ROUTES: Route[] = [
  {
    chemin: "/api/v1/heros",
    resume: "Liste des heros, sans leurs competences detaillees ni leurs skins.",
    parametres: [
      { nom: "role", valeurs: "Tank, Fighter, Assassin, Mage, Marksman, Support", role: "Ne garde que ce role." },
      { nom: "lane", valeurs: "Or, Jungle, Milieu, Experience, Roam", role: "Ne garde que cette position." },
    ],
    exemple: "/api/v1/heros?role=Tank&lane=Roam",
  },
  {
    chemin: "/api/v1/heros/{slug}",
    resume:
      "Fiche complete : statistiques, competences avec leur description, skins, visuels, illustrations et analyse redigee quand elle existe.",
    exemple: "/api/v1/heros/khufra",
  },
  {
    chemin: "/api/v1/objets",
    resume: "Objets de la boutique, avec statistiques, passifs et recettes.",
    parametres: [
      { nom: "categorie", valeurs: "Attack, Magic, Defense, Movement, Jungling, Roaming", role: "Ne garde que cette categorie." },
    ],
    exemple: "/api/v1/objets?categorie=Defense",
  },
  {
    chemin: "/api/v1/patchs",
    resume: "Versions recensees, de la plus recente a la plus ancienne.",
    exemple: "/api/v1/patchs",
  },
  {
    chemin: "/api/v1/classement",
    resume:
      "Classement calcule : taux de victoire, de ban et de selection, palier et date du releve.",
    exemple: "/api/v1/classement",
  },
];

export default function PageApi() {
  return (
    <>
      <EnTetePage
        titre="API publique"
        chapeau="Les donnees du site sont accessibles en JSON, sans cle ni inscription. Servez-vous — la seule contrainte est de citer la source, qui accompagne chaque reponse."
      >
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          {[
            ["Heros", heros.length],
            ["Objets", objets.length],
            ["Patchs", patchs.length],
            ["Heros classes", classementComplet.length],
          ].map(([label, valeur]) => (
            <div key={String(label)}>
              <dt className="text-xs uppercase tracking-wide text-craie-500">{label}</dt>
              <dd className="mt-0.5 font-titre text-xl font-bold text-or-400">{valeur}</dd>
            </div>
          ))}
        </dl>
      </EnTetePage>

      <div className="mx-auto max-w-4xl space-y-12 px-4 py-12">
        <section>
          <h2 className="font-titre text-2xl font-bold text-craie-100">Points d&apos;entree</h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

          <div className="mt-6 space-y-4">
            {ROUTES.map((r) => (
              <Carte key={r.chemin}>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="biseau-sm bg-nuit-700 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-400">
                    GET
                  </span>
                  <code className="font-mono text-sm text-craie-100">{r.chemin}</code>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-craie-300">{r.resume}</p>

                {r.parametres && (
                  <dl className="mt-4 space-y-2 border-t border-nuit-800 pt-3 text-sm">
                    {r.parametres.map((p) => (
                      <div key={p.nom} className="flex flex-wrap gap-x-3">
                        <dt className="font-mono text-xs text-or-400">?{p.nom}=</dt>
                        <dd className="min-w-0 flex-1">
                          <span className="text-craie-300">{p.role}</span>
                          <span className="mt-0.5 block text-xs text-craie-500">
                            {p.valeurs}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                <a
                  href={r.exemple}
                  className="mt-4 inline-block font-mono text-xs text-azur-400 underline underline-offset-4 hover:text-or-400"
                >
                  {r.exemple}
                </a>
              </Carte>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-titre text-2xl font-bold text-craie-100">Forme des reponses</h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-craie-300">
            Chaque reponse enveloppe le resultat dans <code>donnees</code>, y
            joint le nombre total d&apos;elements quand il s&apos;agit d&apos;une
            liste, et rappelle la source des donnees.
          </p>

          <pre className="biseau mt-4 overflow-x-auto border border-nuit-700/70 bg-nuit-950 p-4 text-xs leading-relaxed text-craie-300">
{`{
  "donnees": [ … ],
  "total": 133,
  "source": {
    "nom": "Mobile Legends Wiki",
    "url": "https://mobilelegends.fandom.com",
    "licence": "CC BY-SA"
  }
}`}
          </pre>
        </section>

        <section>
          <h2 className="font-titre text-2xl font-bold text-craie-100">Conditions</h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

          <ul className="mt-4 space-y-3 leading-relaxed text-craie-300">
            <li>
              <strong className="text-craie-100">Pas de cle, pas de quota.</strong>{" "}
              Les reponses sont statiques et mises en cache : elles ne coutent
              rien a servir. Restez raisonnable et tout ira bien.
            </li>
            <li>
              <strong className="text-craie-100">Citez la source.</strong> Les
              donnees viennent du wiki communautaire, sous licence CC BY-SA :
              la reutiliser suppose de le crediter. L&apos;information voyage
              avec chaque reponse.
            </li>
            <li>
              <strong className="text-craie-100">Les analyses redigees</strong>{" "}
              — commentaires, builds, contres — sont produites pour ce site et
              couvertes par sa licence MIT.
            </li>
            <li>
              <strong className="text-craie-100">Aucune donnee de joueur.</strong>{" "}
              Moonton n&apos;expose ni classement, ni historique, ni statut de
              connexion : cette API n&apos;en propose donc pas, et aucune autre
              ne le peut honnetement.
            </li>
          </ul>
        </section>

        <p className="border-t border-nuit-800 pt-6 text-sm text-craie-500">
          Les donnees suivent la synchronisation hebdomadaire du site. Derniere
          en date : {new Date(synchro.date).toLocaleDateString("fr-FR")}.
        </p>
      </div>
    </>
  );
}
