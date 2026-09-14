import type { Metadata } from "next";
import Link from "@/components/link";
import { QuizMlbb } from "@/components/mlbb-quiz";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { dataTool, metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { serializeJsonLd } from "@/lib/html";
import { ATTEMPTS, ORDER_CHALLENGE, PAIRS_DUEL } from "@/lib/quiz";
import { rosterQuiz } from "@/lib/quiz-data";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.quiz.title"),
    description: t("pages.seo.quiz.description"),
    path: "/quiz",
    keywords: ["quiz", "guess the hero", "daily", "Mobile Legends", "MLBB"],
  });
}

export default async function QuizPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const { heroes, items } = rosterQuiz(locale);
  // A game playable in the browser: both a web application and a game.
  const structuredData = {
    ...dataTool(locale, {
      name: t("pages.quiz.title"),
      description: t("pages.seo.quiz.description"),
      path: "/quiz",
      category: "GameApplication",
    }),
    "@type": ["WebApplication", "Game"],
    genre: "Trivia",
  };
  const heading2 = "font-heading text-2xl font-bold text-chalk-100";
  const link = "font-semibold text-gold-400 transition-colors hover:text-gold-500";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader
        title={t("pages.quiz.title")}
        lead={t("pages.quiz.lead")}
        crumbs={[{ name: t("pages.quiz.crumb") }]}
      />
      <div className="mx-auto max-w-3xl space-y-14 px-4 py-10">
        <ExtendMessages messages={messagesPage(locale, ["pages.quizUI"])}>
          <QuizMlbb heroes={heroes} items={items} />
        </ExtendMessages>

        <section>
          <h2 className={heading2}>{t("pages.quiz.rulesTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-chalk-300">
            <li>{t("pages.quiz.rule1")}</li>
            <li>{t("pages.quiz.rule2", { heros: ATTEMPTS.skill, objets: ATTEMPTS.item })}</li>
            <li>{t("pages.quiz.rule3")}</li>
            <li>{t("pages.quiz.rule4")}</li>
          </ul>
        </section>

        <section>
          <h2 className={heading2}>{t("pages.quiz.challengesTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <dl className="mt-4 space-y-4">
            {ORDER_CHALLENGE.map((type) => (
              <div key={type}>
                <dt className="font-semibold text-chalk-100">{t(`pages.quiz.challenges.${type}.title`)}</dt>
                <dd className="mt-1 leading-relaxed text-chalk-300">
                  {t(`pages.quiz.challenges.${type}.desc`, { n: PAIRS_DUEL })}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className={heading2}>{t("pages.quiz.sourceTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-4 leading-relaxed text-chalk-300">{t("pages.quiz.source")}</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link href="/heroes" className={link}>
                {t("pages.quiz.heroesLink")} →
              </Link>
            </li>
            <li>
              <Link href="/items" className={link}>
                {t("pages.quiz.itemsLink")} →
              </Link>
            </li>
            <li>
              <Link href="/tier-list" className={link}>
                {t("pages.quiz.tierListLink")} →
              </Link>
            </li>
            <li>
              <Link href="/tools/tier-list-maker" className={link}>
                {t("pages.quiz.makerLink")} →
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
