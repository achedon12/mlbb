import { NextResponse } from "next/server";
import { BUILD_ID } from "@/lib/community-builds";
import { NO_STORE, allowVote, currentPlayer, guardMutation, refused } from "@/lib/community-builds-server";
import { voteBuild } from "@/lib/community-builds-store";
import { logError } from "@/lib/log";

/**
 * Vote for a community build, signed-in players only: one vote per account,
 * a second POST takes it back. No body. Answers `{ votes, voted }`; 401 not
 * signed in, 403 one's own build or other origin, 404 unknown, 429 too fast.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guarded = await guardMutation(request, false);
  if (guarded instanceof NextResponse) return guarded;
  const { id } = await params;
  if (!BUILD_ID.test(id)) return refused(404, "unknown build");

  const player = await currentPlayer().catch(() => ({ status: "unavailable" as const }));
  if (player.status === "none") return refused(401, "sign in required");
  if (player.status !== "ok") return refused(503, "login service unavailable");
  if (!allowVote(player.id)) return refused(429, "too many requests");

  try {
    const result = await voteBuild(id, player.id);
    if (!result.ok) return result.reason === "own" ? refused(403, "own build") : refused(404, "unknown build");
    return NextResponse.json({ votes: result.votes, voted: result.voted }, { headers: NO_STORE });
  } catch (error) {
    await logError("community builds: vote failed", error, { id });
    return refused(503, "storage unavailable");
  }
}
