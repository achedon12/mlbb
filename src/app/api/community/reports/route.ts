import { NextResponse } from "next/server";
import { reportInput } from "@/lib/community/rules";
import { answer, guardPlayer, refusedFor, storageFailed } from "@/lib/community/server";
import { reportTarget } from "@/lib/community/store";
import { log } from "@/lib/log";

/**
 * Report a thread, a reply or a teammate card to the moderators, signed-in
 * players only: `{ kind, id, reason, note? }` (reason: spam, abuse,
 * offtopic, personal, other; note up to 300 characters). One report per
 * account and target. Answers 201 `{ ok: true }`; 403 one's own or banned,
 * 404 unknown, 409 already reported.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPlayer(request, "report", reportInput);
  if (guarded instanceof NextResponse) return guarded;
  const { body, author } = guarded;
  try {
    const result = await reportTarget(body, author);
    if (result !== "ok") return refusedFor(result);
    await log("info", "community report", { kind: body.kind, id: body.id, reason: body.reason });
    return answer({ ok: true }, 201);
  } catch (error) {
    return storageFailed("report", error, { kind: body.kind, id: body.id });
  }
}
