import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { laneOfSlug, SLUGS_LANE } from "@/lib/tier-list-filters";
import { metaTierList, TierList } from "../../content";

type Params = { params: Promise<{ locale: Locale; lane: string }> };

/** One page per lane, all ranks combined: "/tier-list/lane/jungle". */
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(SLUGS_LANE).map((lane) => ({ lane }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, lane } = await params;
  const value = laneOfSlug(lane);
  return value ? metaTierList(locale, "all", { type: "lane", value }) : {};
}

export default async function TierListLanePage({ params }: Params) {
  const { locale, lane } = await params;
  const value = laneOfSlug(lane);
  if (!value) notFound();
  return <TierList locale={locale} rank="all" filter={{ type: "lane", value }} />;
}
