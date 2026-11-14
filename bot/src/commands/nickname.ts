import { ActionRowBuilder, StringSelectMenuBuilder, type EmbedBuilder } from "discord.js";
import { choiceOption, optionName, slash, stringOption } from "../discord/builders.js";
import type { Command, ComponentHandler } from "../discord/types.js";
import { baseEmbed, FAMILY_COLORS, linkButton, plain, type View } from "../embeds/common.js";
import { measure, sanitize, STYLES, stylize, type Style } from "../games/nicknames.js";

/**
 * The site's nickname generator (its most used tool) in Discord. The reply is
 * ephemeral, with a menu to try every style on the same text; the text
 * travels in the menu's custom id, so nothing is stored.
 */

export function parseStyle(value: string | null): Style {
  return value && (STYLES as readonly string[]).includes(value) ? (value as Style) : "bold";
}

const PREFIX = "nick:";

export function nicknameEmbed(view: View, text: string, style: Style): EmbedBuilder {
  const styled = stylize(text, style);
  const { codePoints } = measure(styled);
  return baseEmbed(view, FAMILY_COLORS.tools)
    .setTitle(view.t("ui.nickname.title"))
    .setDescription(`# ${plain(styled)}\n${view.t("ui.nickname.copy")}`)
    .addFields(
      { name: view.t(`choices.style.${style}`), value: view.t("ui.nickname.length", { n: codePoints }), inline: true },
    );
}

export function nicknameComponents(view: View, text: string, style: Style) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${PREFIX}${text}`)
    .setPlaceholder(view.t("ui.nickname.pick"))
    .addOptions(
      STYLES.map((s) => ({
        label: view.t(`choices.style.${s}`).slice(0, 100),
        description: stylize(text, s).slice(0, 100),
        value: s,
        default: s === style,
      })),
    );
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    new ActionRowBuilder<ReturnType<typeof linkButton>>().addComponents(linkButton(view.t("ui.common.open"), view.link("/tools/nickname"))),
  ];
}

export const nickname: Command = {
  key: "nickname",
  instant: true,
  ephemeral: true,
  data: () =>
    slash("nickname")
      .addStringOption(stringOption("nickname", "text", { required: true, maxLength: 32 }))
      .addStringOption(choiceOption("nickname", "style", "style", STYLES))
      .toJSON(),
  async execute(interaction, ctx) {
    const text = sanitize(interaction.options.getString(optionName("nickname", "text"), true));
    if (!text) {
      await interaction.editReply({ content: ctx.t("ui.nickname.empty") });
      return;
    }
    const style = parseStyle(interaction.options.getString(optionName("nickname", "style")));
    await interaction.editReply({ embeds: [nicknameEmbed(ctx, text, style)], components: nicknameComponents(ctx, text, style) });
  },
};

export const nicknameMenu: ComponentHandler = {
  prefix: "nick",
  async handle(interaction, ctx) {
    if (!interaction.isStringSelectMenu()) return;
    // The text is everything after the prefix (it may itself contain ":"),
    // and is sanitized again: a custom id is client-controlled input.
    const text = sanitize(interaction.customId.slice(PREFIX.length));
    if (!text) return;
    const style = parseStyle(interaction.values[0] ?? null);
    await interaction.update({ embeds: [nicknameEmbed(ctx, text, style)], components: nicknameComponents(ctx, text, style) });
  },
};
