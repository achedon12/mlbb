import { NextResponse } from "next/server";
import { estLangue } from "@/i18n/config";
import { decalerJour, EPOQUE, estJourValide, jourUtc } from "@/lib/quiz";
import { defiDuJour } from "@/lib/quiz-donnees";

/**
 * Defi du jour d'une langue (`/quiz/jour/fr-2026-09-11.json`) : cinq manches,
 * quelques Ko. La page reste statique ; le navigateur demande le defi de sa
 * date UTC apres le montage.
 *
 * Seuls les jours depuis le premier defi sont servis, jusqu'au lendemain : une
 * horloge un peu en avance ne tombe pas sur une erreur.
 */
export const dynamic = "force-dynamic";

export async function GET(_requete: Request, { params }: { params: Promise<{ fichier: string }> }) {
  const m = /^([a-z]{2})-(\d{4}-\d{2}-\d{2})\.json$/.exec((await params).fichier);
  if (!m || !estLangue(m[1]) || !estJourValide(m[2])) return new NextResponse(null, { status: 404 });
  const [, langue, jour] = m;
  const aujourdhui = jourUtc(new Date());
  if (jour < EPOQUE || jour > decalerJour(aujourdhui, 1)) return new NextResponse(null, { status: 404 });

  // Un defi passe ne change plus ; celui du jour peut suivre une synchro.
  const cache = jour < aujourdhui ? "public, max-age=86400" : "public, max-age=600";
  return NextResponse.json(defiDuJour(langue as Parameters<typeof defiDuJour>[0], jour), {
    headers: { "Cache-Control": cache },
  });
}
