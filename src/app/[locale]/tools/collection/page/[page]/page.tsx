import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { catalogSkins } from "@/lib/skin-catalog-server";
import { pagesAfterFirst, readPage, SIZE_CARDS } from "@/lib/pager";
import { Collection, metaCollection, pagesCollection } from "../../content";

/**
 * A page of the hero list of the collection tool. The tool itself runs in the
 * browser, but its pager still points at real addresses: a middle click opens
 * one, and the page it names is the one the tool starts on.
 */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  return pagesAfterFirst(catalogSkins().heroes.length, SIZE_CARDS);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, pagesCollection());
  return n ? metaCollection(locale, n) : {};
}

export default async function CollectionPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, pagesCollection());
  if (!n) notFound();
  return <Collection locale={locale} page={n} />;
}
