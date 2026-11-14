import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import { BotUnavailable, grantableRoles, guildEmojis, refreshGuildQuietly } from "./client";
import { answer, authorizeGuild, guardDashboard, refused } from "./dashboard-guard";
import { MAX_ROLE_MENUS, ROLE_MENU_NOT_GRANTABLE } from "./kinds";
import { parseEmoji } from "./role-menu-emoji";
import { checkRoleMenu, roleIdsOf, roleMenuData, roleMenuInput, roleMenuOwner, roleMenuView, storedOptions } from "./role-menus";

/**
 * The dashboard's role menu writes, shared by the create and update
 * routes. Like the settings save: the server id comes from the path only,
 * the bot is asked on this request whether the user manages it, which
 * channels and roles it reports, which roles it may give, which emojis
 * the server has, and which roles this user could give themselves.
 */

/** A menu id from the path: digits only, or no menu. */
export function menuIdOf(value: string): number | null {
  if (!/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

const sameRoles = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id) => b.includes(id));

/** `menuId` null: a new menu. */
export async function saveRoleMenu(request: Request, guildId: string, menuId: number | null): Promise<Response> {
  const gate = await guardDashboard(request, roleMenuInput);
  if (gate instanceof Response) return gate;
  try {
    const lists = await authorizeGuild(gate.config, guildId, gate.user.id);
    if (lists instanceof Response) return lists;
    const guild = await db().guild.findUnique({ where: { id: guildId }, select: { leftAt: true } });
    if (!guild || guild.leftAt) return refused(404, "unknown server");

    // Read under the server of the path: another server's menu id finds nothing.
    const stored = menuId === null ? null : await db().roleMenu.findFirst({ where: { id: menuId, guildId } });
    if (menuId !== null && !stored) return refused(404, "unknown menu");
    if (!stored && (await db().roleMenu.count({ where: { guildId } })) >= MAX_ROLE_MENUS) return refused(409, "too many menus");

    const storedRoles = stored ? roleIdsOf(storedOptions(stored.options)) : [];
    const roleIds = roleIdsOf(gate.body.options);
    // Only roles the bot reported as assignable, on this request. Roles left
    // as they were are not checked again (the bot checks them before every
    // change): another manager can still fix a title or move the channel.
    const assignable = new Set(lists.roles.filter((r) => r.assignable).map((r) => r.id));
    if (stored && sameRoles(storedRoles, roleIds)) for (const id of storedRoles) assignable.add(id);
    const custom = gate.body.options.some((o) => o.emoji && parseEmoji(o.emoji)?.kind === "custom");
    const emojis = new Set(custom ? (await guildEmojis(gate.config, guildId)).map((e) => e.id) : []);
    const checked = checkRoleMenu(gate.body, { channels: new Set(lists.channels.map((c) => c.id)), assignable, emojis });
    if (!checked.ok) return refused(400, `unknown channel, role or emoji: ${checked.field}`);

    // And only roles this manager could give themselves (confused deputy).
    const { grantable } = await grantableRoles(gate.config, guildId, gate.user.id);
    const owner = roleMenuOwner(stored ? { roleIds: storedRoles, configuredBy: stored.configuredBy } : null, roleIds, gate.user.id, grantable);
    if (!owner.ok) return refused(400, ROLE_MENU_NOT_GRANTABLE);

    const data = roleMenuData(gate.body, owner.configuredBy);
    const row = stored
      ? await db().roleMenu.update({ where: { id: stored.id }, data })
      : await db().roleMenu.create({ data: { guildId, ...data } });
    await refreshGuildQuietly(gate.config, guildId);
    return answer(roleMenuView(row), stored ? 200 : 201);
  } catch (error) {
    if (error instanceof BotUnavailable) return refused(503, "bot unavailable");
    await logError("discord dashboard: role menu save failed", error, { guild: guildId });
    return refused(503, "storage unavailable");
  }
}
