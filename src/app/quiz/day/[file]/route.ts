import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { shiftDay, EPOCH, isValidDay, dayUtc } from "@/lib/quiz";
import { challengeOfDay } from "@/lib/quiz-data";

/**
 * A language's daily challenge (`/quiz/day/fr-2026-09-11.json`): five rounds,
 * a few KB. The page stays static; the browser requests the challenge for its
 * UTC date after mounting.
 *
 * Only days since the first challenge are served, up to tomorrow: a
 * slightly fast clock does not hit an error.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const m = /^([a-z]{2})-(\d{4}-\d{2}-\d{2})\.json$/.exec((await params).file);
  if (!m || !isLocale(m[1]) || !isValidDay(m[2])) return new NextResponse(null, { status: 404 });
  const [, locale, day] = m;
  const today = dayUtc(new Date());
  if (day < EPOCH || day > shiftDay(today, 1)) return new NextResponse(null, { status: 404 });

  // A past challenge no longer changes; today's may follow a sync.
  const cache = day < today ? "public, max-age=86400" : "public, max-age=600";
  return NextResponse.json(challengeOfDay(locale as Parameters<typeof challengeOfDay>[0], day), {
    headers: { "Cache-Control": cache },
  });
}
