import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { pagesAfterFirst, readPage } from "@/lib/pager";
import { BY_PAGE_EVENTS, Events, metaEvents, monthsTimeline, pagesEvents } from "../../content";

/** Older months of the timeline, two per page, each page prerendered. */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  return pagesAfterFirst(monthsTimeline().length, BY_PAGE_EVENTS);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, pagesEvents());
  return n ? metaEvents(locale, n) : {};
}

export default async function EventsPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, pagesEvents());
  if (!n) notFound();
  return <Events locale={locale} page={n} />;
}
