import { ActionRowBuilder, PermissionFlagsBits, type ButtonBuilder } from "discord.js";
import { slash } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { baseEmbed, linkButton } from "../embeds/common.js";

export const setup: Command = {
  key: "setup",
  ephemeral: true,
  guildOnly: true,
  data: () => slash("setup", { guildOnly: true }).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).toJSON(),
  async execute(interaction, ctx) {
    // The default permission hides the command, but a server can override
    // it: the check is repeated here, and again on the site for every save.
    if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.editReply({ content: ctx.t("ui.common.noPermission") });
      return;
    }
    const url = ctx.link(`/bot/dashboard?guild=${interaction.guildId}`);
    await interaction.editReply({
      embeds: [baseEmbed(ctx).setDescription(ctx.t("ui.setup.body")).setURL(url).setTitle(ctx.t("ui.setup.button"))],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton(ctx.t("ui.setup.button"), url))],
    });
  },
};
