import { z } from "zod";
import { db } from "@/lib/db";
import { ok, readSigned, refusal, withDatabase } from "@/lib/bot/internal";
import { AUTO_ROLE_FAILURES } from "@/lib/bot/kinds";
import { isSnowflake } from "@/lib/bot/public";

/**
 * The bot could not give a server's auto-roles (Manage Roles lost, a role
 * deleted, moved above the bot or given a dangerous permission since it was
 * saved), or the manager who chose them left or can no longer give them:
 * they are marked failing, with that reason, the dashboard says so, and the bot stops
 * trying until the owner saves the settings again, like a greeting channel.
 * A server without auto-roles is left alone: there was nothing to give.
 */
export const dynamic = "force-dynamic";

/** `reason` absent (the first version of this call): the bot. */
const body = z.object({ reason: z.enum(AUTO_ROLE_FAILURES).default("bot") }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await readSigned(request, body);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  if (!isSnowflake(id)) return refusal(400, "invalid server id");
  return withDatabase("auto-role failure", async () => {
    const { count } = await db().guildSettings.updateMany({
      where: { guildId: id, OR: [{ NOT: { autoRoleIds: { isEmpty: true } } }, { NOT: { botAutoRoleIds: { isEmpty: true } } }] },
      data: { autoRoleFailing: true, autoRoleFailReason: gate.body.reason },
    });
    return ok({ ok: true, marked: count });
  });
}
