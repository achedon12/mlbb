import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { shiftDay, EPOCH, isValidDay, dayUtc } from "@/lib/quiz";
import { challengeOfDay } from "@/lib/quiz-data";

/**
 * Defi du jour d'une langue (`/quiz/day/fr-2026-09-11.json`) : cinq manches,
 * quelques Ko. La page reste statique ; le navigateur demande le defi de sa
 * date UTC apres le montage.
 *
 * Seuls les jours depuis le premier defi sont servis, jusqu'au lendemain : une
 * horloge un peu en avance ne tombe pas sur une erreur.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const m = /^([a-z]{2})-(\d{4}-\d{2}-\d{2})\.json$/.exec((await params).file);
  if (!m || !isLocale(m[1]) || !isValidDay(m[2])) return new NextResponse(null, { status: 404 });
  const [, locale, day] = m;
  const today = dayUtc(new Date());
  if (day < EPOCH || day > shiftDay(today, 1)) return new NextResponse(null, { status: 404 });

  // Un defi passe ne change plus ; celui du jour peut suivre une synchro.
  const cache = day < today ? "public, max-age=86400" : "public, max-age=600";
  return NextResponse.json(challengeOfDay(locale as Parameters<typeof challengeOfDay>[0], day), {
    headers: { "Cache-Control": cache },
  });
}
