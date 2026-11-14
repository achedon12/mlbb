import { optionName, slash, stringOption } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { baseEmbed, COLORS, openRow } from "../embeds/common.js";
import { compareEmbed } from "../embeds/game.js";
import { heroChoices, heroOrReply, rankingOf } from "./shared.js";

/** Head-to-head page of the site: "a-vs-b" in alphabetical order, whatever the order typed. */
export function comparePath(a: string, b: string): string {
  const [x, y] = a < b ? [a, b] : [b, a];
  return `/compare/${x}-vs-${y}`;
}

export const compare: Command = {
  key: "compare",
  data: () =>
    slash("compare")
      .addStringOption(stringOption("compare", "first", { required: true, autocomplete: true }))
      .addStringOption(stringOption("compare", "second", { required: true, autocomplete: true }))
      .toJSON(),
  autocomplete: heroChoices,
  async execute(interaction, ctx) {
    const a = await heroOrReply(interaction, ctx, interaction.options.getString(optionName("compare", "first"), true));
    if (!a) return;
    const b = await heroOrReply(interaction, ctx, interaction.options.getString(optionName("compare", "second"), true));
    if (!b) return;
    if (a.slug === b.slug) {
      await interaction.editReply({ embeds: [baseEmbed(ctx, COLORS.night).setDescription(ctx.t("ui.compare.same"))] });
      return;
    }
    const [ra, rb] = await Promise.all([rankingOf(ctx, a.slug), rankingOf(ctx, b.slug)]);
    const path = comparePath(a.slug, b.slug);
    await interaction.editReply({
      embeds: [compareEmbed(ctx, { hero: a, ranking: ra }, { hero: b, ranking: rb }, path)],
      components: [openRow(ctx, path)],
    });
  },
};
