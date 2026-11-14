import { NextResponse } from "next/server";
import { seasonHeroes, seasons } from "@/lib/mlbb-auth";
import { shownHero } from "@/lib/player-profile";
import { addressOf, limitByMinute } from "@/lib/push-server";
import { tokenCurrent } from "@/lib/session";

/**
 * Heroes the signed-in player plays, for the collection tool's "heroes I
 * play" filter: the current season's, most matches first, as site slugs.
 * Same source as the profile page (and its cache). 200 `{ heroes }`, 401
 * without a session, 503 when the game's service does not answer.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const reads = limitByMinute(20);
/** Enough to cover a main pool; the long tail of one-match heroes is noise here. */
const MAX_PLAYED = 30;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });

export async function GET(request: Request) {
  if (!reads(addressOf(request))) return fail(429, "too many requests");
  const token = await tokenCurrent();
  if (!token) return fail(401, "sign in required");
  const list = await seasons(token);
  if (list.status === "expired") return fail(401, "sign in required");
  if (list.status !== "ok") return fail(503, "game service unavailable");
  if (list.data.length === 0) return NextResponse.json({ heroes: [] }, { headers: NO_STORE });
  const played = await seasonHeroes(token, list.data[0]);
  if (played.status === "expired") return fail(401, "sign in required");
  if (played.status !== "ok") return fail(503, "game service unavailable");
  const heroes = [...played.data.heroes]
    .sort((a, b) => b.matches - a.matches)
    .flatMap((h) => shownHero(h.hero).slug ?? [])
    .filter((slug, i, all) => all.indexOf(slug) === i)
    .slice(0, MAX_PLAYED);
  return NextResponse.json({ heroes }, { headers: NO_STORE });
}
