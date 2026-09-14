import { NextResponse } from "next/server";
import { measuresRank } from "@/lib/composition-data";
import { RANKS_CLASSES } from "@/lib/tier-list";

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
  return RANKS_CLASSES.map((r) => ({ file: `${r}.json` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const name = (await params).file.replace(/\.json$/, "");
  const rank = RANKS_CLASSES.find((r) => r === name);
  if (!rank) return new NextResponse(null, { status: 404 });
  return NextResponse.json(measuresRank(rank), { headers: { "Cache-Control": "public, max-age=3600" } });
}
