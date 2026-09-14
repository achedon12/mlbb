import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { RANKS_CLASSES } from "@/lib/tier-list";
import { metaTierList, TierList } from "../content";

type Params = { params: Promise<{ locale: Locale; rank: string }> };

/** Une page par rang mesure ; « tous rangs » reste l'adresse principale. */
const RANKS = RANKS_CLASSES.filter((r) => r !== "all");
const isRank = (r: string): r is MeasuredRank => (RANKS as string[]).includes(r);

export const dynamicParams = false;

export function generateStaticParams() {
  return RANKS.map((rank) => ({ rank }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, rank } = await params;
  return isRank(rank) ? metaTierList(locale, rank) : {};
}

export default async function TierListRankPage({ params }: Params) {
  const { locale, rank } = await params;
  if (!isRank(rank)) notFound();
  return <TierList locale={locale} rank={rank} />;
}
