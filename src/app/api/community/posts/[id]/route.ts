import { NextResponse } from "next/server";
import { idParam, replyInput } from "@/lib/community/rules";
import { answer, guardPlayer, refused, refusedFor, storageFailed } from "@/lib/community/server";
import { deleteReply, editReply } from "@/lib/community/store";

/**
 * One reply, by its author: PATCH `{ body }` within an hour, DELETE within
 * a day. Same answers as the thread's own route; 409 `locked` for an edit
 * in a locked thread.
 */
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const guarded = await guardPlayer(request, "edit", replyInput);
  if (guarded instanceof NextResponse) return guarded;
  const id = idParam((await params).id);
  if (!id) return refused(404, "unknown");
  try {
    const result = await editReply(id, guarded.body.body, guarded.author);
    return result === "ok" ? answer({ ok: true }) : refusedFor(result);
  } catch (error) {
    return storageFailed("reply edit", error, { id });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const guarded = await guardPlayer(request, "edit", null);
  if (guarded instanceof NextResponse) return guarded;
  const id = idParam((await params).id);
  if (!id) return refused(404, "unknown");
  try {
    const result = await deleteReply(id, guarded.author);
    return result === "ok" ? new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } }) : refusedFor(result);
  } catch (error) {
    return storageFailed("reply deletion", error, { id });
  }
}
