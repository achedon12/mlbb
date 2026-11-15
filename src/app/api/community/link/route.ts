import { NextResponse } from "next/server";
import { answer, guardLink, refusedFor, storageFailed } from "@/lib/community/server";
import { linkAccounts } from "@/lib/community/store";

/**
 * Links the Discord login of this browser to its game login, for the
 * community: from then on signing in with either one is the same member (see
 * `linkAccounts`). Both logins must be present on the request. No body.
 * Answers `{ ok: true }`; 403 banned, 409 one of the two already linked
 * elsewhere.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardLink(request);
  if (guarded instanceof NextResponse) return guarded;
  try {
    const result = await linkAccounts(guarded.game, guarded.discord);
    return result === "ok" ? answer({ ok: true }) : refusedFor(result);
  } catch (error) {
    return storageFailed("link", error);
  }
}
