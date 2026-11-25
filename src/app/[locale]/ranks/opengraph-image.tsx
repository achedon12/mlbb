import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { asJpeg } from "@/lib/og/assets";
import { ranksCard } from "@/lib/og/cards";
import { site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
// Re-encoded from the engine's PNG: a fraction of its weight (`asJpeg`).
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

/** Share image of the ranks. */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const image = await ranksCard(locale);
  if (!image) notFound();
  return asJpeg(image);
}
