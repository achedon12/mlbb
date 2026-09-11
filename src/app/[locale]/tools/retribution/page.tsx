import type { Metadata } from "next";
import { EntraineurChatiment } from "@/components/entraineur-chatiment";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import {
  CHATIMENT_BASE,
  CHATIMENT_PAR_NIVEAU,
  CLES_OBJECTIFS,
  DIFFICULTES_ORDRE,
  MANCHES_PAR_SERIE,
  NIVEAU_MAX,
  NIVEAU_MIN,
  OBJECTIFS,
  POIDS_PRECISION,
  POIDS_VITESSE,
  REACTION_NULLE_MS,
  REACTION_PLEINE_MS,
  RECHARGE_CHATIMENT_S,
  REGLAGES,
  SOURCE_CHATIMENT,
  degatsChatiment,
} from "@/lib/chatiment";
import { donneesLd } from "@/lib/html";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Langue }> };

const CHEMIN = "/tools/retribution";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.chatiment.titre"),
    description: t("pages.seo.chatiment.description"),
    chemin: CHEMIN,
    motsCles: ["retribution", "retribution test", "jungle", "Lord", "Turtle", "timing", "Mobile Legends", "MLBB"],
  });
}

const titreSection = "font-titre text-2xl font-bold text-craie-100";

export default async function PageChatiment({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const entier = new Intl.NumberFormat(locale);
  const donneesStructurees = donneesOutil(locale, {
    nom: t("pages.chatiment.titre"),
    description: t("pages.seo.chatiment.description"),
    chemin: CHEMIN,
    categorie: "GameApplication",
  });
  const niveaux = Array.from({ length: NIVEAU_MAX - NIVEAU_MIN + 1 }, (_, i) => NIVEAU_MIN + i);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage titre={t("pages.chatiment.titre")} chapeau={t("pages.chatiment.chapeau")} />
      <div className="mx-auto max-w-4xl space-y-14 px-4 py-10">
        <EntraineurChatiment adresse={`${site.url}/${locale}${CHEMIN}`} />

        <section aria-labelledby="regles-titre">
          <h2 id="regles-titre" className={titreSection}>
            {t("pages.chatiment.reglesTitre")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <div className="mt-4 space-y-3 leading-relaxed text-craie-300">
            <p>{t("pages.chatiment.regle1")}</p>
            <p>{t("pages.chatiment.regle2", { recharge: RECHARGE_CHATIMENT_S })}</p>
            <p>
              {t("pages.chatiment.regle3", {
                precision: POIDS_PRECISION,
                vitesse: POIDS_VITESSE,
                pleine: REACTION_PLEINE_MS,
                nulle: entier.format(REACTION_NULLE_MS),
              })}
            </p>
            <p>{t("pages.chatiment.regle4", { n: MANCHES_PAR_SERIE })}</p>
          </div>
        </section>

        <section aria-labelledby="valeurs-titre">
          <h2 id="valeurs-titre" className={titreSection}>
            {t("pages.chatiment.valeursTitre")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-craie-300">
            {t("pages.chatiment.degatsIntro", { base: CHATIMENT_BASE, parNiveau: CHATIMENT_PAR_NIVEAU })}
          </p>
          <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {niveaux.map((n) => (
              <li key={n} className="biseau-sm border border-nuit-700/70 bg-nuit-900/60 px-3 py-2 text-center">
                <span className="block text-xs text-craie-500">{t("pages.chatiment.niveau", { n })}</span>
                <span className="font-titre text-lg font-bold tabular-nums text-craie-100">
                  {entier.format(degatsChatiment(n))}
                </span>
              </li>
            ))}
          </ol>

          <h3 className="mt-10 font-titre text-xl font-bold text-craie-100">{t("pages.chatiment.monstresTitre")}</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-left text-sm">
              <thead className="border-b border-nuit-700 text-xs uppercase tracking-wide text-craie-500">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.chatiment.colObjectif")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.chatiment.colPv")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.chatiment.colSegment")}</th>
                  <th scope="col" className="py-2 font-medium">{t("pages.chatiment.colSource")}</th>
                </tr>
              </thead>
              <tbody>
                {CLES_OBJECTIFS.map((cle) => {
                  const o = OBJECTIFS[cle];
                  return (
                    <tr key={cle} className="border-b border-nuit-800">
                      <th scope="row" className="py-2.5 pr-4 font-medium text-craie-100">
                        {t(`outils.chatiment.objectif.${cle}`)}
                      </th>
                      <td className="py-2.5 pr-4 tabular-nums text-craie-200">{entier.format(o.pv)}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-craie-300">{entier.format(o.segment)}</td>
                      <td className="py-2.5">
                        <a href={o.source} rel="noopener" className="text-craie-400 underline transition-colors hover:text-or-400">
                          {t("pages.chatiment.wiki")}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-craie-500">{t("pages.chatiment.monstresNote")}</p>

          <h3 className="mt-10 font-titre text-xl font-bold text-craie-100">{t("pages.chatiment.difficultesTitre")}</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-left text-sm">
              <thead className="border-b border-nuit-700 text-xs uppercase tracking-wide text-craie-500">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.chatiment.colDifficulte")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.chatiment.colAdverse")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.chatiment.colRepere")}</th>
                  <th scope="col" className="py-2 font-medium">{t("pages.chatiment.colPvChiffres")}</th>
                </tr>
              </thead>
              <tbody>
                {DIFFICULTES_ORDRE.map((d) => {
                  const r = REGLAGES[d];
                  return (
                    <tr key={d} className="border-b border-nuit-800">
                      <th scope="row" className="py-2.5 pr-4 font-medium text-craie-100">
                        {t(`outils.chatiment.difficulte.${d}`)}
                      </th>
                      <td className="py-2.5 pr-4 tabular-nums text-craie-200">
                        {entier.format(r.reactionAdverse[0])}–{entier.format(r.reactionAdverse[1])} ms
                      </td>
                      <td className="py-2.5 pr-4 text-craie-300">
                        {r.repere ? t("pages.chatiment.oui") : t("pages.chatiment.non")}
                      </td>
                      <td className="py-2.5 text-craie-300">
                        {r.pvChiffres ? t("pages.chatiment.oui") : t("pages.chatiment.non")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-craie-500">{t("pages.chatiment.valeursEntrainement")}</p>
        </section>

        <section aria-labelledby="sources-titre" className="border-t border-nuit-800 pt-6 text-sm text-craie-500">
          <h2 id="sources-titre" className="font-semibold text-craie-300">{t("pages.chatiment.sourcesTitre")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <a href={SOURCE_CHATIMENT} rel="noopener" className="underline transition-colors hover:text-or-400">
                {t("pages.chatiment.sourceChatiment")}
              </a>
            </li>
            <li>{t("pages.chatiment.sourceMonstres")}</li>
          </ul>
        </section>
      </div>
    </>
  );
}
