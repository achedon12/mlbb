import { db } from "@/lib/db";
import { BotUnavailable, refreshGuildQuietly, removeRoleMenuMessage } from "@/lib/bot/client";
import { answer, authorizeGuild, guardDashboard, refused } from "@/lib/bot/dashboard-guard";
import { menuIdOf, saveRoleMenu } from "@/lib/bot/role-menu-routes";
import { logError } from "@/lib/log";

/**
 * One role menu: PUT saves it (checked like a new one, see `saveRoleMenu`),
 * DELETE removes it and asks the bot to delete its message.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; menu: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id, menu } = await params;
  const menuId = menuIdOf(menu);
  if (menuId === null) return refused(404, "unknown menu");
  return saveRoleMenu(request, id, menuId);
}

export async function DELETE(request: Request, { params }: Params) {
  const gate = await guardDashboard(request, null);
  if (gate instanceof Response) return gate;
  const { id, menu } = await params;
  const menuId = menuIdOf(menu);
  if (menuId === null) return refused(404, "unknown menu");
  try {
    const lists = await authorizeGuild(gate.config, id, gate.user.id);
    if (lists instanceof Response) return lists;
    const stored = await db().roleMenu.findFirst({ where: { id: menuId, guildId: id } });
    if (!stored) return refused(404, "unknown menu");
    await db().roleMenu.delete({ where: { id: stored.id } });
    // Its message would only answer "no longer active": deleted too, best effort.
    const removed =
      stored.messageId && stored.messageChannelId
        ? await removeRoleMenuMessage(gate.config, id, stored.messageChannelId, stored.messageId).then((r) => r.ok, () => false)
        : false;
    await refreshGuildQuietly(gate.config, id);
    return answer({ ok: true, messageRemoved: removed });
  } catch (error) {
    if (error instanceof BotUnavailable) return refused(503, "bot unavailable");
    await logError("discord dashboard: role menu delete failed", error, { guild: id });
    return refused(503, "storage unavailable");
  }
}
