import { slash } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { openRow } from "../embeds/common.js";
import { eventsEmbed, unavailableEmbed } from "../embeds/game.js";

export const events: Command = {
  key: "events",
  data: () => slash("events").toJSON(),
  async execute(interaction, ctx) {
    const list = await ctx.services.data.events(ctx.locale);
    await interaction.editReply({
      embeds: [list ? eventsEmbed(ctx, list) : unavailableEmbed(ctx, "/events")],
      components: [openRow(ctx, "/events")],
    });
  },
};
