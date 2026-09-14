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

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export function GET() {
  return NextResponse.json(encodeIndex(catalogSkins()));
}
