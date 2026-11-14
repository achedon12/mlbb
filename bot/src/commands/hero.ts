import { MessageFlags } from "discord.js";
import { optionName, slash, stringOption } from "../discord/builders.js";
import type { Command, ComponentHandler } from "../discord/types.js";
import { openRow } from "../embeds/common.js";
import { buildEmbed, counterEmbed, heroButtons, heroEmbed, heroSkinsEmbed } from "../embeds/game.js";
import { buildsOf, countersOf, heroChoices, heroOrReply, inviteFor, rankingOf, topBuildOf } from "./shared.js";

export const hero: Command = {
  key: "hero",
  data: () => slash("hero").addStringOption(stringOption("hero", "name", { required: true, autocomplete: true })).toJSON(),
  autocomplete: heroChoices,
  async execute(interaction, ctx) {
    const found = await heroOrReply(interaction, ctx, interaction.options.getString(optionName("hero", "name"), true));
    if (!found) return;
    const [ranking, build] = await Promise.all([rankingOf(ctx, found.slug), topBuildOf(ctx, found)]);
    await interaction.editReply({ embeds: [heroEmbed(ctx, found, ranking, build)], components: [heroButtons(ctx, found.slug, inviteFor(ctx, interaction.guildId))] });
  },
};

/**
 * The Build · Counters · Skins buttons under a hero sheet. The answer is
 * ephemeral: one member exploring a hero should not flood the channel.
 */
export const heroButtonsHandler: ComponentHandler = {
  prefix: "hero",
  async handle(interaction, ctx, [view, slug]) {
    if (!slug || !/^[a-z0-9-]{1,40}$/.test(slug) || !["build", "counter", "skins"].includes(view ?? "")) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const found = await ctx.services.data.hero(slug);
    if (!found) {
      await interaction.editReply({ content: ctx.t("ui.common.expired") });
      return;
    }
    if (view === "build") {
      const { builds, rank } = await buildsOf(ctx, found, "all");
      await interaction.editReply({ embeds: [buildEmbed(ctx, found, builds, rank)], components: [openRow(ctx, `/builds/${slug}`)] });
    } else if (view === "counter") {
      const counters = await countersOf(ctx, found, "all");
      await interaction.editReply({ embeds: [counterEmbed(ctx, found, counters)], components: [openRow(ctx, `/heroes/${slug}/counters`)] });
    } else {
      await interaction.editReply({ embeds: [heroSkinsEmbed(ctx, found)], components: [openRow(ctx, `/heroes/${slug}/skins`)] });
    }
  },
};
