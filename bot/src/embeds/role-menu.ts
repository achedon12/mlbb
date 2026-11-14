import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type RESTPostAPIChannelMessageJSONBody,
} from "discord.js";
import { clearId, componentEmoji, selectId, type RoleMenuOutcome } from "../discord/role-menus.js";
import type { RoleMenu } from "../site/schemas.js";
import { clip, COLORS, type View } from "./common.js";

/**
 * The message of a role menu: the server's own title and text in an embed,
 * a select menu of its roles, and a button removing them. The title, text
 * and labels are the server's; the placeholder and the button speak the
 * server's language. Nothing in it can ping anyone.
 */
export function roleMenuMessage(view: View, menu: RoleMenu): RESTPostAPIChannelMessageJSONBody {
  const single = menu.mode === "single";
  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle(clip(menu.title, 256))
    .setDescription(clip(menu.description?.trim() || view.t(single ? "ui.roleMenu.defaultSingle" : "ui.roleMenu.defaultMultiple"), 4096));
  const select = new StringSelectMenuBuilder()
    .setCustomId(selectId(menu.id))
    .setPlaceholder(clip(view.t(single ? "ui.roleMenu.placeholderSingle" : "ui.roleMenu.placeholderMultiple"), 150))
    .setMinValues(1)
    .setMaxValues(single ? 1 : menu.options.length)
    .addOptions(
      menu.options.map((option) => {
        const emoji = componentEmoji(option.emoji);
        return { label: clip(option.label, 100), value: option.roleId, ...(emoji ? { emoji } : {}) };
      }),
    );
  const clear = new ButtonBuilder()
    .setCustomId(clearId(menu.id))
    .setStyle(ButtonStyle.Secondary)
    .setLabel(clip(view.t(single ? "ui.roleMenu.clearSingle" : "ui.roleMenu.clearMultiple"), 80));
  return {
    embeds: [embed.toJSON()],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select).toJSON(),
      new ActionRowBuilder<ButtonBuilder>().addComponents(clear).toJSON(),
    ],
    allowed_mentions: { parse: [] },
  };
}

const mentions = (ids: readonly string[]) => ids.map((id) => `<@&${id}>`).join(", ");

/** What a member is told, privately, after using a menu. */
export function roleMenuReply(view: View, outcome: RoleMenuOutcome): string {
  switch (outcome.kind) {
    case "changed": {
      const lines: string[] = [];
      if (outcome.added.length) lines.push(view.t("ui.roleMenu.added", { roles: mentions(outcome.added) }));
      if (outcome.removed.length) lines.push(view.t("ui.roleMenu.removed", { roles: mentions(outcome.removed) }));
      return lines.join("\n") || view.t("ui.roleMenu.failed");
    }
    case "unchanged":
      return view.t(outcome.action === "clear" ? "ui.roleMenu.nothingToRemove" : "ui.roleMenu.alreadyHave");
    case "unknown_menu":
      return view.t("ui.roleMenu.unknownMenu");
    case "unknown_option":
      return view.t("ui.roleMenu.unknownOption");
    case "rate_limited":
      return view.t("ui.roleMenu.rateLimited");
    case "refused":
      return view.t(outcome.reason === "granter" ? "ui.roleMenu.refusedGranter" : outcome.reason === "role" ? "ui.roleMenu.refusedRole" : "ui.roleMenu.refusedBot");
    case "failed":
      return view.t("ui.roleMenu.failed");
  }
}
