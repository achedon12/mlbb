import { db } from "@/lib/db";
import { BotUnavailable, grantableRoles, mentionableRoles } from "@/lib/bot/client";
import { answer, authorizeGuild, guardDashboard, refused } from "@/lib/bot/dashboard-guard";
import {
  AUTO_ROLES_NOT_GRANTABLE,
  autoRoleNeedsGrantable,
  autoRolesChanged,
  autoRoleWrite,
  checkAgainstGuild,
  settingsInput,
  settingsRow,
  settingsView,
} from "@/lib/bot/settings";
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
    const guild = await db().guild.findUnique({ where: { id }, select: { id: true, leftAt: true, locale: true, settings: true } });
    if (!guild || guild.leftAt) return refused(404, "unknown server");
    const stored = settingsView(id, guild.locale, guild.settings).autoRoles;
    const unchanged = !autoRolesChanged(stored, gate.body.autoRoles);
    // Auto-roles: only the roles the bot reported as assignable, on this
    // request. Without Manage Roles they are still saved (the dashboard
    // warns, the bot marks them failing at the next join): turning the
    // permission back on must not need a second save. Lists left as they
    // were are not checked again: another manager's save of an unrelated
    // setting must not fail on them (the bot checks them at every join).
    const assignable = new Set(lists.roles.filter((r) => r.assignable).map((r) => r.id));
    if (unchanged) for (const roleId of [...stored.roleIds, ...stored.botRoleIds]) assignable.add(roleId);
    const checked = checkAgainstGuild(
      gate.body,
      new Set(lists.channels.map((c) => c.id)),
      new Set(mentionableRoles(lists.roles).map((r) => r.id)),
      assignable,
    );
    if (!checked.ok) return refused(400, `unknown channel or role: ${checked.field}`);

    // And only roles this manager could give themselves (confused deputy).
    const grantable = autoRoleNeedsGrantable(stored, checked.value.autoRoles)
      ? (await grantableRoles(gate.config, id, gate.user.id)).grantable
      : null;
    const autoRoles = autoRoleWrite(stored, checked.value.autoRoles, gate.user.id, grantable);
    if (!autoRoles.ok) return refused(400, AUTO_ROLES_NOT_GRANTABLE);

    const row = settingsRow(checked.value, autoRoles.write);
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
