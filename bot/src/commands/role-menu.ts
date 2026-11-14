import { MessageFlags, type ButtonInteraction, type Client, type StringSelectMenuInteraction } from "discord.js";
import { checkGuildRoles } from "../discord/auto-roles.js";
import { granterVerdict } from "../discord/granters.js";
import { ROLE_MENU_PREFIX, RoleMenus } from "../discord/role-menus.js";
import type { ComponentHandler, Context } from "../discord/types.js";
import { roleMenuReply } from "../embeds/role-menu.js";
import { log } from "../log.js";
import type { SiteClient } from "../site/internal-api.js";

/**
 * Clicks on a role menu's message (`rolemenu:<menu>` select, and
 * `rolemenu:<menu>:clear` button). The decision is `RoleMenus`'; this
 * acknowledges the click at once and tells the member, privately.
 *
 * A pick in the select is acknowledged by re-sending the message's own
 * components, which resets the menu on the member's screen: picking the
 * same role again later still reaches the bot. That acknowledgement edits
 * the public message, so nothing past it may throw back to the dispatcher,
 * whose error path edits the original reply: here, the server's menu.
 */

let service: RoleMenus | null = null;

/** One per shard, sharing the rate limit across clicks. */
function roleMenus(client: Client, site: SiteClient): RoleMenus {
  service ??= new RoleMenus({
    menus: (guildId, fresh) => site.roleMenus(guildId, fresh),
    check: (guildId, roleIds) => checkGuildRoles(client.guilds.cache.get(guildId), roleIds),
    granter: (guildId, userId, roleIds) => granterVerdict(client.guilds.cache.get(guildId), userId, roleIds),
  });
  return service;
}

const MENU_ID = /^\d{1,12}$/;

async function acknowledge(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<(text: string) => Promise<unknown>> {
  const allowedMentions = { parse: [] };
  if (interaction.isStringSelectMenu()) {
    await interaction.update({ components: interaction.message.components.map((row) => row.toJSON()) });
    return (content) => interaction.followUp({ content, flags: MessageFlags.Ephemeral, allowedMentions });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  return (content) => interaction.editReply({ content, allowedMentions });
}

export const roleMenuHandler: ComponentHandler = {
  prefix: ROLE_MENU_PREFIX,
  async handle(interaction, ctx: Context, args) {
    const [menuId, extra, ...rest] = args;
    const wellFormed =
      menuId !== undefined && MENU_ID.test(menuId) && !rest.length && (interaction.isButton() ? extra === "clear" : extra === undefined);
    const site = ctx.services.site;
    if (!wellFormed || !site || !interaction.inCachedGuild()) {
      await interaction.reply({ content: ctx.t("ui.roleMenu.unknownMenu"), flags: MessageFlags.Ephemeral });
      return;
    }

    const say = await acknowledge(interaction);
    try {
      const guild = interaction.guild;
      const outcome = await roleMenus(interaction.client, site).handle({
        guildId: guild.id,
        userId: interaction.user.id,
        menuId,
        messageId: interaction.message.id,
        action: interaction.isStringSelectMenu() ? { type: "select", values: interaction.values } : { type: "clear" },
        memberRoles: new Set(interaction.member.roles.cache.keys()),
        addRole: (role, reason) => guild.members.addRole({ user: interaction.user.id, role, reason }),
        removeRole: (role, reason) => guild.members.removeRole({ user: interaction.user.id, role, reason }),
      });
      await say(roleMenuReply(ctx, outcome));
    } catch (error) {
      // The interaction expired, or Discord did not take the reply: logged, never rethrown.
      log.warn("role menu reply failed", { guild: interaction.guildId, error });
    }
  },
};
