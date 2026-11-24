import { NextResponse } from "next/server";
import { deleteSync, readSync, saveSync, syncAccountKey, syncInput } from "@/lib/account-sync-server";
import { answer, currentOwner, guardOwner, refused, storageFailed } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { addressOf, limitByMinute } from "@/lib/push-server";

/**
 * The player's progress kept on the account (favourites, daily game stats
 * and streaks, practice records, reminder months), keyed on the account the
 * request proves: there is no id in the address or the body.
 * - GET: `{ available: false }` without a database; `{ available: true,
 *   connected: false }` for a visitor; signed in, `{ available: true,
 *   connected: true, account, sync }`, `sync` null until the first save.
 *   `account` is an opaque key, not the account id.
 * - PUT `{ data, base }`: replaces the whole copy, if the stored one is still
 *   the one `base` names (null: none yet). 200 `{ sync }`; 409 `{ error:
 *   "conflict", sync }` with the current copy, to merge and send again.
 * - DELETE: removes the account's copy and its public page. 204.
 */
export const dynamic = "force-dynamic";

const reads = limitByMinute(120);

export async function GET(request: Request) {
  if (!databaseConfigured()) return answer({ available: false });
  if (!reads(addressOf(request))) return refused(429, "too many requests");
  const owner = await currentOwner();
  if (owner.status === "none") return answer({ available: true, connected: false });
  if (owner.status === "banned") return refused(403, "banned");
  if (owner.status !== "ok") return refused(503, "login service unavailable");
  try {
    return answer({ available: true, connected: true, account: syncAccountKey(owner.id), sync: await readSync(owner.id) });
  } catch (error) {
    return storageFailed("progress read", error);
  }
}

export async function PUT(request: Request) {
  const guarded = await guardOwner(request, "progress", syncInput);
  if (guarded instanceof NextResponse) return guarded;
  try {
    const result = await saveSync(guarded.owner.id, guarded.body);
    return result.ok ? answer({ sync: result.sync }) : answer({ error: "conflict", sync: result.current }, 409);
  } catch (error) {
    return storageFailed("progress save", error);
  }
}

export async function DELETE(request: Request) {
  const guarded = await guardOwner(request, "progress", null);
  if (guarded instanceof NextResponse) return guarded;
  try {
    await deleteSync(guarded.owner.id);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return storageFailed("progress delete", error);
  }
}
