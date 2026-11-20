import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { tournamentCard } from "@/lib/og/cards";
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

/** Share image of a tournament: its most picked heroes and its winner. */
export default async function Image({ params }: { params: Promise<{ locale: string; tournament: string }> }) {
  const { locale, tournament } = await params;
  if (!isLocale(locale)) notFound();
  const image = await tournamentCard(locale, tournament);
  if (!image) notFound();
  return image;
}
