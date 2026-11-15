import { notFoundMetadata } from "@/i18n/seo";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { readPage } from "@/lib/pager";
import { metaSkins, pagesSkins, Skins } from "../../content";
import { NotFoundPage } from "@/components/not-found-page";

/** Pages 2 and beyond of the gallery, rendered on first request then cached. */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  // Rendered on first request, then cached (src/lib/prerender.ts).
  return [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, pagesSkins());
  return n ? metaSkins(locale, n) : notFoundMetadata(locale);
}

export default async function SkinsPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, pagesSkins());
  if (!n) return <NotFoundPage />;
  return <Skins locale={locale} page={n} />;
}
