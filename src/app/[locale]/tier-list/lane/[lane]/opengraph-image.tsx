import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { asJpeg } from "@/lib/og/assets";
import { tierListCard } from "@/lib/og/cards";
import { laneOfSlug } from "@/lib/tier-list-filters";
import { site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
// Drawn over an artwork or portraits: a JPEG weighs a fraction of the PNG (`asJpeg`).
export const contentType = "image/jpeg";
// The page's metadata gives the translated text (`metaPage`, `card: true`).
export const alt = site.title;

// None is rendered at build time: each one on its first request, then kept
// a week (`OG_REVALIDATE`, src/lib/og/layout.ts). Only social network and
// messaging bots ask for them.
export const revalidate = 604800;

export function generateStaticParams() {
  return [];
}

/** Share image of a lane's tier list: its S+ heroes, in portraits. */
export default async function Image({ params }: { params: Promise<{ locale: string; lane: string }> }) {
  const { locale, lane } = await params;
  if (!isLocale(locale)) notFound();
  const value = laneOfSlug(lane);
  if (!value) notFound();
  return asJpeg(await tierListCard(locale, "all", { type: "lane", value }));
}
