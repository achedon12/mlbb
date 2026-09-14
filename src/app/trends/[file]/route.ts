import { NextResponse } from "next/server";
import { allHeroes, heroesBySlug } from "@/lib/data";
import { trendsOf } from "@/lib/evolution";
import type { WinStreak } from "@/lib/trends";

/**
 * Taux de victoire quotidiens d'un heros sur trente jours, par rang : un
 * fichier statique par heros (`/trends/aamon.json`), que le comparateur
 * demande a la selection d'un heros plutot que d'embarquer tout l'historique.
 *
 * L'adresse porte une extension : le proxy laisse passer les chemins a point
 * sans prefixe de langue ni limitation de debit (voir `src/proxy.ts`), et ces
 * donnees ne dependent pas de la langue.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return allHeroes.map((h) => ({ file: `${h.slug}.json` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const slug = (await params).file.replace(/\.json$/, "");
  if (!heroesBySlug.has(slug)) return new NextResponse(null, { status: 404 });

  // Un heros pas encore mesure rend un objet vide : le client l'affiche comme tel.
  const byRank: Record<string, WinStreak> = {};
  for (const [rank, series] of Object.entries(trendsOf(slug))) {
    if (series) byRank[rank] = { start: series.start, winRate: series.winRate };
  }
  return NextResponse.json(byRank, { headers: { "Cache-Control": "public, max-age=3600" } });
}
