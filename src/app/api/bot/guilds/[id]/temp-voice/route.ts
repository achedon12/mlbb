import { db } from "@/lib/db";
import { ok, readSigned, refusal, withDatabase } from "@/lib/bot/internal";
import { isSnowflake } from "@/lib/bot/public";
import { MAX_TEMP_VOICE_CHANNELS, tempVoiceChannelInput } from "@/lib/bot/temp-voice";

/**
 * The bot created a temporary voice channel from one of this server's
 * hubs: kept, so that after a restart the bot deletes it once empty. Only
 * what the bot lists here is ever deleted by it. A server unknown or left
 * keeps nothing.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await readSigned(request, tempVoiceChannelInput);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  if (!isSnowflake(id)) return refusal(400, "invalid server id");
  return withDatabase("temp voice register", async () => {
    const guild = await db().guild.findUnique({ where: { id }, select: { leftAt: true } });
    if (!guild || guild.leftAt) return refusal(404, "unknown server");
    if ((await db().tempVoiceChannel.count({ where: { guildId: id } })) >= MAX_TEMP_VOICE_CHANNELS) return refusal(409, "too many channels");
    const { channelId, hubChannelId, ownerId } = gate.body;
    await db().tempVoiceChannel.upsert({
      where: { channelId },
      create: { channelId, guildId: id, hubChannelId, ownerId },
      // Already registered (a retried call): left as it was.
      update: {},
    });
    return ok({ ok: true });
  });
}
