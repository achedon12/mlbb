import { choiceOption, optionName, slash } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { baseEmbed, COLORS } from "../embeds/common.js";
import { leaderboardEmbed } from "../embeds/daily.js";
import { GAMES, PERIODS, type Game, type Period } from "../site/schemas.js";

export function parseLeaderboardOptions(game: string | null, period: string | null): { game: Game; period: Period } {
  return {
    game: game && (GAMES as readonly string[]).includes(game) ? (game as Game) : "mlbbdle-classic",
    period: period && (PERIODS as readonly string[]).includes(period) ? (period as Period) : "week",
  };
}

export const leaderboard: Command = {
  key: "leaderboard",
  guildOnly: true,
  data: () =>
    slash("leaderboard", { guildOnly: true })
      .addStringOption(choiceOption("leaderboard", "game", "game", GAMES))
      .addStringOption(choiceOption("leaderboard", "period", "period", PERIODS))
      .toJSON(),
  async execute(interaction, ctx) {
    const { game, period } = parseLeaderboardOptions(
      interaction.options.getString(optionName("leaderboard", "game")),
      interaction.options.getString(optionName("leaderboard", "period")),
    );
    if (!interaction.guildId || !ctx.services.site) {
      await interaction.editReply({ embeds: [baseEmbed(ctx, COLORS.slate).setDescription(ctx.t("ui.common.siteDown"))] });
      return;
    }
    const board = await ctx.services.site.leaderboard(interaction.guildId, game, period);
    await interaction.editReply({ embeds: [leaderboardEmbed(ctx, game, period, board)], allowedMentions: { parse: [] } });
  },
};
