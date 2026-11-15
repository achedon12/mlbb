import { notFoundMetadata } from "@/i18n/seo";
import type { Metadata } from "next";
import { ExtendMessages } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";
import { messagesPage } from "@/i18n/translations";
import { readPage } from "@/lib/pager";
import { metaStatistics, pagesStatistics, Statistics } from "../../content";
import { NotFoundPage } from "@/components/not-found-page";

/** Pages 2 and beyond of the all-ranks table, rendered on first request then cached. */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  // Rendered on first request, then cached (src/lib/prerender.ts).
  return [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, pagesStatistics("all"));
  return n ? metaStatistics(locale, "all", n) : notFoundMetadata(locale);
}

export default async function StatisticsPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, pagesStatistics("all"));
  if (!n) return <NotFoundPage />;
  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.heroesList", "pages.statisticsTable"])}>
      <Statistics locale={locale} rank="all" page={n} />
    </ExtendMessages>
  );
}
