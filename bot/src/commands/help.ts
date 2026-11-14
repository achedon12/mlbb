import { slash } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { baseEmbed } from "../embeds/common.js";

/** The commands listed by /help, in display order. */
export const HELP_ORDER = [
  "hero", "build", "counter", "tierlist", "compare", "item", "emblem", "spell", "patch", "skins", "events",
  "nickname", "mlbbdle", "quiz", "leaderboard", "servertime", "setup", "invite", "about",
];

export const help: Command = {
  key: "help",
  ephemeral: true,
  data: () => slash("help").toJSON(),
  async execute(interaction, ctx) {
    const lines = HELP_ORDER.map((k) => `**/${ctx.t(`commands.${k}.name`)}** — ${ctx.t(`commands.${k}.description`)}`);
    await interaction.editReply({
      embeds: [baseEmbed(ctx).setTitle(ctx.t("ui.help.title")).setURL(ctx.link("/bot")).setDescription(lines.join("\n")).setFooter({ text: ctx.t("ui.help.footer") })],
    });
  },
};
