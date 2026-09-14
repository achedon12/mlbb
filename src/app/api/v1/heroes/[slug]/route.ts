import { skills, allHeroes, heroesBySlug, illustrations } from "@/lib/data";
import { notFound, responseApi } from "@/lib/api";

/** Full hero record: skills, skins, visuals and analysis. */
export const dynamic = "force-static";

export function generateStaticParams() {
  return allHeroes.map((h) => ({ slug: h.slug }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) return notFound("Hero");

  return responseApi({
    slug: h.slug,
    name: h.name,
    title: h.title,
    roles: h.roles,
    lanes: h.lanes,
    specialties: h.specialties,
    release: h.release,
    resource: h.resource,
    damageType: h.damageType,
    attackType: h.attackType,
    region: h.region,
    ratings: h.ratings,
    stats: h.stats,
    skills: skills("en")[h.slug] ?? [],
    skins: h.skins,
    images: h.images,
    illustrations: illustrations[h.slug] ?? {},
    analysis: h.analysis,
  });
}
