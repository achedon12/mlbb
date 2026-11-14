import { NextResponse } from "next/server";
import { idParam, knownHeroes, threadEdit } from "@/lib/community/rules";
import { answer, guardPlayer, refused, refusedFor, storageFailed } from "@/lib/community/server";
import { deleteThread, editThread } from "@/lib/community/store";
import { heroesBySlug } from "@/lib/data";

/**
 * One thread, by its author:
 * - PATCH `{ title, body, heroes? }` within an hour of posting;
 * - DELETE within a day (the text is erased, the thread and its replies
 *   are no longer shown).
 * 204 on success; 401 not signed in, 403 someone else's, past the window
 * (`window`) or banned, 404 unknown, 422 the word or link filter.
 */
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const guarded = await guardPlayer(request, "edit", threadEdit);
  if (guarded instanceof NextResponse) return guarded;
  const id = idParam((await params).id);
  if (!id) return refused(404, "unknown");
  try {
    const body = { ...guarded.body, heroes: knownHeroes(guarded.body.heroes, heroesBySlug) };
    const result = await editThread(id, body, guarded.author);
    return result === "ok" ? answer({ ok: true }) : refusedFor(result);
  } catch (error) {
    return storageFailed("thread edit", error, { id });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const guarded = await guardPlayer(request, "edit", null);
  if (guarded instanceof NextResponse) return guarded;
  const id = idParam((await params).id);
  if (!id) return refused(404, "unknown");
  try {
    const result = await deleteThread(id, guarded.author);
    return result === "ok" ? new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } }) : refusedFor(result);
  } catch (error) {
    return storageFailed("thread deletion", error, { id });
  }
}
