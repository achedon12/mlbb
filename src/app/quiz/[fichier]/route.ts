import { NextResponse } from "next/server";
import { estLangue, LANGUES } from "@/i18n/config";
import { poolQuiz } from "@/lib/quiz-donnees";

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
  return LANGUES.map((langue) => ({ fichier: `${langue}.json` }));
}

export async function GET(_requete: Request, { params }: { params: Promise<{ fichier: string }> }) {
  const langue = (await params).fichier.replace(/\.json$/, "");
  if (!estLangue(langue)) return new NextResponse(null, { status: 404 });
  return NextResponse.json(poolQuiz(langue), { headers: { "Cache-Control": "public, max-age=3600" } });
}
