import { NextResponse } from "next/server";
import { measuresRank } from "@/lib/composition-data";
import { RANKS_CLASSES } from "@/lib/tier-list";

/**
 * One rank's measurements for the team analysis: rates and tiers, rates by game
 * length, teammates and counters of the whole roster. One static file per
 * rank (`/composition/mythic.json`), which the tool requests when a rank is
 * chosen rather than embedding all six in the page.
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
  return NextResponse.json(measuresRank(rank), { headers: { "Cache-Control": "public, max-age=3600" } });
}
