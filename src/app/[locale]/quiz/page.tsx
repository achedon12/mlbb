import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { QuizContent } from "./content";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.quiz.title"),
    description: t("pages.seo.quiz.description"),
    path: "/quiz",
    card: true,
    keywords: ["quiz", "guess the hero", "daily", "Mobile Legends", "MLBB"],
  });
}

export default async function QuizPage({ params }: Params) {
  const { locale } = await params;
  return <QuizContent locale={locale} />;
}
