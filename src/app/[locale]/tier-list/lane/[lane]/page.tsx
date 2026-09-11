import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Langue } from "@/i18n/config";
import { laneDuSlug, SLUGS_LANE } from "@/lib/filtres-tier-list";
import { metaTierList, TierList } from "../../contenu";

type Params = { params: Promise<{ locale: Langue; lane: string }> };

/** Une page par lane, tous rangs confondus : « /tier-list/lane/jungle ». */
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(SLUGS_LANE).map((lane) => ({ lane }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, lane } = await params;
  const valeur = laneDuSlug(lane);
  return valeur ? metaTierList(locale, "all", { type: "lane", valeur }) : {};
}

export default async function PageTierListLane({ params }: Params) {
  const { locale, lane } = await params;
  const valeur = laneDuSlug(lane);
  if (!valeur) notFound();
  return <TierList locale={locale} rang="all" filtre={{ type: "lane", valeur }} />;
}
