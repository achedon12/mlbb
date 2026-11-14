import { ActionRowBuilder, type ButtonBuilder } from "discord.js";
import { slash } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { baseEmbed, FAMILY_COLORS, linkButton } from "../embeds/common.js";
import { helpLinks } from "./help.js";

export const invite: Command = {
  key: "invite",
  instant: true,
  ephemeral: true,
  data: () => slash("invite").toJSON(),
  async execute(interaction, ctx) {
    const links = helpLinks(ctx);
    await interaction.editReply({
      embeds: [baseEmbed(ctx, FAMILY_COLORS.setup).setTitle(ctx.t("ui.invite.title")).setURL(links.invite).setDescription(ctx.t("ui.invite.body"))],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          linkButton(ctx.t("ui.invite.button"), links.invite),
          ...(links.support ? [linkButton(ctx.t("ui.about.support"), links.support)] : []),
        ),
      ],
    });
  },
};
