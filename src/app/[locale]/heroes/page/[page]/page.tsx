import { notFoundMetadata } from "@/i18n/seo";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { allHeroes } from "@/lib/data";
import { pagesAfterFirst, readPage, SIZE_CARDS } from "@/lib/pager";
import { Heroes, metaHeroes, pagesHeroes } from "../../content";
import { NotFoundPage } from "@/components/not-found-page";

/**
 * Pages 2 and beyond of the catalogue. Prerendered like the first one — five
 * more pages per language, not a route rendered on every request — and, for a
 * number outside the list, a 404 rather than the same slice under a second
 * address.
 */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  return pagesAfterFirst(allHeroes.length, SIZE_CARDS);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, pagesHeroes());
  return n ? metaHeroes(locale, n) : notFoundMetadata(locale);
}

export default async function HeroesPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, pagesHeroes());
  if (!n) return <NotFoundPage />;
  return <Heroes locale={locale} page={n} />;
}
