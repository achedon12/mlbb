import { NextResponse } from "next/server";
import { z } from "zod";
import { cleanText } from "@/lib/community-builds";
import { TARGET_KINDS } from "@/lib/community/constants";
import { answer, guardModerator, refused, storageFailed } from "@/lib/community/server";
import { MODERATION_ACTIONS, moderate } from "@/lib/community/store";
import { log } from "@/lib/log";

/**
 * Moderation, for the site's moderators (Discord login listed in
 * BOT_SUPER_ADMIN_IDS) only; anyone else gets 404.
 *
 * `{ action, kind?, id?, accountId?, note?, days? }`: `action` one of hide,
 * unhide, delete, lock, unlock, pin, unpin, ban, unban, dismiss; a target
 * (`kind` + `id`) for all but unban, which takes the `accountId` from the
 * banned list; `days` 1 to 365 for a temporary ban (none: for good). The
 * target's open reports are closed and the decision logged. 200 `{ ok }`,
 * 400 invalid, 404 unknown target.
 */
export const dynamic = "force-dynamic";

const body = z
  .object({
    action: z.enum(MODERATION_ACTIONS),
    kind: z.enum(TARGET_KINDS).optional(),
    id: z.number().int().positive().max(999_999_999).optional(),
    accountId: z.string().regex(/^[0-9a-f]{24}$/).optional(),
    note: z
      .string()
      .max(1200)
      .transform((s) => [...cleanText(s, false)].slice(0, 300).join(""))
      .optional(),
    days: z.number().int().min(1).max(365).nullable().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const guarded = await guardModerator(request, body);
  if (guarded instanceof NextResponse) return guarded;
  const { moderator, body: o } = guarded;
  try {
    const result = await moderate(o, { id: moderator.id, name: moderator.name });
    if (result === "invalid") return refused(400, "invalid");
    if (result === "unknown") return refused(404, "unknown");
    await log("info", "community moderation", { action: o.action, kind: o.kind, id: o.id, moderator: moderator.id });
    return answer({ ok: true });
  } catch (error) {
    return storageFailed("moderation", error, { action: o.action, kind: o.kind, id: o.id });
  }
}
