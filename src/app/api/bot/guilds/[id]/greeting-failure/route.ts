import { z } from "zod";
import { db } from "@/lib/db";
import { ok, readSigned, refusal, withDatabase } from "@/lib/bot/internal";
import { isSnowflake } from "@/lib/bot/public";
import { GREETING_KINDS } from "@/lib/bot/settings";

/**
 * The bot could not post a server's welcome or goodbye message (channel
 * gone, permission lost): the setting is marked failing, the dashboard says
 * so, and the bot stops trying until the owner saves the settings again,
 * exactly like an announcement channel. A server whose message is off is
 * left alone: there was nothing to post.
 */
export const dynamic = "force-dynamic";

const body = z.object({ kind: z.enum(GREETING_KINDS) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await readSigned(request, body);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  if (!isSnowflake(id)) return refusal(400, "invalid server id");
  return withDatabase("greeting failure", async () => {
    const { count } = await db().guildSettings.updateMany({
      where: { guildId: id, [`${gate.body.kind}ChannelId`]: { not: null } },
      data: { [`${gate.body.kind}Failing`]: true },
    });
    return ok({ ok: true, marked: count });
  });
}
