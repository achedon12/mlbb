import { ActionRowBuilder, type ButtonBuilder, type Client, type EmbedBuilder } from "discord.js";
import { slash } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { baseEmbed, FAMILY_COLORS, linkButton, type View } from "../embeds/common.js";
import { formatNumber } from "../i18n/index.js";
import { VERSION } from "../version.js";
import { helpLinks } from "./help.js";

export interface AboutFacts {
  version: string;
  /** Null when a shard did not answer: the figure is left out rather than wrong. */
  servers: number | null;
  /** When this shard's process started, in milliseconds. */
  startedAt: number;
}

/** The languages of the replies, each in its own name. */
const LANGUAGES = "English · Français · Italiano · Español · Bahasa Indonesia";

export function aboutEmbed(view: View, facts: AboutFacts): EmbedBuilder {
  const embed = baseEmbed(view, FAMILY_COLORS.setup)
    .setTitle(view.t("ui.about.title"))
    .setURL(view.link("/bot"))
    .setThumbnail(view.asset("/icons/icon-512.png") ?? null)
    .setDescription(view.t("ui.about.body"))
    .addFields({ name: view.t("ui.about.version"), value: `\`${facts.version}\``, inline: true });
  if (facts.servers !== null) embed.addFields({ name: view.t("ui.about.servers"), value: formatNumber(view.locale, facts.servers), inline: true });
  // A Discord timestamp: "3 days ago", in each reader's language.
  embed.addFields(
    { name: view.t("ui.about.uptime"), value: `<t:${Math.floor(facts.startedAt / 1000)}:R>`, inline: true },
    { name: view.t("ui.about.languages"), value: LANGUAGES },
  );
  return embed;
}

/** Servers across every shard, or null when one of them is restarting. */
export async function serverCount(client: Client): Promise<number | null> {
  try {
    const counts = (await client.shard?.fetchClientValues("guilds.cache.size")) as number[] | undefined;
    return counts ? counts.reduce((a, b) => a + b, 0) : client.guilds.cache.size;
  } catch {
    return null;
  }
}

export const about: Command = {
  key: "about",
  ephemeral: true,
  data: () => slash("about").toJSON(),
  async execute(interaction, ctx) {
    const facts = { version: VERSION, servers: await serverCount(interaction.client), startedAt: Date.now() - process.uptime() * 1000 };
    const links = helpLinks(ctx);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      linkButton(ctx.t("ui.common.addToServer"), links.invite),
      ...(links.support ? [linkButton(ctx.t("ui.about.support"), links.support)] : []),
      linkButton(ctx.t("ui.about.site"), links.website),
      linkButton(ctx.t("ui.about.vote"), links.vote),
      linkButton(ctx.t("ui.about.privacy"), ctx.link("/bot/privacy")),
    );
    await interaction.editReply({ embeds: [aboutEmbed(ctx, facts)], components: [row] });
  },
};
