import { NextResponse } from "next/server";
import { LOCALES } from "@/i18n/config";
import { encodeIndex } from "@/lib/skin-catalog";
import { catalogSkins } from "@/lib/skin-catalog-server";

/**
 * Index compact de tous les skins (heros, rarete, serie, date, prix,
 * portrait), un fichier statique par langue. Le calendrier ne le demande
 * qu'au premier filtre, le calculateur de collection a son ouverture : ni
 * l'un ni l'autre n'embarque le millier de skins dans sa page.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export function GET() {
  return NextResponse.json(encodeIndex(catalogSkins()));
}
