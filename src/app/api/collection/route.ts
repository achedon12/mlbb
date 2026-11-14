import { NextResponse } from "next/server";
import { accountKey, collectionInput, readCollection, saveCollection } from "@/lib/collection-account";
import { currentPlayer, type Player } from "@/lib/community-builds-server";
import { answer, guardPlayer, refused, storageFailed } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { addressOf, limitByMinute } from "@/lib/push-server";

/**
 * The collection tool's copy kept on the signed-in game account.
 * - GET: `{ available: false }` without a database; `{ available: true,
 *   connected: false }` for a visitor; signed in, `{ available: true,
 *   connected: true, account, collection }`, `collection` null until the
 *   first save. `account` is an opaque key, not the account id.
 * - PUT `{ heroes, skins, base }`: replaces the whole set, if the stored copy
 *   is still the one `base` names (null: none yet). 200 `{ collection }`;
 *   409 `{ error: "conflict", collection }` with the current copy, to merge
 *   and send again; 400 an id the catalogue does not know.
 */
export const dynamic = "force-dynamic";

const reads = limitByMinute(60);

export async function GET(request: Request) {
  if (!databaseConfigured()) return answer({ available: false });
  if (!reads(addressOf(request))) return refused(429, "too many requests");
  const player: Player = await currentPlayer().catch((): Player => ({ status: "unavailable" }));
  if (player.status === "none") return answer({ available: true, connected: false });
  if (player.status !== "ok") return refused(503, "login service unavailable");
  try {
    return answer({ available: true, connected: true, account: accountKey(player.id), collection: await readCollection(player.id) });
  } catch (error) {
    return storageFailed("collection read", error);
  }
}

export async function PUT(request: Request) {
  const guarded = await guardPlayer(request, "collection", collectionInput);
  if (guarded instanceof NextResponse) return guarded;
  try {
    const result = await saveCollection(guarded.author.id, guarded.body);
    return result.ok
      ? answer({ collection: result.collection })
      : answer({ error: "conflict", collection: result.current }, 409);
  } catch (error) {
    return storageFailed("collection save", error);
  }
}
