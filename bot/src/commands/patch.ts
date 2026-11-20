import { optionName, slash, stringOption } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { dexNote, openRow, plain, replyRow } from "../embeds/common.js";
import { inviteFor } from "./shared.js";
import { patchEmbed } from "../embeds/game.js";
import type { Patch } from "../site/game-data.js";

/**
 * Accepts "2.1.90", "v2.1.90", "Patch 2.1.90" or a hotfix, "2.2.16a" (the
 * site writes the letter in lower case); null when no version can be read.
 */
export function parseVersion(input: string | null): string | null {
  if (!input) return null;
  const m = /(\d+(?:\.\d+){1,3})([a-z])?(?![\da-z])/i.exec(input);
  return m ? `${m[1]!}${(m[2] ?? "").toLowerCase()}` : null;
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
      .filter((p) => p.version.startsWith(query.replace(/^v/i, "").toLowerCase()))
      .slice(0, 25)
      .map((p) => ({ name: p.title.slice(0, 100), value: p.version }));
  },
  async execute(interaction, ctx) {
    const raw = interaction.options.getString(optionName("patch", "version"));
    const version = parseVersion(raw);
    const patches = await ctx.services.data.patches();
    const found = findPatch(patches, version);
    if (!found) {
      const unknown = ctx.t("ui.patch.unknown", { version: plain((version ?? raw ?? "").slice(0, 20)) });
      const recent = patches.slice(0, 5).map((p) => `\`${p.version}\``);
      await interaction.editReply({
        embeds: [
          dexNote(ctx, recent.length ? `${unknown}\n${ctx.t("ui.patch.recent", { versions: recent.join(", ") })}` : unknown),
        ],
        components: [openRow(ctx, "/patch-notes")],
      });
      return;
    }
    const detail = await ctx.services.data.patch(found.version, ctx.locale).catch(() => null);
    await interaction.editReply({
      embeds: [patchEmbed(ctx, found, detail, found === patches[0])],
      components: [replyRow(ctx, `/patch-notes/${found.version}`, inviteFor(ctx, interaction.guildId))],
    });
  },
};
