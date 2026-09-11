import type { Metadata } from "next";
import { Carte, EnTetePage } from "@/components/ui";
import { heros, nombreObjets, patchs, synchro } from "@/lib/donnees";
import { classementComplet } from "@/lib/tier-list";
import type { Langue } from "@/i18n/config";
import { LOCALE_HTML } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.apiDoc.titre"),
    description: t("pages.apiDoc.metaDescription"),
    partage: t("pages.apiDoc.ogDescription"),
    chemin: "/api-doc",
  });
}

interface Route {
  chemin: string;
  cle: string;
  parametres?: { nom: string; valeurs: string; role: string }[];
  exemple: string;
}

const ROUTES: Route[] = [
  {
    chemin: "/api/v1/heros",
    cle: "heros",
    parametres: [
      { nom: "role", valeurs: "Tank, Fighter, Assassin, Mage, Marksman, Support", role: "roleParam" },
      { nom: "lane", valeurs: "Or, Jungle, Milieu, Experience, Roam", role: "laneParam" },
    ],
    exemple: "/api/v1/heros?role=Tank&lane=Roam",
  },
  {
    chemin: "/api/v1/heros/{slug}",
    cle: "herosSlug",
    exemple: "/api/v1/heros/khufra",
  },
  {
    chemin: "/api/v1/objets",
    cle: "objets",
    parametres: [
      { nom: "categorie", valeurs: "Attack, Magic, Defense, Movement, Jungling, Roaming", role: "catParam" },
    ],
    exemple: "/api/v1/objets?categorie=Defense",
  },
  {
    chemin: "/api/v1/patchs",
    cle: "patchs",
    exemple: "/api/v1/patchs",
  },
  {
    chemin: "/api/v1/classement",
    cle: "classement",
    exemple: "/api/v1/classement",
  },
];

export default async function PageApi({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <>
      <EnTetePage
        titre={t("pages.apiDoc.titre")}
        chapeau={t("pages.apiDoc.chapeau")}
      >
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          {[
            [t("pages.apiDoc.statHeros"), heros.length],
            [t("pages.apiDoc.statObjets"), nombreObjets],
            [t("pages.apiDoc.statPatchs"), patchs.length],
            [t("pages.apiDoc.statClasses"), classementComplet.length],
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
          <h2 className="font-titre text-2xl font-bold text-craie-100">{t("pages.apiDoc.pointsEntree")}</h2>
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
                <p className="mt-3 text-sm leading-relaxed text-craie-300">{t(`pages.apiDoc.routes.${r.cle}.resume`)}</p>

                {r.parametres && (
                  <dl className="mt-4 space-y-2 border-t border-nuit-800 pt-3 text-sm">
                    {r.parametres.map((p) => (
                      <div key={p.nom} className="flex flex-wrap gap-x-3">
                        <dt className="font-mono text-xs text-or-400">?{p.nom}=</dt>
                        <dd className="min-w-0 flex-1">
                          <span className="text-craie-300">{t(`pages.apiDoc.routes.${r.cle}.${p.role}`)}</span>
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
          <h2 className="font-titre text-2xl font-bold text-craie-100">{t("pages.apiDoc.formeTitre")}</h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-craie-300">
            {t("pages.apiDoc.formeTexte")}
          </p>

          <pre className="biseau mt-4 relative overflow-x-auto border border-nuit-700/70 bg-nuit-950 p-4 text-xs leading-relaxed text-craie-300">
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
          <h2 className="font-titre text-2xl font-bold text-craie-100">{t("pages.apiDoc.conditionsTitre")}</h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

          <ul className="mt-4 space-y-3 leading-relaxed text-craie-300">
            <li>
              <strong className="text-craie-100">{t("pages.apiDoc.c1label")}</strong>{" "}{t("pages.apiDoc.c1texte")}
            </li>
            <li>
              <strong className="text-craie-100">{t("pages.apiDoc.c2label")}</strong>{" "}{t("pages.apiDoc.c2texte")}
            </li>
            <li>
              <strong className="text-craie-100">{t("pages.apiDoc.c3label")}</strong>{" "}{t("pages.apiDoc.c3texte")}
            </li>
            <li>
              <strong className="text-craie-100">{t("pages.apiDoc.c4label")}</strong>{" "}{t("pages.apiDoc.c4texte")}
            </li>
          </ul>
        </section>

        <p className="border-t border-nuit-800 pt-6 text-sm text-craie-500">
          {t("pages.apiDoc.synchroNote", { date: new Date(synchro.date).toLocaleDateString(LOCALE_HTML[locale]) })}
        </p>
      </div>
    </>
  );
}
