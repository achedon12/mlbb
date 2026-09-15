import { NextResponse } from "next/server";
import { LOCALES } from "@/i18n/config";
import { encodeIndex } from "@/lib/skin-catalog";
import { catalogSkins } from "@/lib/skin-catalog-server";

/**
 * Compact index of every skin (hero, rarity, series, date, price,
 * portrait), one static file per language. The calendar only requests it
 * on the first filter, the collection calculator when it opens: neither
 * one embeds the thousand skins in its page.
 */
export const dynamic = "force-static";
// One file per language, all generated at build time: any other language is
// a 404, not an index built on demand for a made-up locale (the dotted address
// bypasses the proxy, which would otherwise reject it).
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export function GET() {
  return NextResponse.json(encodeIndex(catalogSkins()));
}
