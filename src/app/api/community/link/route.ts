import { NextResponse } from "next/server";
import { answer, guardLink, refusedFor, storageFailed } from "@/lib/community/server";
import { linkAccounts, unlinkAccounts } from "@/lib/community/store";

/**
 * POST links the Discord login of this browser to its game login, for the
 * community: from then on signing in with either one is the same member (see
 * `linkAccounts`). DELETE undoes it: the Discord login becomes a new, separate
 * member, and what was merged stays with the game account (see
 * `unlinkAccounts`). Both logins must be present on the request, same origin,
 * 3 a minute for the two together. No body.
 *
 * Answers `{ ok: true }`; 403 banned; POST 409 one of the two already linked
 * elsewhere; DELETE 409 not linked to this game account.
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

export async function DELETE(request: Request) {
  const guarded = await guardLink(request);
  if (guarded instanceof NextResponse) return guarded;
  try {
    const result = await unlinkAccounts(guarded.game, guarded.discord);
    return result === "ok" ? answer({ ok: true }) : refusedFor(result);
  } catch (error) {
    return storageFailed("unlink", error);
  }
}
