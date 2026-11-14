import { SPELLS } from "../catalog.js";
import { optionName, slash, stringOption } from "../discord/builders.js";
import type { Command, Context } from "../discord/types.js";
import { openRow } from "../embeds/common.js";
import { spellEmbed } from "../embeds/game.js";
import { resolveByName, searchByName, toChoices } from "../search.js";
import { withDetails } from "./emblem.js";
import { replyNotFound } from "./shared.js";

const spells = (ctx: Context) => withDetails(SPELLS, () => ctx.services.data.spells(ctx.locale));

export const spell: Command = {
  key: "spell",
  data: () => slash("spell").addStringOption(stringOption("spell", "name", { required: true, autocomplete: true })).toJSON(),
  async autocomplete(interaction, ctx) {
    return toChoices(searchByName((await spells(ctx)).entries, String(interaction.options.getFocused())));
  },
  async execute(interaction, ctx) {
    const query = interaction.options.getString(optionName("spell", "name"), true);
    const { entries, details } = await spells(ctx);
    const found = resolveByName(entries, query) ?? resolveByName(SPELLS, query);
    if (!found) return replyNotFound(interaction, ctx, query, entries);
    await interaction.editReply({
      embeds: [spellEmbed(ctx, found, details.get(found.slug) ?? null)],
      components: [openRow(ctx, `/spells/${found.slug}`)],
    });
  },
};
