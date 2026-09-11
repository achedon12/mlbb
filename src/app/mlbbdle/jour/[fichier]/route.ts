import { NextResponse } from "next/server";
import { estLangue, type Langue } from "@/i18n/config";
import { EPOQUE } from "@/lib/mlbbdle";
import { defiMlbbdle } from "@/lib/mlbbdle-donnees";
import { decalerJour, estJourValide, jourUtc } from "@/lib/quiz";

/**
 * Defi MLBBdle d'un jour et d'une langue (`/mlbbdle/jour/fr-2026-09-11.json`) :
 * le secret du mode classique, l'enigme du mode competence et les reponses de
 * la veille, quelques centaines d'octets. La page reste statique ; le
 * navigateur demande le defi de sa date UTC apres le montage.
 *
 * L'adresse porte une extension : le proxy laisse passer les chemins a point
 * sans prefixe de langue (voir `src/proxy.ts`). Seuls les jours depuis
 * l'epoque sont servis, jusqu'au lendemain : une horloge un peu en avance ne
 * tombe pas sur une erreur, et les jours a venir restent secrets.
 */
export const dynamic = "force-dynamic";

export async function GET(_requete: Request, { params }: { params: Promise<{ fichier: string }> }) {
  const m = /^([a-z]{2})-(\d{4}-\d{2}-\d{2})\.json$/.exec((await params).fichier);
  if (!m || !estLangue(m[1]) || !estJourValide(m[2])) return new NextResponse(null, { status: 404 });
  const [, langue, jour] = m;
  const aujourdhui = jourUtc(new Date());
  if (jour < EPOQUE || jour > decalerJour(aujourdhui, 1)) return new NextResponse(null, { status: 404 });

  const defi = defiMlbbdle(langue as Langue, jour);
  if (!defi) return new NextResponse(null, { status: 404 });
  // Un jour passe ne change plus ; celui du jour peut suivre une synchro.
  const cache = jour < aujourdhui ? "public, max-age=86400" : "public, max-age=600";
  return NextResponse.json(defi, { headers: { "Cache-Control": cache } });
}
