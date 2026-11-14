import { NextResponse } from "next/server";
import { counters, heroesBySlug } from "@/lib/data";
import { measuredGaps, type MatchupsRank } from "@/lib/matchups";
import { RANKS_CLASSES } from "@/lib/tier-list";

/**
 * One rank's measured duels for the matchup matrix: one static file per rank
 * (`/matchups/mythic.json`), requested when a rank is chosen, rather than the
 * six ranks embedded in the page.
 *
 * The address carries an extension: the proxy lets dotted paths through
 * without a language prefix (see `src/proxy.ts`), and this data does not
 * depend on the language.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return RANKS_CLASSES.map((r) => ({ file: `${r}.json` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const name = (await params).file.replace(/\.json$/, "");
  const rank = RANKS_CLASSES.find((r) => r === name);
  if (!rank) return new NextResponse(null, { status: 404 });
  const body: MatchupsRank = { rank, gaps: measuredGaps(counters, rank, (s) => heroesBySlug.has(s)) };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
