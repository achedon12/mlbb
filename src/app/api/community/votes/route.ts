import { NextResponse } from "next/server";
import { voteInput } from "@/lib/community/rules";
import { answer, guardPlayer, refusedFor, storageFailed } from "@/lib/community/server";
import { toggleVote } from "@/lib/community/store";

/**
 * Upvote a thread or a reply, signed-in players only: `{ kind: "thread" |
 * "post", id }`. One vote per account; a second call takes it back. Answers
 * `{ score, voted }`; 403 one's own post or banned, 404 unknown or hidden.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPlayer(request, "vote", voteInput);
  if (guarded instanceof NextResponse) return guarded;
  const { kind, id } = guarded.body;
  try {
    const result = await toggleVote(kind, id, guarded.author);
    return result.ok ? answer({ score: result.score, voted: result.voted }) : refusedFor(result.reason);
  } catch (error) {
    return storageFailed("vote", error, { kind, id });
  }
}
