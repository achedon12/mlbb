import { slash } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { baseEmbed, FAMILY_COLORS } from "../embeds/common.js";
import { nextResetDaily, nextResetWeekly, nextStarlight, wallServer } from "../games/server-time.js";

/** Discord timestamps: each reader sees them in their own timezone and language. */
const stamp = (ms: number, style: "R" | "F" | "t") => `<t:${Math.floor(ms / 1000)}:${style}>`;

export const servertime: Command = {
  key: "servertime",
  data: () => slash("servertime").toJSON(),
  async execute(interaction, ctx) {
    const now = Date.now();
    const wall = wallServer(now);
    const hhmm = `${String(wall.getUTCHours()).padStart(2, "0")}:${String(wall.getUTCMinutes()).padStart(2, "0")}`;
    const embed = baseEmbed(ctx, FAMILY_COLORS.tools)
      .setTitle(ctx.t("ui.servertime.title"))
      .setURL(ctx.link("/tools/server-time"))
      .addFields(
        { name: ctx.t("ui.servertime.now"), value: `**${hhmm}**`, inline: true },
        { name: ctx.t("ui.servertime.daily"), value: `${stamp(nextResetDaily(now), "R")}\n${stamp(nextResetDaily(now), "F")}` },
        { name: ctx.t("ui.servertime.weekly"), value: `${stamp(nextResetWeekly(now), "R")}\n${stamp(nextResetWeekly(now), "F")}` },
        { name: ctx.t("ui.servertime.starlight"), value: `${stamp(nextStarlight(now), "R")}\n${stamp(nextStarlight(now), "F")}` },
      );
    await interaction.editReply({ embeds: [embed] });
  },
};
