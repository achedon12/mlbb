import { db } from "@/lib/db";
import { BotUnavailable, publishRoleMenu, refreshGuildQuietly } from "@/lib/bot/client";
import { answer, authorizeGuild, guardDashboard, refused } from "@/lib/bot/dashboard-guard";
import { ROLE_MENU_ROLES_UNAVAILABLE } from "@/lib/bot/kinds";
import { menuIdOf } from "@/lib/bot/role-menu-routes";
import { botRoleMenu, roleIdsOf, roleMenuView, storedOptions } from "@/lib/bot/role-menus";
import { limitByMinute } from "@/lib/push-server";
import { logError } from "@/lib/log";

/**
 * "Publish / update the message": the bot posts the menu as saved, or
 * edits the message it already posted (a new one when the channel
 * changed, the old one deleted). Checked on this request: the user
 * manages the server, the channel is one the bot can post in, and every
 * role is still one it may give. A few per minute per user.
 */
export const dynamic = "force-dynamic";

const perUser = limitByMinute(6);

export async function POST(request: Request, { params }: { params: Promise<{ id: string; menu: string }> }) {
  const gate = await guardDashboard(request, null);
  if (gate instanceof Response) return gate;
  const { id, menu } = await params;
  const menuId = menuIdOf(menu);
  if (menuId === null) return refused(404, "unknown menu");
  if (!perUser(gate.user.id)) return refused(429, "too many requests");
  try {
    const lists = await authorizeGuild(gate.config, id, gate.user.id);
    if (lists instanceof Response) return lists;
    const [guild, stored] = await Promise.all([
      db().guild.findUnique({ where: { id }, select: { locale: true, leftAt: true } }),
      db().roleMenu.findFirst({ where: { id: menuId, guildId: id } }),
    ]);
    if (!guild || guild.leftAt) return refused(404, "unknown server");
    if (!stored) return refused(404, "unknown menu");
    if (!lists.channels.some((c) => c.id === stored.channelId)) return answer({ ok: false, error: "channel_not_available" });
    const assignable = new Set(lists.roles.filter((r) => r.assignable).map((r) => r.id));
    const roleIds = roleIdsOf(storedOptions(stored.options));
    if (!roleIds.length || roleIds.some((roleId) => !assignable.has(roleId))) return answer({ ok: false, error: ROLE_MENU_ROLES_UNAVAILABLE });

    const result = await publishRoleMenu(gate.config, id, guild.locale, botRoleMenu(stored));
    if (!result.ok || !result.messageId) return answer({ ok: false, error: result.error ?? "failed" });
    // Both dates the same: "changes not published" compares them.
    const now = new Date();
    const row = await db().roleMenu.update({
      where: { id: stored.id },
      data: { messageId: result.messageId, messageChannelId: result.channelId ?? stored.channelId, publishedAt: now, updatedAt: now },
    });
    // The shard may have cached the menu with its old message: forgotten now.
    await refreshGuildQuietly(gate.config, id);
    return answer({ ok: true, menu: roleMenuView(row) });
  } catch (error) {
    if (error instanceof BotUnavailable) return refused(503, "bot unavailable");
    await logError("discord dashboard: role menu publish failed", error, { guild: id });
    return refused(503, "unavailable");
  }
}
