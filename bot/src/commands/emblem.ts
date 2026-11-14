import { EMBLEMS, type CatalogEntry } from "../catalog.js";
import { optionName, slash, stringOption } from "../discord/builders.js";
import type { Command, Context } from "../discord/types.js";
import { openRow } from "../embeds/common.js";
import { emblemEmbed } from "../embeds/game.js";
import { resolveByName, searchByName, toChoices } from "../search.js";
import type { NamedEntry } from "../site/game-data.js";
import { replyNotFound } from "./shared.js";

/** The catalog with the site's localized names when the API serves them. */
export async function withDetails(
  catalog: CatalogEntry[],
  load: () => Promise<NamedEntry[] | null>,
): Promise<{ entries: CatalogEntry[]; details: Map<string, NamedEntry> }> {
  const list = await load().catch(() => null);
  const details = new Map((list ?? []).map((d) => [d.slug, d]));
  return { entries: catalog.map((e) => ({ ...e, name: details.get(e.slug)?.name ?? e.name })), details };
}

const emblems = (ctx: Context) => withDetails(EMBLEMS, () => ctx.services.data.emblems(ctx.locale));

export const emblem: Command = {
  key: "emblem",
  data: () => slash("emblem").addStringOption(stringOption("emblem", "name", { required: true, autocomplete: true })).toJSON(),
  async autocomplete(interaction, ctx) {
    return toChoices(searchByName((await emblems(ctx)).entries, String(interaction.options.getFocused())));
  },
  async execute(interaction, ctx) {
    const query = interaction.options.getString(optionName("emblem", "name"), true);
    const { entries, details } = await emblems(ctx);
    const found = resolveByName(entries, query) ?? resolveByName(EMBLEMS, query);
    if (!found) return replyNotFound(interaction, ctx, query, entries);
    await interaction.editReply({
      embeds: [emblemEmbed(ctx, found, details.get(found.slug) ?? null)],
      components: [openRow(ctx, `/emblems/${found.slug}`)],
    });
  },
};
