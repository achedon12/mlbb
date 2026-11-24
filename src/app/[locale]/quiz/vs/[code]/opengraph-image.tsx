import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { shareImage } from "@/lib/og/share-cards";
import { parseDuelCode } from "@/lib/quiz";
import { site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// The page's metadata gives the translated text (`metaPage`, `card: true`).
export const alt = site.title;

// Rendered on the first request of each link, then kept a week
// (`OG_REVALIDATE`, src/lib/og/layout.ts).
export const revalidate = 604800;

export function generateStaticParams() {
  return [];
}

/** Preview of a "challenge a friend" link: the score to beat, Dex pointing at it. */
export default async function Image({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  const duel = parseDuelCode(code);
  if (!isLocale(locale) || !duel) notFound();
  const image = await shareImage({
    locale,
    format: "landscape",
    card: { kind: "quiz", number: duel.number, points: duel.points, max: duel.max, rows: [], streak: 0, duel: true },
  });
  if (!image) notFound();
  return image;
}
