import { competences, heros } from "@/lib/donnees";
import { reponseApi } from "@/lib/api";
import type { Lane, Role } from "@/lib/types";

/**
 * Liste des heros.
 *
 * Filtrable par role et par position. La liste ne porte pas les competences
 * ni les skins : une reponse de plusieurs megaoctets serait inutilisable pour
 * un appelant qui ne cherche qu'a lister.
 */
// Cette route lit des parametres de requete : la figer au build
// renverrait la meme reponse quel que soit le filtre demande.
export const dynamic = "force-dynamic";

export function GET(requete: Request) {
  const parametres = new URL(requete.url).searchParams;
  const role = parametres.get("role") as Role | null;
  const lane = parametres.get("lane") as Lane | null;

  const resultats = heros
    .filter((h) => (role ? h.roles.includes(role) : true))
    .filter((h) => (lane ? h.lanes.includes(lane) : true))
    .map((h) => ({
      slug: h.slug,
      nom: h.nom,
      titre: h.titre,
      roles: h.roles,
      lanes: h.lanes,
      specialites: h.specialites,
      sortie: h.sortie,
      notes: h.notes,
      skins: h.skins.length,
      competences: (competences[h.slug] ?? []).map((c) => c?.nom ?? null),
    }));

  return reponseApi(resultats, { total: resultats.length });
}
