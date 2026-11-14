import { optionName, slash, stringOption } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { baseEmbed, COLORS, openRow } from "../embeds/common.js";
import { patchEmbed } from "../embeds/game.js";
import type { Patch } from "../site/game-data.js";

/** Accepts "2.1.90", "v2.1.90" or "Patch 2.1.90"; null when no version can be read. */
export function parseVersion(input: string | null): string | null {
  if (!input) return null;
  const m = /(\d+(?:\.\d+){1,3})/.exec(input);
  return m ? m[1]! : null;
}

export function findPatch(patches: Patch[], version: string | null): Patch | null {
  if (!version) return patches[0] ?? null;
  return patches.find((p) => p.version === version) ?? null;
}

export const patch: Command = {
  key: "patch",
  data: () => slash("patch").addStringOption(stringOption("patch", "version", { autocomplete: true, maxLength: 20 })).toJSON(),
  async autocomplete(interaction, ctx) {
    const query = String(interaction.options.getFocused()).trim();
    return (await ctx.services.data.patches())
      .filter((p) => p.version.startsWith(query.replace(/^v/i, "")))
      .slice(0, 25)
      .map((p) => ({ name: p.title.slice(0, 100), value: p.version }));
  },
  async execute(interaction, ctx) {
    const raw = interaction.options.getString(optionName("patch", "version"));
    const version = parseVersion(raw);
    const patches = await ctx.services.data.patches();
    const found = findPatch(patches, version);
    if (!found) {
      await interaction.editReply({
        embeds: [baseEmbed(ctx, COLORS.night).setDescription(ctx.t("ui.patch.unknown", { version: (version ?? raw ?? "").slice(0, 20) }))],
        components: [openRow(ctx, "/patch-notes")],
      });
      return;
    }
    const detail = await ctx.services.data.patch(found.version, ctx.locale).catch(() => null);
    await interaction.editReply({
      embeds: [patchEmbed(ctx, found, detail, found === patches[0])],
      components: [openRow(ctx, `/patch-notes/${found.version}`)],
    });
  },
};
