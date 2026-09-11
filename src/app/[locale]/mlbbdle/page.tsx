import type { Metadata } from "next";
import Link from "@/components/lien";
import { Mlbbdle } from "@/components/mlbbdle";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { donneesLd } from "@/lib/html";
import { COLONNES, FENETRE, INDICES_COMPETENCE } from "@/lib/mlbbdle";
import { rosterMlbbdle } from "@/lib/mlbbdle-donnees";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.mlbbdle.titre"),
    description: t("pages.seo.mlbbdle.description"),
    chemin: "/mlbbdle",
    motsCles: ["mlbbdle", "mobile legends wordle", "guess the MLBB hero", "MLBB loldle", "daily hero guessing game"],
  });
}

export default async function PageMlbbdle({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const { heros, libelles } = rosterMlbbdle(locale);
  // Un jeu jouable dans le navigateur : application web et jeu a la fois.
  const donneesStructurees = {
    ...donneesOutil(locale, {
      nom: t("pages.mlbbdle.titre"),
      description: t("pages.seo.mlbbdle.description"),
      chemin: "/mlbbdle",
      categorie: "GameApplication",
    }),
    "@type": ["WebApplication", "Game"],
    genre: "Puzzle",
  };
  const titre2 = "font-titre text-2xl font-bold text-craie-100";
  const lien = "font-semibold text-or-400 transition-colors hover:text-or-500";
  const seuils = Object.fromEntries(INDICES_COMPETENCE.map((i) => [i.cle, i.seuil]));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage
        titre={t("pages.mlbbdle.titre")}
        chapeau={t("pages.mlbbdle.chapeau")}
        miettes={[{ nom: t("pages.mlbbdle.miette") }]}
      />
      <div className="mx-auto max-w-4xl space-y-14 px-4 py-10">
        <CompleterMessages messages={messagesPage(locale, ["pages.mlbbdleUI"])}>
          <Mlbbdle heros={heros} libelles={libelles} />
        </CompleterMessages>

        <section aria-labelledby="comment-jouer">
          <h2 id="comment-jouer" className={titre2}>
            {t("pages.mlbbdle.reglesTitre")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-craie-300">
            <li>{t("pages.mlbbdle.regle1")}</li>
            <li>{t("pages.mlbbdle.regle2")}</li>
            <li>{t("pages.mlbbdle.regle3", { jours: FENETRE })}</li>
            <li>{t("pages.mlbbdle.regle4")}</li>
          </ul>
          <h3 className="mt-6 font-semibold text-craie-100">{t("pages.mlbbdle.couleursTitre")}</h3>
          <ul className="mt-3 grid gap-2 text-sm text-craie-300 sm:grid-cols-2">
            {(
              [
                ["oui", "bg-emerald-700"],
                ["partiel", "bg-orange-700"],
                ["non", "bg-red-800"],
                ["inconnu", "bg-nuit-700"],
              ] as const
            ).map(([verdict, fond]) => (
              <li key={verdict} className="flex items-start gap-3">
                <span aria-hidden className={`mt-0.5 size-5 shrink-0 ${fond}`} />
                <span>{t(`pages.mlbbdle.couleurs.${verdict}`)}</span>
              </li>
            ))}
            <li className="flex items-start gap-3 sm:col-span-2">
              <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center bg-red-800 text-xs text-white">
                ↑
              </span>
              <span>{t("pages.mlbbdle.couleurs.fleche")}</span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="colonnes">
          <h2 id="colonnes" className={titre2}>
            {t("pages.mlbbdle.colonnesTitre")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {COLONNES.map((c) => (
              <div key={c}>
                <dt className="font-semibold text-craie-100">{t(`pages.mlbbdleUI.colonnes.${c}`)}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-craie-300">{t(`pages.mlbbdle.colonnesDesc.${c}`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="modes">
          <h2 id="modes" className={titre2}>
            {t("pages.mlbbdle.modesTitre")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="font-semibold text-craie-100">{t("pages.mlbbdleUI.modes.classique")}</dt>
              <dd className="mt-1 leading-relaxed text-craie-300">{t("pages.mlbbdle.modesDesc.classique")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-craie-100">{t("pages.mlbbdleUI.modes.competence")}</dt>
              <dd className="mt-1 leading-relaxed text-craie-300">
                {t("pages.mlbbdle.modesDesc.competence", {
                  couleur: seuils.couleur,
                  nom: seuils.nom,
                  description: seuils.description,
                  roles: seuils.roles,
                })}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-craie-100">{t("pages.mlbbdleUI.modes.entrainement")}</dt>
              <dd className="mt-1 leading-relaxed text-craie-300">{t("pages.mlbbdle.modesDesc.entrainement")}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="source">
          <h2 id="source" className={titre2}>
            {t("pages.mlbbdle.sourceTitre")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-craie-300">{t("pages.mlbbdle.source")}</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link href="/heroes" className={lien}>
                {t("pages.mlbbdle.lienHeros")} →
              </Link>
            </li>
            <li>
              <Link href="/quiz" className={lien}>
                {t("pages.mlbbdle.lienQuiz")} →
              </Link>
            </li>
            <li>
              <Link href="/lore" className={lien}>
                {t("pages.mlbbdle.lienLore")} →
              </Link>
            </li>
            <li>
              <Link href="/tier-list" className={lien}>
                {t("pages.mlbbdle.lienTierList")} →
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
