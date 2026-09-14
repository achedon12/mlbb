import type { Metadata } from "next";
import { ExtendMessages } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";
import { messagesPage } from "@/i18n/translations";
import { metaStatistics, Statistics } from "./content";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return metaStatistics(locale, "all");
}

export default async function StatisticsPage({ params }: Params) {
  const { locale } = await params;
  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.heroesList", "pages.statisticsTable"])}>
      <Statistics locale={locale} rank="all" />
    </ExtendMessages>
  );
}
