import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExtendMessages } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";
import { messagesPage } from "@/i18n/translations";
import { readPage } from "@/lib/pager";
import { isRank, metaStatistics, pagesStatistics, Statistics } from "../../../content";

/**
 * Pages 2 and beyond of one rank's table. Every rank crosses every page: six
 * ranks of seven pages per language, each rendered on its first request and
 * then cached, never on every request.
 */
type Params = { params: Promise<{ locale: Locale; rank: string; page: string }> };

// Rendered on demand past the prerendered pages: with the parameters frozen,
// an unknown page took Next's internal no-fallback path, which answers 404 but
// logs `NoFallbackError` on every hit. The page checks the rank and the page
// number itself and calls `notFound()`, which is the same 404, quietly.
export const dynamicParams = true;

export function generateStaticParams() {
  // Rendered on first request, then cached (src/lib/prerender.ts).
  return [];
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
