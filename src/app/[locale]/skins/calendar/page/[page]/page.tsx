import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { pagesAfterFirst, readPage } from "@/lib/pager";
import { metaCalendar, pagesCalendar, SERIES_BY_PAGE, SERIES_LISTED, SkinsCalendar } from "../../content";

/** Second page of the series list, prerendered like the first one. */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  return pagesAfterFirst(SERIES_LISTED, SERIES_BY_PAGE);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, pagesCalendar());
  return n ? metaCalendar(locale, n) : {};
}

export default async function SkinsCalendarPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, pagesCalendar());
  if (!n) notFound();
  return <SkinsCalendar locale={locale} page={n} />;
}
