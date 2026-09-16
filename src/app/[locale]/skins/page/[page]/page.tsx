import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { heroesWithSkins } from "@/lib/hero-skins";
import { pagesAfterFirst, readPage } from "@/lib/pager";
import { BY_PAGE_SKINS, metaSkins, pagesSkins, Skins } from "../../content";

/** Pages 2 and beyond of the gallery, prerendered like the first one. */
type Params = { params: Promise<{ locale: Locale; page: string }> };

export function generateStaticParams() {
  return pagesAfterFirst(heroesWithSkins.length, BY_PAGE_SKINS);
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
