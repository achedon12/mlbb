import type { Metadata } from "next";
import { NotFoundPage } from "@/components/not-found-page";
import { isLocale, type Locale } from "@/i18n/config";
import { metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { parseDuelCode } from "@/lib/quiz";
import { QuizContent } from "../../content";

/**
 * "Challenge a friend" link: `/quiz/vs/75-5-7` is challenge #75 (its number
 * is the seed of its questions) and a score of 5 out of 7 to beat. The page
 * plays that very challenge; the sharer's name, when they gave one, rides in
 * the query (`?by=`) and is only read by the browser, so every link of a
 * score shares one cached page and one preview image.
 *
 * Not indexed: thousands of links, all the same game as `/quiz`.
 */
type Params = { params: Promise<{ locale: Locale; code: string }> };

// Drawn on the first visit of each link, then kept a week.
export const revalidate = 604800;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, code } = await params;
  const duel = parseDuelCode(code);
  if (!isLocale(locale) || !duel) return notFoundMetadata(locale);
  const t = createT(locale);
  const score = `${duel.points}/${duel.max}`;
  return {
    ...metaPage(locale, {
      title: t("pages.seo.quizDuel.title", { score, n: duel.number }),
      description: t("pages.seo.quizDuel.description", { score }),
      path: `/quiz/vs/${code}`,
      card: true,
    }),
    robots: { index: false, follow: true },
  };
}

export default async function QuizDuelPage({ params }: Params) {
  const { locale, code } = await params;
  const duel = parseDuelCode(code);
  if (!isLocale(locale) || !duel) return <NotFoundPage />;
  return <QuizContent locale={locale} duel={duel} />;
}
