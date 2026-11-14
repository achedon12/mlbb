import { allHeroes, counters, heroesBySlug } from "@/lib/data";
import { notFound, responseApi } from "@/lib/api";

/**
 * Measured counters of a hero, per rank: the heroes it beats (`strong`) and
 * those that beat it (`weak`), as win-rate gaps in points, with the hero's
 * baseline win rate. An empty object when nothing is measured yet.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return allHeroes.map((h) => ({ slug: h.slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!heroesBySlug.has(slug)) return notFound("Hero");
  return responseApi(counters[slug] ?? {});
}
