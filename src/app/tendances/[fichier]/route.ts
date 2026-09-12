import { NextResponse } from "next/server";
import { heros, herosParSlug } from "@/lib/donnees";
import { tendancesDe } from "@/lib/evolution";
import type { SerieVictoire } from "@/lib/tendances";

/**
 * Taux de victoire quotidiens d'un heros sur trente jours, par rang : un
 * fichier statique par heros (`/tendances/aamon.json`), que le comparateur
 * demande a la selection d'un heros plutot que d'embarquer tout l'historique.
 *
 * L'adresse porte une extension : le proxy laisse passer les chemins a point
 * sans prefixe de langue ni limitation de debit (voir `src/proxy.ts`), et ces
 * donnees ne dependent pas de la langue.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return heros.map((h) => ({ fichier: `${h.slug}.json` }));
}

export async function GET(_requete: Request, { params }: { params: Promise<{ fichier: string }> }) {
  const slug = (await params).fichier.replace(/\.json$/, "");
  if (!herosParSlug.has(slug)) return new NextResponse(null, { status: 404 });

  // Un heros pas encore mesure rend un objet vide : le client l'affiche comme tel.
  const parRang: Record<string, SerieVictoire> = {};
  for (const [rang, serie] of Object.entries(tendancesDe(slug))) {
    if (serie) parRang[rang] = { start: serie.start, winRate: serie.winRate };
  }
  return NextResponse.json(parRang, { headers: { "Cache-Control": "public, max-age=3600" } });
}
