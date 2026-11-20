import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { statisticsCard } from "@/lib/og/cards";
import { RANKS_CLASSES } from "@/lib/tier-list";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// The page's metadata gives the translated text (`metaPage`, `card: true`).
export const alt = site.title;

// None is rendered at build time: each one on its first request, then kept
// a week (`OG_REVALIDATE`, src/lib/og/layout.ts). Only social network and
// messaging bots ask for them.
export const revalidate = 604800;

export function generateStaticParams() {
  return [];
}

/** Share image of a rank's statistics: its best win rate. */
export default async function Image({ params }: { params: Promise<{ locale: string; rank: string }> }) {
  const { locale, rank } = await params;
  if (!isLocale(locale)) notFound();
  const known = RANKS_CLASSES.find((r): r is MeasuredRank => r === rank && r !== "all");
  if (!known) notFound();
  return statisticsCard(locale, known);
}
