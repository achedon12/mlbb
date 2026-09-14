import { NextResponse } from "next/server";
import { allHeroes, heroesBySlug } from "@/lib/data";
import { trendsOf } from "@/lib/evolution";
import type { WinStreak } from "@/lib/trends";

/**
 * A hero's daily win rates over thirty days, by rank: one
 * static file per hero (`/trends/aamon.json`), which the comparator
 * requests when a hero is selected rather than embedding the whole history.
 *
 * The address carries an extension: the proxy lets dotted paths through
 * without a language prefix or rate limiting (see `src/proxy.ts`), and this
 * data does not depend on the language.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return allHeroes.map((h) => ({ file: `${h.slug}.json` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const slug = (await params).file.replace(/\.json$/, "");
  if (!heroesBySlug.has(slug)) return new NextResponse(null, { status: 404 });

  // A hero not measured yet returns an empty object: the client shows it as such.
  const byRank: Record<string, WinStreak> = {};
  for (const [rank, series] of Object.entries(trendsOf(slug))) {
    if (series) byRank[rank] = { start: series.start, winRate: series.winRate };
  }
  return NextResponse.json(byRank, { headers: { "Cache-Control": "public, max-age=3600" } });
}
