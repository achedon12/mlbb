import { choiceOption, optionName, slash, stringOption } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { replyRow } from "../embeds/common.js";
import { buildEmbed } from "../embeds/game.js";
import { RANKS } from "../site/game-data.js";
import { buildsOf, heroChoices, heroOrReply, inviteFor, parseRank } from "./shared.js";

export const build: Command = {
  key: "build",
  data: () =>
    slash("build")
      .addStringOption(stringOption("build", "hero", { required: true, autocomplete: true }))
      .addStringOption(choiceOption("build", "rank", "rank", RANKS))
      .toJSON(),
  autocomplete: heroChoices,
  async execute(interaction, ctx) {
    const found = await heroOrReply(interaction, ctx, interaction.options.getString(optionName("build", "hero"), true));
    if (!found) return;
    const { builds, rank } = await buildsOf(ctx, found, parseRank(interaction.options.getString(optionName("build", "rank"))));
    await interaction.editReply({ embeds: [buildEmbed(ctx, found, builds, rank)], components: [replyRow(ctx, `/builds/${found.slug}`, inviteFor(ctx, interaction.guildId))] });
  },
};
