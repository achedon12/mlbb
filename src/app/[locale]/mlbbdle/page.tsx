import type { Metadata } from "next";
import Link from "@/components/lien";
import { Mlbbdle } from "@/components/mlbbdle";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { donneesLd } from "@/lib/html";
import { COLUMNS, SKILL_CLUES, WINDOW } from "@/lib/mlbbdle";
import { mlbbdleRoster } from "@/lib/mlbbdle-data";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.mlbbdle.title"),
    description: t("pages.seo.mlbbdle.description"),
    chemin: "/mlbbdle",
    motsCles: ["mlbbdle", "mobile legends wordle", "guess the MLBB hero", "MLBB loldle", "daily hero guessing game"],
  });
}

export default async function MlbbdlePage({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const { heroes, labels } = mlbbdleRoster(locale);
  // A game playable in the browser: both a web application and a game.
  const structuredData = {
    ...donneesOutil(locale, {
      nom: t("pages.mlbbdle.title"),
      description: t("pages.seo.mlbbdle.description"),
      chemin: "/mlbbdle",
      categorie: "GameApplication",
    }),
    "@type": ["WebApplication", "Game"],
    genre: "Puzzle",
  };
  const h2 = "font-titre text-2xl font-bold text-craie-100";
  const link = "font-semibold text-or-400 transition-colors hover:text-or-500";
  const thresholds = Object.fromEntries(SKILL_CLUES.map((c) => [c.key, c.threshold]));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(structuredData) }} />
      <EnTetePage
        titre={t("pages.mlbbdle.title")}
        chapeau={t("pages.mlbbdle.lead")}
        miettes={[{ nom: t("pages.mlbbdle.breadcrumb") }]}
      />
      <div className="mx-auto max-w-4xl space-y-14 px-4 py-10">
        <CompleterMessages messages={messagesPage(locale, ["pages.mlbbdleUI"])}>
          <Mlbbdle heroes={heroes} labels={labels} />
        </CompleterMessages>

        <section aria-labelledby="how-to-play">
          <h2 id="how-to-play" className={h2}>
            {t("pages.mlbbdle.rulesTitle")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-craie-300">
            <li>{t("pages.mlbbdle.rule1")}</li>
            <li>{t("pages.mlbbdle.rule2")}</li>
            <li>{t("pages.mlbbdle.rule3", { days: WINDOW })}</li>
            <li>{t("pages.mlbbdle.rule4")}</li>
          </ul>
          <h3 className="mt-6 font-semibold text-craie-100">{t("pages.mlbbdle.coloursTitle")}</h3>
          <ul className="mt-3 grid gap-2 text-sm text-craie-300 sm:grid-cols-2">
            {(
              [
                ["match", "bg-emerald-700"],
                ["partial", "bg-orange-700"],
                ["miss", "bg-red-800"],
                ["unknown", "bg-nuit-700"],
              ] as const
            ).map(([verdict, background]) => (
              <li key={verdict} className="flex items-start gap-3">
                <span aria-hidden className={`mt-0.5 size-5 shrink-0 ${background}`} />
                <span>{t(`pages.mlbbdle.colours.${verdict}`)}</span>
              </li>
            ))}
            <li className="flex items-start gap-3 sm:col-span-2">
              <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center bg-red-800 text-xs text-white">
                ↑
              </span>
              <span>{t("pages.mlbbdle.colours.arrow")}</span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="columns">
          <h2 id="columns" className={h2}>
            {t("pages.mlbbdle.columnsTitle")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {COLUMNS.map((c) => (
              <div key={c}>
                <dt className="font-semibold text-craie-100">{t(`pages.mlbbdleUI.columns.${c}`)}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-craie-300">{t(`pages.mlbbdle.columnsDesc.${c}`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="modes">
          <h2 id="modes" className={h2}>
            {t("pages.mlbbdle.modesTitle")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="font-semibold text-craie-100">{t("pages.mlbbdleUI.modes.classic")}</dt>
              <dd className="mt-1 leading-relaxed text-craie-300">{t("pages.mlbbdle.modesDesc.classic")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-craie-100">{t("pages.mlbbdleUI.modes.skill")}</dt>
              <dd className="mt-1 leading-relaxed text-craie-300">
                {t("pages.mlbbdle.modesDesc.skill", {
                  colour: thresholds.colour,
                  name: thresholds.name,
                  description: thresholds.description,
                  roles: thresholds.roles,
                })}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-craie-100">{t("pages.mlbbdleUI.modes.practice")}</dt>
              <dd className="mt-1 leading-relaxed text-craie-300">{t("pages.mlbbdle.modesDesc.practice")}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="source">
          <h2 id="source" className={h2}>
            {t("pages.mlbbdle.sourceTitle")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-craie-300">{t("pages.mlbbdle.source")}</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link href="/heroes" className={link}>
                {t("pages.mlbbdle.linkHeroes")} →
              </Link>
            </li>
            <li>
              <Link href="/quiz" className={link}>
                {t("pages.mlbbdle.linkQuiz")} →
              </Link>
            </li>
            <li>
              <Link href="/lore" className={link}>
                {t("pages.mlbbdle.linkLore")} →
              </Link>
            </li>
            <li>
              <Link href="/tier-list" className={link}>
                {t("pages.mlbbdle.linkTierList")} →
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
