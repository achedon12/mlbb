import { NextResponse } from "next/server";
import { measuredCores, simCatalog } from "@/lib/build-catalog";

/**
 * Cores actually played by a hero, for the simulator.
 *
 * Every rank and lane fits in a few KB per hero, but 600 KB for the whole
 * roster: the simulator only loads the chosen hero's. One file per hero,
 * frozen at build time like the data it serves.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [...simCatalog.heroes.keys()].map((hero) => ({ hero }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ hero: string }> }) {
  const { hero } = await params;
  if (!simCatalog.heroes.has(hero)) return new NextResponse(null, { status: 404 });
  return NextResponse.json({ cores: measuredCores(hero) });
}
