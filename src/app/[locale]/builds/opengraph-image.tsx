import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { asJpeg } from "@/lib/og/assets";
import { buildsCard } from "@/lib/og/cards";
import { site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
// Drawn over an artwork or portraits: a JPEG weighs a fraction of the PNG (`asJpeg`).
export const contentType = "image/jpeg";
// The page's metadata gives the translated text (`metaPage`, `card: true`).
export const alt = site.title;

// None is rendered at build time: each one on its first request, then kept
// a day, as builds and votes keep coming. Only social network and messaging
// bots ask for them.
export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

/** Share image of the community builds hub: the heroes with the most builds, the count of builds. */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return asJpeg(await buildsCard(locale));
}
