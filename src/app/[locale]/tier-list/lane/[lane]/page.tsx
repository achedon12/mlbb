import { notFoundMetadata, withCard } from "@/i18n/seo";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { laneOfSlug, SLUGS_LANE, pathFilter } from "@/lib/tier-list-filters";
import { metaTierList, TierList } from "../../content";
import { NotFoundPage } from "@/components/not-found-page";

type Params = { params: Promise<{ locale: Locale; lane: string }> };

/** One page per lane, all ranks combined: "/tier-list/lane/jungle". */
export function generateStaticParams() {
  return Object.values(SLUGS_LANE).map((lane) => ({ lane }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, lane } = await params;
  const value = laneOfSlug(lane);
  if (!value) return notFoundMetadata(locale);
  const filter = { type: "lane", value } as const;
  // Its own share card (`opengraph-image.tsx` next to this page), not the home one.
  return withCard(metaTierList(locale, "all", filter), locale, pathFilter(filter));
}

export default async function TierListLanePage({ params }: Params) {
  const { locale, lane } = await params;
  const value = laneOfSlug(lane);
  if (!value) return <NotFoundPage />;
  return <TierList locale={locale} rank="all" filter={{ type: "lane", value }} />;
}
