import { NextResponse } from "next/server";
import { isLocale, LOCALES } from "@/i18n/config";
import { poolQuiz } from "@/lib/quiz-data";

/**
 * Quiz practice pool, one static file per language
 * (`/quiz/fr.json`). The browser only requests it when switching to
 * practice, and keeps it to replay offline.
 *
 * The address carries an extension: the proxy lets dotted paths through
 * without a language prefix (see `src/proxy.ts`).
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
