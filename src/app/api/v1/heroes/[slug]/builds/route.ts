import { allHeroes, buildsPlayed, heroesBySlug } from "@/lib/data";
import { notFound, responseApi } from "@/lib/api";

/**
 * Builds actually played with a hero, per position then per rank: three key
 * items, the emblem, its talents and the spell, with their rates. An empty
 * object when nothing is measured yet.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return allHeroes.map((h) => ({ slug: h.slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!heroesBySlug.has(slug)) return notFound("Hero");
  return responseApi(buildsPlayed[slug] ?? {});
}
