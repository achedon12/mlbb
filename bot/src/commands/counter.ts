import { choiceOption, optionName, slash, stringOption } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { replyRow } from "../embeds/common.js";
import { counterEmbed } from "../embeds/game.js";
import { RANKS } from "../site/game-data.js";
import { countersOf, heroChoices, heroOrReply, inviteFor, parseRank } from "./shared.js";

export const counter: Command = {
  key: "counter",
  data: () =>
    slash("counter")
      .addStringOption(stringOption("counter", "hero", { required: true, autocomplete: true }))
      .addStringOption(choiceOption("counter", "rank", "rank", RANKS))
      .toJSON(),
  autocomplete: heroChoices,
  async execute(interaction, ctx) {
    const found = await heroOrReply(interaction, ctx, interaction.options.getString(optionName("counter", "hero"), true));
    if (!found) return;
    const counters = await countersOf(ctx, found, parseRank(interaction.options.getString(optionName("counter", "rank"))));
    await interaction.editReply({ embeds: [counterEmbed(ctx, found, counters)], components: [replyRow(ctx, `/heroes/${found.slug}/counters`, inviteFor(ctx, interaction.guildId))] });
  },
};
