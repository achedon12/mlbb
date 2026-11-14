import { ActionRowBuilder, StringSelectMenuBuilder, type ButtonBuilder, type EmbedBuilder } from "discord.js";
import { slash } from "../discord/builders.js";
import type { Command, ComponentHandler, Context } from "../discord/types.js";
import { baseEmbed, FAMILIES, FAMILY_COLORS, linkButton, type Family, type View } from "../embeds/common.js";
import { inviteUrl, voteUrl } from "../links.js";

/**
 * /help: an overview, then one page per family of commands, switched with a
 * select menu. Each command comes with an example in the reader's language
 * (command and option names are localized too), and the reply ends with the
 * links a newcomer looks for: invite, support server, website, vote.
 */

/** An option of the example and its value; a value starting with "choices." is a choice label to translate. */
type Example = [option: string, value: string][];

export interface HelpEntry {
  key: string;
  example?: Example;
}

export interface HelpCategory {
  key: Family;
  emoji: string;
  commands: HelpEntry[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    key: "heroes",
    emoji: "🛡️",
    commands: [
      { key: "hero", example: [["name", "Layla"]] },
      { key: "build", example: [["hero", "Chou"], ["rank", "choices.rank.glory"]] },
      { key: "skins", example: [["hero", "Lesley"]] },
      { key: "item", example: [["name", "Blade of Despair"]] },
      { key: "emblem", example: [["name", "Assassin Emblem"]] },
      { key: "spell", example: [["name", "Retribution"]] },
    ],
  },
  {
    key: "meta",
    emoji: "📊",
    commands: [
      { key: "tierlist", example: [["rank", "choices.rank.mythic"], ["lane", "choices.lane.Jungle"]] },
      { key: "counter", example: [["hero", "Ling"]] },
      { key: "compare", example: [["first", "Chou"], ["second", "Paquito"]] },
    ],
  },
  {
    key: "news",
    emoji: "📰",
    commands: [{ key: "patch" }, { key: "events" }],
  },
  {
    key: "games",
    emoji: "🎮",
    commands: [
      { key: "mlbbdle", example: [["guess", "Miya"]] },
      { key: "quiz" },
      { key: "leaderboard", example: [["game", "choices.game.quiz"], ["period", "choices.period.week"]] },
    ],
  },
  {
    key: "tools",
    emoji: "🧰",
    commands: [{ key: "nickname", example: [["text", "Shadow"], ["style", "choices.style.fraktur"]] }, { key: "servertime" }],
  },
  {
    key: "setup",
    emoji: "⚙️",
    commands: [{ key: "setup" }, { key: "help" }, { key: "invite" }, { key: "about" }],
  },
];

/** Every command /help lists, in display order. */
export const HELP_ORDER = HELP_CATEGORIES.flatMap((c) => c.commands.map((e) => e.key));

export type HelpPage = Family | "overview";

export function parseHelpPage(value: string | null | undefined): HelpPage {
  return value && (FAMILIES as readonly string[]).includes(value) ? (value as Family) : "overview";
}

const commandName = (view: View, key: string) => `/${view.t(`commands.${key}.name`)}`;

/** "/build hero:Fanny rank:Mythical Glory", with the reader's command and option names. */
export function exampleLine(view: View, entry: HelpEntry): string {
  const args = (entry.example ?? []).map(([option, value]) => {
    const shown = value.startsWith("choices.") ? view.t(value) : value;
    return `${view.t(`commands.${entry.key}.options.${option}.name`)}:${shown}`;
  });
  return [commandName(view, entry.key), ...args].join(" ");
}

export function helpEmbed(view: View, page: HelpPage): EmbedBuilder {
  const embed = baseEmbed(view, page === "overview" ? FAMILY_COLORS.setup : FAMILY_COLORS[page]).setURL(view.link("/bot"));
  if (page === "overview") {
    return embed
      .setTitle(view.t("ui.help.title"))
      .setDescription(view.t("ui.help.intro"))
      .addFields(
        ...HELP_CATEGORIES.map((c) => ({
          name: `${c.emoji} ${view.t(`ui.help.categories.${c.key}`)}`,
          value: c.commands.map((e) => `\`${commandName(view, e.key)}\``).join(" "),
        })),
        { name: view.t("ui.help.startTitle"), value: view.t("ui.help.start", { example: `\`${exampleLine(view, HELP_CATEGORIES[0]!.commands[0]!)}\`` }) },
      );
  }
  const category = HELP_CATEGORIES.find((c) => c.key === page)!;
  return embed
    .setTitle(`${category.emoji} ${view.t(`ui.help.categories.${page}`)}`)
    .setDescription(view.t("ui.help.pick"))
    .addFields(
      category.commands.map((e) => ({
        name: commandName(view, e.key),
        value: `${view.t(`commands.${e.key}.description`)}\n\`${exampleLine(view, e)}\``,
      })),
    );
}

export interface HelpLinks {
  invite: string;
  support: string | undefined;
  website: string;
  vote: string;
}

export function helpLinks(ctx: Context): HelpLinks {
  return {
    invite: inviteUrl(ctx.services.clientId),
    support: ctx.services.config.SUPPORT_SERVER_URL,
    website: ctx.link("/bot"),
    vote: voteUrl(ctx.services.clientId),
  };
}

/** The category menu (the current page preselected), then the four links. */
export function helpComponents(view: View, page: HelpPage, links: HelpLinks) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("help:page")
    .setPlaceholder(view.t("ui.help.menu"))
    .addOptions(
      { label: view.t("ui.help.overview"), value: "overview", emoji: "🏠", default: page === "overview" },
      ...HELP_CATEGORIES.map((c) => ({
        label: view.t(`ui.help.categories.${c.key}`),
        description: c.commands.map((e) => commandName(view, e.key)).join(", ").slice(0, 100),
        value: c.key,
        emoji: c.emoji,
        default: page === c.key,
      })),
    );
  const buttons: ButtonBuilder[] = [
    linkButton(view.t("ui.common.addToServer"), links.invite),
    ...(links.support ? [linkButton(view.t("ui.about.support"), links.support)] : []),
    linkButton(view.t("ui.about.site"), links.website),
    linkButton(view.t("ui.about.vote"), links.vote),
  ];
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(buttons),
  ];
}

export const help: Command = {
  key: "help",
  instant: true,
  ephemeral: true,
  data: () => slash("help").toJSON(),
  async execute(interaction, ctx) {
    await interaction.editReply({ embeds: [helpEmbed(ctx, "overview")], components: helpComponents(ctx, "overview", helpLinks(ctx)) });
  },
};

/** The category menu: the message is updated in place, nothing is fetched. */
export const helpMenu: ComponentHandler = {
  prefix: "help",
  async handle(interaction, ctx) {
    if (!interaction.isStringSelectMenu()) return;
    const page = parseHelpPage(interaction.values[0]);
    await interaction.update({ embeds: [helpEmbed(ctx, page)], components: helpComponents(ctx, page, helpLinks(ctx)) });
  },
};
