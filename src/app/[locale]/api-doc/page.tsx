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
    titre: t("pages.apiDoc.title"),
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
    chemin: "/api/v1/heroes",
    cle: "heroes",
    parametres: [
      { nom: "role", valeurs: "Tank, Fighter, Assassin, Mage, Marksman, Support", role: "roleParam" },
      { nom: "lane", valeurs: "Or, Jungle, Milieu, Experience, Roam", role: "laneParam" },
    ],
    exemple: "/api/v1/heroes?role=Tank&lane=Roam",
  },
  {
    chemin: "/api/v1/heroes/{slug}",
    cle: "heroSlug",
    exemple: "/api/v1/heroes/khufra",
  },
  {
    chemin: "/api/v1/items",
    cle: "items",
    parametres: [
      { nom: "category", valeurs: "Attack, Magic, Defense, Movement, Jungling, Roaming", role: "catParam" },
    ],
    exemple: "/api/v1/items?category=Defense",
  },
  {
    chemin: "/api/v1/patches",
    cle: "patches",
    exemple: "/api/v1/patches",
  },
  {
    chemin: "/api/v1/rankings",
    cle: "rankings",
    exemple: "/api/v1/rankings",
  },
];

export default async function PageApi({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  return (
    <>
      <EnTetePage
        titre={t("pages.apiDoc.title")}
        chapeau={t("pages.apiDoc.lead")}
      >
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          {[
            [t("pages.apiDoc.statHeroes"), heros.length],
            [t("pages.apiDoc.statItems"), nombreObjets],
            [t("pages.apiDoc.statPatches"), patchs.length],
            [t("pages.apiDoc.statRanked"), classementComplet.length],
          ].map(([label, valeur]) => (
            <div key={String(label)}>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
              <dd className="mt-0.5 font-heading text-xl font-bold text-gold-400">{valeur}</dd>
            </div>
          ))}
        </dl>
      </EnTetePage>

      <div className="mx-auto max-w-4xl space-y-12 px-4 py-12">
        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.apiDoc.endpoints")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

          <div className="mt-6 space-y-4">
            {ROUTES.map((r) => (
              <Carte key={r.chemin}>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="bevel-sm bg-night-700 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-400">
                    GET
                  </span>
                  <code className="font-mono text-sm text-chalk-100">{r.chemin}</code>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-chalk-300">{t(`pages.apiDoc.routes.${r.cle}.summary`)}</p>

                {r.parametres && (
                  <dl className="mt-4 space-y-2 border-t border-night-800 pt-3 text-sm">
                    {r.parametres.map((p) => (
                      <div key={p.nom} className="flex flex-wrap gap-x-3">
                        <dt className="font-mono text-xs text-gold-400">?{p.nom}=</dt>
                        <dd className="min-w-0 flex-1">
                          <span className="text-chalk-300">{t(`pages.apiDoc.routes.${r.cle}.${p.role}`)}</span>
                          <span className="mt-0.5 block text-xs text-chalk-500">
                            {p.valeurs}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                <a
                  href={r.exemple}
                  className="mt-4 inline-block font-mono text-xs text-azure-400 underline underline-offset-4 hover:text-gold-400"
                >
                  {r.exemple}
                </a>
              </Carte>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.apiDoc.shapeTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-chalk-300">
            {t("pages.apiDoc.shapeText")}
          </p>

          <pre className="bevel mt-4 relative overflow-x-auto border border-night-700/70 bg-night-950 p-4 text-xs leading-relaxed text-chalk-300">
{`{
  "data": [ … ],
  "total": 133,
  "source": {
    "name": "Mobile Legends Wiki",
    "url": "https://mobilelegends.fandom.com",
    "license": "CC BY-SA"
  }
}`}
          </pre>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.apiDoc.termsTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

          <ul className="mt-4 space-y-3 leading-relaxed text-chalk-300">
            <li>
              <strong className="text-chalk-100">{t("pages.apiDoc.c1label")}</strong>{" "}{t("pages.apiDoc.c1text")}
            </li>
            <li>
              <strong className="text-chalk-100">{t("pages.apiDoc.c2label")}</strong>{" "}{t("pages.apiDoc.c2text")}
            </li>
            <li>
              <strong className="text-chalk-100">{t("pages.apiDoc.c3label")}</strong>{" "}{t("pages.apiDoc.c3text")}
            </li>
            <li>
              <strong className="text-chalk-100">{t("pages.apiDoc.c4label")}</strong>{" "}{t("pages.apiDoc.c4text")}
            </li>
          </ul>
        </section>

        <p className="border-t border-night-800 pt-6 text-sm text-chalk-500">
          {t("pages.apiDoc.syncNote", { date: new Date(synchro.date).toLocaleDateString(LOCALE_HTML[locale]) })}
        </p>
      </div>
    </>
  );
}
