import { NextResponse } from "next/server";
import { cardInput } from "@/lib/community/rules";
import { answer, guardPlayer, refusedFor, storageFailed } from "@/lib/community/server";
import { deleteCard, saveCard } from "@/lib/community/store";
import { heroesBySlug } from "@/lib/data";

/**
 * The signed-in player's own teammate card (one per account).
 * - PUT `{ region, rank, lanes, heroes?, languages, playTimes?, note?,
 *   gameId?, discord? }`: publishes or replaces it, listed for 7 days from
 *   now. 200 `{ id }`; 400 a field, 403 banned or hidden by moderation,
 *   422 the word filter.
 * - DELETE: takes it down. 204, or 404 when there was none.
 */
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const guarded = await guardPlayer(request, "card", cardInput);
  if (guarded instanceof NextResponse) return guarded;
  const card = { ...guarded.body, heroes: [...new Set(guarded.body.heroes)].filter((h) => heroesBySlug.has(h)) };
  try {
    const result = await saveCard(card, guarded.author);
    return result.ok ? answer({ id: result.id }) : refusedFor(result.reason);
  } catch (error) {
    return storageFailed("teammate card", error);
  }
}

export async function DELETE(request: Request) {
  const guarded = await guardPlayer(request, "card", null);
  if (guarded instanceof NextResponse) return guarded;
  try {
    return (await deleteCard(guarded.author.id))
      ? new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } })
      : refusedFor("unknown");
  } catch (error) {
    return storageFailed("teammate card deletion", error);
  }
}
