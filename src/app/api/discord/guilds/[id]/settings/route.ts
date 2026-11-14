import { db } from "@/lib/db";
import { BotUnavailable, canManage, guildChannels } from "@/lib/bot/client";
import { answer, guardDashboard, refused } from "@/lib/bot/dashboard-guard";
import { isSnowflake } from "@/lib/bot/public";
import { checkAgainstGuild, settingsInput, settingsRow, settingsView } from "@/lib/bot/settings";
import { logError } from "@/lib/log";

/**
 * Saves a server's settings from the dashboard. The bot is asked, at the
 * moment of saving, whether this user may manage the server, and which
 * channels and roles exist: nothing from the page is trusted on its own.
 */
export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardDashboard(request, settingsInput);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  if (!isSnowflake(id)) return refused(400, "invalid server id");

  try {
    if (!(await canManage(gate.config, id, gate.user.id))) return refused(403, "not allowed");
    const guild = await db().guild.findUnique({ where: { id }, select: { id: true, leftAt: true } });
    if (!guild || guild.leftAt) return refused(404, "unknown server");
    const { channels, roles } = await guildChannels(gate.config, id);
    const checked = checkAgainstGuild(gate.body, new Set(channels.map((c) => c.id)), new Set(roles.map((r) => r.id)));
    if (!checked.ok) return refused(400, `unknown channel or role: ${checked.field}`);

    const row = settingsRow(checked.value);
    const [, settings] = await db().$transaction([
      db().guild.update({ where: { id }, data: { locale: checked.value.locale } }),
      db().guildSettings.upsert({ where: { guildId: id }, create: { guildId: id, ...row }, update: row }),
    ]);
    return answer(settingsView(id, checked.value.locale, settings));
  } catch (error) {
    if (error instanceof BotUnavailable) return refused(503, "bot unavailable");
    await logError("discord dashboard: settings save failed", error, { guild: id });
    return refused(503, "storage unavailable");
  }
}
