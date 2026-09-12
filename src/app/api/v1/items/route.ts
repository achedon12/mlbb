import { objets } from "@/lib/donnees";
const tous = objets("en");
import { reponseApi } from "@/lib/api";

/** Objets de la boutique, filtrables par categorie. */
// Cette route lit des parametres de requete : la figer au build
// renverrait la meme reponse quel que soit le filtre demande.
export const dynamic = "force-dynamic";

export function GET(requete: Request) {
  const category = new URL(requete.url).searchParams.get("category");
  const resultats = category
    ? tous.filter((o) => o.category.toLowerCase() === category.toLowerCase())
    : tous;

  return reponseApi(resultats, { total: resultats.length });
}
