import { NextResponse } from "next/server";
import { threadPath } from "@/lib/community/constants";
import { knownHeroes, threadInput } from "@/lib/community/rules";
import { answer, guardPlayer, refusedFor, storageFailed } from "@/lib/community/server";
import { createThread } from "@/lib/community/store";
import { heroesBySlug } from "@/lib/data";
import { log } from "@/lib/log";

/**
 * Starts a forum thread, signed-in players only:
 * `{ category, title, body, heroes? }` (Markdown body, up to 5 hero slugs).
 * Answers 201 `{ id, path }`. Refusals: 400 a field (`error` names it), 401
 * not signed in, 403 other origin or banned, 409 the same text again, 413
 * and 415 body, 422 the word or link filter (`blocked`, `spam`, `links`,
 * `newAccountLinks`), 429 too fast or the daily cap (`day`), 503 storage.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPlayer(request, "thread", threadInput);
  if (guarded instanceof NextResponse) return guarded;
  const { author, body } = guarded;
  try {
    const result = await createThread({ ...body, heroes: knownHeroes(body.heroes, heroesBySlug) }, author);
    if (!result.ok) return refusedFor(result.reason);
    await log("info", "community thread created", { id: result.value.id, category: result.value.category, author: author.id });
    return answer({ id: result.value.id, path: threadPath(result.value) }, 201);
  } catch (error) {
    return storageFailed("thread creation", error);
  }
}
