import type { Metadata } from "next";
import Link from "@/components/lien";
import { QuizMlbb } from "@/components/quiz-mlbb";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { donneesLd } from "@/lib/html";
import { ESSAIS, ORDRE_DEFI, PAIRES_DUEL } from "@/lib/quiz";
import { rosterQuiz } from "@/lib/quiz-donnees";

type Params = { params: Promise<{ locale: Langue }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.quiz.title"),
    description: t("pages.seo.quiz.description"),
    chemin: "/quiz",
    motsCles: ["quiz", "guess the hero", "daily", "Mobile Legends", "MLBB"],
  });
}

export default async function PageQuiz({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const { heros, objets } = rosterQuiz(locale);
  // Un jeu jouable dans le navigateur : application web et jeu a la fois.
  const donneesStructurees = {
    ...donneesOutil(locale, {
      nom: t("pages.quiz.title"),
      description: t("pages.seo.quiz.description"),
      chemin: "/quiz",
      categorie: "GameApplication",
    }),
    "@type": ["WebApplication", "Game"],
    genre: "Trivia",
  };
  const titre2 = "font-heading text-2xl font-bold text-chalk-100";
  const lien = "font-semibold text-gold-400 transition-colors hover:text-gold-500";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage
        titre={t("pages.quiz.title")}
        chapeau={t("pages.quiz.lead")}
        miettes={[{ nom: t("pages.quiz.crumb") }]}
      />
      <div className="mx-auto max-w-3xl space-y-14 px-4 py-10">
        <CompleterMessages messages={messagesPage(locale, ["pages.quizUI"])}>
          <QuizMlbb heros={heros} objets={objets} />
        </CompleterMessages>

        <section>
          <h2 className={titre2}>{t("pages.quiz.rulesTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-chalk-300">
            <li>{t("pages.quiz.rule1")}</li>
            <li>{t("pages.quiz.rule2", { heros: ESSAIS.competence, objets: ESSAIS.objet })}</li>
            <li>{t("pages.quiz.rule3")}</li>
            <li>{t("pages.quiz.rule4")}</li>
          </ul>
        </section>

        <section>
          <h2 className={titre2}>{t("pages.quiz.challengesTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <dl className="mt-4 space-y-4">
            {ORDRE_DEFI.map((type) => (
              <div key={type}>
                <dt className="font-semibold text-chalk-100">{t(`pages.quiz.challenges.${type}.title`)}</dt>
                <dd className="mt-1 leading-relaxed text-chalk-300">
                  {t(`pages.quiz.challenges.${type}.desc`, { n: PAIRES_DUEL })}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className={titre2}>{t("pages.quiz.sourceTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-chalk-300">{t("pages.quiz.source")}</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link href="/heroes" className={lien}>
                {t("pages.quiz.heroesLink")} →
              </Link>
            </li>
            <li>
              <Link href="/items" className={lien}>
                {t("pages.quiz.itemsLink")} →
              </Link>
            </li>
            <li>
              <Link href="/tier-list" className={lien}>
                {t("pages.quiz.tierListLink")} →
              </Link>
            </li>
            <li>
              <Link href="/tools/tier-list-maker" className={lien}>
                {t("pages.quiz.makerLink")} →
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
