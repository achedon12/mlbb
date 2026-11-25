import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { asJpeg } from "@/lib/og/assets";
import { calendarCard } from "@/lib/og/cards";
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

/** Share image of the skins calendar: the latest skin's artwork and the count of skins released. */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const image = await calendarCard(locale, null);
  if (!image) notFound();
  return asJpeg(image);
}
