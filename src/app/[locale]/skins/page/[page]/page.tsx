import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { readPage } from "@/lib/pager";
import { metaSkins, pagesSkins, Skins } from "../../content";

/** Pages 2 and beyond of the gallery, rendered on first request then cached. */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  // Rendered on first request, then cached (src/lib/prerender.ts).
  return [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, page } = await params;
  const n = readPage(page, pagesSkins());
  return n ? metaSkins(locale, n) : {};
}

export default async function SkinsPagePage({ params }: Params) {
  const { locale, page } = await params;
  const n = readPage(page, pagesSkins());
  if (!n) notFound();
  return <Skins locale={locale} page={n} />;
}
