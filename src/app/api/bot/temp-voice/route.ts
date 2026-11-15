import { db } from "@/lib/db";
import { ok, readSigned, refusal, withDatabase } from "@/lib/bot/internal";
import { isSnowflake } from "@/lib/bot/public";

/**
 * Every temporary voice channel the bot created and has not deleted yet,
 * `?after=<last channel id of the previous page>`, a thousand per page:
 * read by each shard after a restart, which keeps those of its servers.
 */
export const dynamic = "force-dynamic";

const PAGE = 1_000;

export async function GET(request: Request) {
  const gate = await readSigned(request, null);
  if (gate instanceof Response) return gate;
  const after = gate.url.searchParams.get("after");
  if (after !== null && !isSnowflake(after)) return refusal(400, "invalid cursor");
  return withDatabase("temp voice list", async () => {
    const channels = await db().tempVoiceChannel.findMany({
      where: { guild: { leftAt: null }, ...(after ? { channelId: { gt: after } } : {}) },
      select: { guildId: true, channelId: true, hubChannelId: true, ownerId: true },
      orderBy: { channelId: "asc" },
      take: PAGE,
    });
    return ok({ channels, next: channels.length === PAGE ? channels[channels.length - 1]!.channelId : null });
  });
}
