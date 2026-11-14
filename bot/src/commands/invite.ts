import { ActionRowBuilder, type ButtonBuilder } from "discord.js";
import { slash } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { baseEmbed, linkButton } from "../embeds/common.js";
import { inviteUrl } from "../links.js";

export const invite: Command = {
  key: "invite",
  ephemeral: true,
  data: () => slash("invite").toJSON(),
  async execute(interaction, ctx) {
    await interaction.editReply({
      embeds: [baseEmbed(ctx).setDescription(ctx.t("ui.invite.body"))],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton(ctx.t("ui.invite.button"), inviteUrl(ctx.services.clientId)))],
    });
  },
};
