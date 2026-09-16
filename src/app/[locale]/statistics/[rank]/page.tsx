import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExtendMessages } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";
import { messagesPage } from "@/i18n/translations";
import { isRank, metaStatistics, RANKS_MEASURED, Statistics } from "../content";

type Params = { params: Promise<{ locale: Locale; rank: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return RANKS_MEASURED.map((rank) => ({ rank }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, rank } = await params;
  return isRank(rank) ? metaStatistics(locale, rank) : {};
}

export default async function RankStatisticsPage({ params }: Params) {
  const { locale, rank } = await params;
  if (!isRank(rank)) notFound();
  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.heroesList", "pages.statisticsTable"])}>
      <Statistics locale={locale} rank={rank} />
    </ExtendMessages>
  );
}
