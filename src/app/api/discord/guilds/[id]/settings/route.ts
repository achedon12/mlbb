import { db } from "@/lib/db";
import { BotUnavailable, mentionableRoles } from "@/lib/bot/client";
import { answer, authorizeGuild, guardDashboard, refused } from "@/lib/bot/dashboard-guard";
import { checkAgainstGuild, settingsInput, settingsRow, settingsView } from "@/lib/bot/settings";
import { logError } from "@/lib/log";

/**
 * Saves a server's settings from the dashboard. The bot is asked, at the
 * moment of saving, whether this user may manage the server, and which
 * channels and roles exist, and which roles it may give: nothing from the
 * page is trusted on its own.
 */
export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardDashboard(request, settingsInput);
  if (gate instanceof Response) return gate;
  const { id } = await params;

  try {
    const lists = await authorizeGuild(gate.config, id, gate.user.id);
    if (lists instanceof Response) return lists;
    const guild = await db().guild.findUnique({ where: { id }, select: { id: true, leftAt: true } });
    if (!guild || guild.leftAt) return refused(404, "unknown server");
    // Auto-roles: only the roles the bot reported as assignable, on this
    // request. Without Manage Roles they are still saved (the dashboard
    // warns, the bot marks them failing at the next join): turning the
    // permission back on must not need a second save.
    const checked = checkAgainstGuild(
      gate.body,
      new Set(lists.channels.map((c) => c.id)),
      new Set(mentionableRoles(lists.roles).map((r) => r.id)),
      new Set(lists.roles.filter((r) => r.assignable).map((r) => r.id)),
    );
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
