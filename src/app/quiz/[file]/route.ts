import { NextResponse } from "next/server";
import { isLocale, LOCALES } from "@/i18n/config";
import { poolQuiz } from "@/lib/quiz-data";

/**
 * Vivier de l'entrainement du quiz, un fichier statique par langue
 * (`/quiz/fr.json`). Le navigateur ne le demande qu'en passant a
 * l'entrainement, et le garde pour rejouer hors ligne.
 *
 * L'adresse porte une extension : le proxy laisse passer les chemins a point
 * sans prefixe de langue (voir `src/proxy.ts`).
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ file: `${locale}.json` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const locale = (await params).file.replace(/\.json$/, "");
  if (!isLocale(locale)) return new NextResponse(null, { status: 404 });
  return NextResponse.json(poolQuiz(locale), { headers: { "Cache-Control": "public, max-age=3600" } });
}
