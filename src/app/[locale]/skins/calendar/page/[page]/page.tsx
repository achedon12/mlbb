import { notFoundMetadata } from "@/i18n/seo";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { readPage } from "@/lib/pager";
import { metaCalendar, pagesCalendar, SkinsCalendar } from "../../content";
import { NotFoundPage } from "@/components/not-found-page";

/** Second page of the series list, rendered on first request then cached. */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  // Rendered on first request, then cached (src/lib/prerender.ts).
  return [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, pagesCalendar());
  return n ? metaCalendar(locale, n) : notFoundMetadata(locale);
}

export default async function SkinsCalendarPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, pagesCalendar());
  if (!n) return <NotFoundPage />;
  return <SkinsCalendar locale={locale} page={n} />;
}
