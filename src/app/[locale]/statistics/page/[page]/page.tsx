import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExtendMessages } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";
import { messagesPage } from "@/i18n/translations";
import { pagesAfterFirst, readPage, SIZE_ROWS_CARDS } from "@/lib/pager";
import { metaStatistics, pagesStatistics, rowsStatistics, Statistics } from "../../content";

/** Pages 2 and beyond of the all-ranks table, prerendered like the first one. */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  return pagesAfterFirst(rowsStatistics("all").length, SIZE_ROWS_CARDS);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, pagesStatistics("all"));
  return n ? metaStatistics(locale, "all", n) : {};
}

export default async function StatisticsPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, pagesStatistics("all"));
  if (!n) notFound();
  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.heroesList", "pages.statisticsTable"])}>
      <Statistics locale={locale} rank="all" page={n} />
    </ExtendMessages>
  );
}
