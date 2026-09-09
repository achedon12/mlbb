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
  if (!h) return introuvable("Heros");

  return reponseApi({
    slug: h.slug,
    nom: h.nom,
    titre: h.titre,
    roles: h.roles,
    lanes: h.lanes,
    specialites: h.specialites,
    sortie: h.sortie,
    ressource: h.ressource,
    typeDegats: h.typeDegats,
    typeAttaque: h.typeAttaque,
    region: h.region,
    notes: h.notes,
    statistiques: h.stats,
    competences: competences[h.slug] ?? [],
    skins: h.skins,
    visuels: h.visuels,
    illustrations: illustrations[h.slug] ?? {},
    analyse: h.analyse,
  });
}
