import { notFoundMetadata } from "@/i18n/seo";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { readPage } from "@/lib/pager";
import { Collection, metaCollection, pagesCollection } from "../../content";
import { NotFoundPage } from "@/components/not-found-page";

/**
 * A page of the hero list of the collection tool. The tool itself runs in the
 * browser, but its pager still points at real addresses: a middle click opens
 * one, and the page it names is the one the tool starts on.
 */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  // Rendered on first request, then cached (src/lib/prerender.ts).
  return [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, pagesCollection());
  return n ? metaCollection(locale, n) : notFoundMetadata(locale);
}

export default async function CollectionPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, pagesCollection());
  if (!n) return <NotFoundPage />;
  return <Collection locale={locale} page={n} />;
}
