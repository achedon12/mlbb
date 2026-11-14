import { ActionRowBuilder, type ButtonBuilder } from "discord.js";
import { slash } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { baseEmbed, linkButton } from "../embeds/common.js";
import { voteUrl } from "../links.js";

export const about: Command = {
  key: "about",
  ephemeral: true,
  data: () => slash("about").toJSON(),
  async execute(interaction, ctx) {
    let servers: number | null;
    try {
      const counts = (await interaction.client.shard?.fetchClientValues("guilds.cache.size")) as number[] | undefined;
      servers = counts ? counts.reduce((a, b) => a + b, 0) : interaction.client.guilds.cache.size;
    } catch {
      servers = null; // A shard restarting: the count is left out rather than wrong.
    }
    const embed = baseEmbed(ctx).setTitle(ctx.t("ui.about.title")).setURL(ctx.link("/bot")).setDescription(ctx.t("ui.about.body"));
    if (servers !== null) embed.addFields({ name: ctx.t("ui.about.servers"), value: String(servers), inline: true });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      linkButton(ctx.t("ui.about.site"), ctx.link("/bot")),
      ...(ctx.services.config.SUPPORT_SERVER_URL ? [linkButton(ctx.t("ui.about.support"), ctx.services.config.SUPPORT_SERVER_URL)] : []),
      linkButton(ctx.t("ui.about.vote"), voteUrl(ctx.services.clientId)),
      linkButton(ctx.t("ui.about.privacy"), ctx.link("/bot/privacy")),
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
