import { optionName, slash, stringOption } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { openRow } from "../embeds/common.js";
import { heroSkinsEmbed, newestSkinsEmbed, unavailableEmbed } from "../embeds/game.js";
import { heroChoices, heroOrReply } from "./shared.js";

export const skins: Command = {
  key: "skins",
  data: () => slash("skins").addStringOption(stringOption("skins", "hero", { autocomplete: true })).toJSON(),
  autocomplete: heroChoices,
  async execute(interaction, ctx) {
    const query = interaction.options.getString(optionName("skins", "hero"));
    if (query) {
      const found = await heroOrReply(interaction, ctx, query);
      if (!found) return;
      await interaction.editReply({ embeds: [heroSkinsEmbed(ctx, found)], components: [openRow(ctx, `/heroes/${found.slug}/skins`)] });
      return;
    }
    const newest = await ctx.services.data.newestSkins();
    if (!newest) {
      await interaction.editReply({ embeds: [unavailableEmbed(ctx, "/skins/calendar")], components: [openRow(ctx, "/skins/calendar")] });
      return;
    }
    const heroes = await ctx.services.data.heroes();
    const name = (slug: string) => heroes.find((h) => h.slug === slug)?.name ?? slug;
    await interaction.editReply({ embeds: [newestSkinsEmbed(ctx, newest, name)], components: [openRow(ctx, "/skins/calendar")] });
  },
};
