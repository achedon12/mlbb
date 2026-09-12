import { competences, heros, herosParSlug, illustrations } from "@/lib/donnees";
import { introuvable, reponseApi } from "@/lib/api";

/** Fiche complete d'un heros : competences, skins, visuels et analyse. */
export const dynamic = "force-static";

export function generateStaticParams() {
  return heros.map((h) => ({ slug: h.slug }));
}

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const h = herosParSlug.get(slug);
  if (!h) return introuvable("Hero");

  return reponseApi({
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
    skills: competences("en")[h.slug] ?? [],
    skins: h.skins,
    images: h.images,
    illustrations: illustrations[h.slug] ?? {},
    analysis: h.analysis,
  });
}
