import { db } from "@/lib/db";
import { BotUnavailable, refreshGuildQuietly } from "@/lib/bot/client";
import { answer, authorizeGuild, guardDashboard, refused } from "@/lib/bot/dashboard-guard";
import { checkTempVoice, tempVoiceHubView, tempVoiceInput, tempVoiceRows } from "@/lib/bot/temp-voice";
import { logError } from "@/lib/log";

/**
 * Saves a server's temporary voice hubs from the dashboard, all at once
 * (an empty list turns the feature off). Like the settings save: the
 * server id comes from the path only, the bot is asked on this request
 * whether the user manages it and which voice channels it has; a hub that
 * is not one of them is refused. The bot's permissions are not required to
 * save (the dashboard warns): granting them must not need a second save.
 */
export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardDashboard(request, tempVoiceInput);
  if (gate instanceof Response) return gate;
  const { id } = await params;

  try {
    const lists = await authorizeGuild(gate.config, id, gate.user.id);
    if (lists instanceof Response) return lists;
    const guild = await db().guild.findUnique({ where: { id }, select: { leftAt: true, tempVoiceHubs: { select: { channelId: true } } } });
    if (!guild || guild.leftAt) return refused(404, "unknown server");
    const checked = checkTempVoice(
      gate.body,
      new Set(lists.voiceChannels.map((c) => c.id)),
      new Set(guild.tempVoiceHubs.map((h) => h.channelId)),
    );
    if (!checked.ok) return refused(400, `unknown channel: ${checked.field}`);

    const rows = tempVoiceRows(id, gate.body);
    await db().$transaction([
      db().tempVoiceHub.deleteMany({ where: { guildId: id } }),
      db().tempVoiceHub.createMany({ data: rows }),
    ]);
    // The bot applies the change now rather than when its cached copy expires.
    await refreshGuildQuietly(gate.config, id);
    return answer({ hubs: rows.map(tempVoiceHubView) });
  } catch (error) {
    if (error instanceof BotUnavailable) return refused(503, "bot unavailable");
    await logError("discord dashboard: temp voice save failed", error, { guild: id });
    return refused(503, "storage unavailable");
  }
}
