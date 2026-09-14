import { itemsFor } from "@/lib/data";
const all = itemsFor("en");
import { responseApi } from "@/lib/api";

/** Objets de la boutique, filtrables par categorie. */
// Cette route lit des parametres de requete : la figer au build
// renverrait la meme reponse quel que soit le filtre demande.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category");
  const results = category
    ? all.filter((o) => o.category.toLowerCase() === category.toLowerCase())
    : all;

  return responseApi(results, { total: results.length });
}
