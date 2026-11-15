import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { readPage } from "@/lib/pager";
import { Events, metaEvents, pagesEvents } from "../../content";

/** Older months of the timeline, two per page, each page rendered on first request then cached. */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  // Rendered on first request, then cached (src/lib/prerender.ts).
  return [];
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
