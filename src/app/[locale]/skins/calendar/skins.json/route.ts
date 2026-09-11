import { NextResponse } from "next/server";
import { LANGUES } from "@/i18n/config";
import { encoderIndex } from "@/lib/catalogue-skins";
import { catalogueSkins } from "@/lib/catalogue-skins-serveur";

/**
 * Index compact de tous les skins (heros, rarete, serie, date, prix,
 * portrait), un fichier statique par langue. Le calendrier ne le demande
 * qu'au premier filtre, le calculateur de collection a son ouverture : ni
 * l'un ni l'autre n'embarque le millier de skins dans sa page.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return LANGUES.map((locale) => ({ locale }));
}

export function GET() {
  return NextResponse.json(encoderIndex(catalogueSkins()));
}
