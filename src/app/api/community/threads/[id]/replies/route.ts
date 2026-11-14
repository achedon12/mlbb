import { NextResponse } from "next/server";
import { REPLIES_PER_PAGE } from "@/lib/community/constants";
import { idParam, replyInput } from "@/lib/community/rules";
import { answer, guardPlayer, refused, refusedFor, storageFailed } from "@/lib/community/server";
import { createReply } from "@/lib/community/store";

/**
 * Replies to a thread, signed-in players only: `{ body }` (Markdown).
 * Answers 201 `{ id, page }` (the page of the thread the reply is on).
 * 404 unknown or hidden thread, 409 locked (`locked`) or the same text
 * again; otherwise the refusals of the thread creation.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guarded = await guardPlayer(request, "reply", replyInput);
  if (guarded instanceof NextResponse) return guarded;
  const id = idParam((await params).id);
  if (!id) return refused(404, "unknown");
  try {
    const result = await createReply(id, guarded.body.body, guarded.author);
    if (!result.ok) return refusedFor(result.reason);
    return answer({ id: result.value.id, page: Math.ceil(result.value.index / REPLIES_PER_PAGE) }, 201);
  } catch (error) {
    return storageFailed("reply", error, { thread: id });
  }
}
