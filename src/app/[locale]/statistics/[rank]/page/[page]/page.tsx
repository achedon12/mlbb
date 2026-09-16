import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExtendMessages } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";
import { messagesPage } from "@/i18n/translations";
import { pagesAfterFirst, readPage, SIZE_ROWS_CARDS } from "@/lib/pager";
import {
  isRank,
  metaStatistics,
  pagesStatistics,
  RANKS_MEASURED,
  rowsStatistics,
  Statistics,
} from "../../../content";

/**
 * Pages 2 and beyond of one rank's table. Every rank crosses every page: six
 * ranks of seven pages is a handful of prerendered routes per language, not a
 * route rendered on every request.
 */
type Params = { params: Promise<{ locale: Locale; rank: string; page: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return RANKS_MEASURED.flatMap((rank) =>
    pagesAfterFirst(rowsStatistics(rank).length, SIZE_ROWS_CARDS).map(({ page }) => ({ rank, page })),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, rank, page } = await params;
  if (!isRank(rank)) return {};
  const n = readPage(page, pagesStatistics(rank));
  return n ? metaStatistics(locale, rank, n) : {};
}

export default async function RankStatisticsPagePage({ params }: Params) {
  const { locale, rank, page } = await params;
  if (!isRank(rank)) notFound();
  const n = readPage(page, pagesStatistics(rank));
  if (!n) notFound();
  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.heroesList", "pages.statisticsTable"])}>
      <Statistics locale={locale} rank={rank} page={n} />
    </ExtendMessages>
  );
}
