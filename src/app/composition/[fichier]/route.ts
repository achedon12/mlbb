import { NextResponse } from "next/server";
import { mesuresRang } from "@/lib/composition-donnees";
import { RANGS_CLASSES } from "@/lib/tier-list";

/**
 * Mesures d'un rang pour l'analyse d'equipe : taux et paliers, taux par duree
 * de partie, coequipiers et contres de tout le roster. Un fichier statique par
 * rang (`/composition/mythic.json`), que l'outil demande au choix du rang
 * plutot que d'embarquer les six dans la page.
 *
 * L'adresse porte une extension : le proxy laisse passer les chemins a point
 * sans prefixe de langue (voir `src/proxy.ts`), et ces donnees ne dependent
 * pas de la langue.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return RANGS_CLASSES.map((r) => ({ fichier: `${r}.json` }));
}

export async function GET(_requete: Request, { params }: { params: Promise<{ fichier: string }> }) {
  const nom = (await params).fichier.replace(/\.json$/, "");
  const rang = RANGS_CLASSES.find((r) => r === nom);
  if (!rang) return new NextResponse(null, { status: 404 });
  return NextResponse.json(mesuresRang(rang), { headers: { "Cache-Control": "public, max-age=3600" } });
}
