import { NextResponse } from "next/server";
import { estLangue, type Langue } from "@/i18n/config";
import { EPOCH } from "@/lib/mlbbdle";
import { mlbbdlePuzzle } from "@/lib/mlbbdle-data";
import { decalerJour, estJourValide, jourUtc } from "@/lib/quiz";

/**
 * MLBBdle puzzle for one day and language (`/mlbbdle/day/fr-2026-09-11.json`):
 * the classic-mode secret, the skill-mode puzzle and yesterday's answers, a
 * few hundred bytes. The page stays static; the browser asks for the puzzle
 * of its UTC date after mounting.
 *
 * The address carries an extension: the proxy lets dotted paths through
 * without a language prefix (see `src/proxy.ts`). Only days from the epoch
 * are served, up to tomorrow: a slightly fast clock does not hit an error,
 * and the days ahead stay secret.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const m = /^([a-z]{2})-(\d{4}-\d{2}-\d{2})\.json$/.exec((await params).file);
  if (!m || !estLangue(m[1]) || !estJourValide(m[2])) return new NextResponse(null, { status: 404 });
  const [, language, day] = m;
  const today = jourUtc(new Date());
  if (day < EPOCH || day > decalerJour(today, 1)) return new NextResponse(null, { status: 404 });

  const puzzle = mlbbdlePuzzle(language as Langue, day);
  if (!puzzle) return new NextResponse(null, { status: 404 });
  // A past day no longer changes; today's may follow a sync.
  const cache = day < today ? "public, max-age=86400" : "public, max-age=600";
  return NextResponse.json(puzzle, { headers: { "Cache-Control": cache } });
}
