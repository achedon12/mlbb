import { optionName, slash, stringOption } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { openRow } from "../embeds/common.js";
import { itemEmbed } from "../embeds/game.js";
import { resolveByName, searchByName, toChoices } from "../search.js";
import { replyNotFound } from "./shared.js";

export const item: Command = {
  key: "item",
  data: () => slash("item").addStringOption(stringOption("item", "name", { required: true, autocomplete: true })).toJSON(),
  async autocomplete(interaction, ctx) {
    return toChoices(searchByName(await ctx.services.data.items(ctx.locale), String(interaction.options.getFocused())));
  },
  async execute(interaction, ctx) {
    const query = interaction.options.getString(optionName("item", "name"), true);
    // The localized list first, the English one second: players often type
    // the English name they see in guides.
    const found =
      resolveByName(await ctx.services.data.items(ctx.locale), query) ??
      (ctx.locale === "en" ? null : resolveByName(await ctx.services.data.items("en"), query));
    if (!found) return replyNotFound(interaction, ctx, query);
    const localized = (await ctx.services.data.items(ctx.locale)).find((i) => i.slug === found.slug) ?? found;
    await interaction.editReply({ embeds: [itemEmbed(ctx, localized)], components: [openRow(ctx, `/items/${found.slug}`)] });
  },
};
