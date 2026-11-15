import { notFoundMetadata } from "@/i18n/seo";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { countItems } from "@/lib/data";
import { pagesAfterFirst, readPage, SIZE_CARDS } from "@/lib/pager";
import { Items, metaItems, pagesItems } from "../../content";
import { NotFoundPage } from "@/components/not-found-page";

/**
 * Pages 2 and beyond of the item catalogue. Prerendered like the first one,
 * and a 404 for a number outside the list rather than the same slice under a
 * second address.
 */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  return pagesAfterFirst(countItems, SIZE_CARDS);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, pagesItems());
  return n ? metaItems(locale, n) : notFoundMetadata(locale);
}

export default async function ItemsPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, pagesItems());
  if (!n) return <NotFoundPage />;
  return <Items locale={locale} page={n} />;
}
