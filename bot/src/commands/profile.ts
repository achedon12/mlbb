import { ActionRowBuilder, AttachmentBuilder, MessageFlags, type ButtonBuilder, type ChatInputCommandInteraction, type EmbedBuilder } from "discord.js";
import { optionName, slash, userOption } from "../discord/builders.js";
import type { Command } from "../discord/types.js";
import { dexNote, linkButton, plain, type View } from "../embeds/common.js";
import { NotFoundError, SiteUnavailableError } from "../site/http.js";
import type { ProfileCard } from "../site/internal-api.js";

/**
 * /profile [user]: a member's Mobile Legends profile card, as an image drawn
 * by the site (`/api/bot/profile`). The site holds the link between Discord
 * and game accounts and decides who may see what:
 *
 * - your own card, once you linked it on mlbbdex.com (signed in there with
 *   your game account and this Discord account at once);
 * - someone else's, only if they made theirs public on the site.
 *
 * The card goes to the channel; every "no" (not linked, figures too old,
 * private, too many tries) is only shown to the member who asked, with the
 * way to fix it when there is one.
 */

/** Where the card is linked, updated and set: the account page's section. */
export const CARD_PATH = "/account#discord-card";
export const CARD_FILE = "mlbbdex-profile.png";

export type ProfileReply =
  | { visibility: "channel"; files: AttachmentBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] }
  | { visibility: "private"; embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] };

/** What to answer, from the site's verdict: pure, for the tests. */
export function profileReply(view: View, card: ProfileCard | "siteDown", o: { own: boolean; targetName: string }): ProfileReply {
  const row = (label: string) => [new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton(label, view.link(CARD_PATH)))];
  if (card !== "siteDown" && "png" in card) {
    const file = new AttachmentBuilder(card.png, {
      name: CARD_FILE,
      description: view.t("ui.profile.alt", { name: o.targetName }).slice(0, 1024),
    });
    return { visibility: "channel", files: [file], components: row(view.t(o.own ? "ui.profile.manageButton" : "ui.profile.getYours")) };
  }
  const say = (text: string, button?: string): ProfileReply => ({
    visibility: "private",
    embeds: [dexNote(view, text)],
    components: button ? row(button) : [],
  });
  if (card === "siteDown") return say(view.t("ui.common.siteDown"));
  switch (card.reason) {
    case "notLinked":
      return say(view.t("ui.profile.notLinked"), view.t("ui.profile.linkButton"));
    case "stale":
      return say(view.t("ui.profile.stale"), view.t("ui.profile.updateButton"));
    case "rateLimited":
      return say(view.t("ui.profile.rateLimited"));
    default:
      // Someone else's card, linked or not: the same answer either way.
      return o.own
        ? say(view.t("ui.profile.notLinked"), view.t("ui.profile.linkButton"))
        : say(view.t("ui.profile.unavailable", { name: plain(o.targetName) }), view.t("ui.profile.getYours"));
  }
}

/** The deferred reply was public: a private answer replaces it with an ephemeral follow-up. */
async function send(interaction: ChatInputCommandInteraction, reply: ProfileReply): Promise<void> {
  if (reply.visibility === "channel") {
    await interaction.editReply({ files: reply.files, components: reply.components, allowedMentions: { parse: [] } });
    return;
  }
  await interaction.deleteReply().catch(() => undefined);
  await interaction.followUp({ embeds: reply.embeds, components: reply.components, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}

export const profile: Command = {
  key: "profile",
  data: () => slash("profile").addUserOption(userOption("profile", "user")).toJSON(),
  async execute(interaction, ctx) {
    const picked = interaction.options.getUser(optionName("profile", "user"));
    const target = picked ?? interaction.user;
    const own = target.id === interaction.user.id;
    const targetName = (picked ? (interaction.options.getMember(optionName("profile", "user")) as { displayName?: string } | null)?.displayName : null) ?? target.displayName ?? target.username;
    const site = ctx.services.site;

    if (!site) {
      await send(interaction, profileReply(ctx, "siteDown", { own, targetName }));
      return;
    }
    // Bots have no game account: no need to ask the site.
    if (target.bot) {
      await send(interaction, profileReply(ctx, { reason: "unavailable" }, { own: false, targetName }));
      return;
    }
    let card: ProfileCard | "siteDown";
    try {
      card = await site.profileCard(target.id, interaction.user.id, ctx.locale);
    } catch (error) {
      if (!(error instanceof SiteUnavailableError) && !(error instanceof NotFoundError)) throw error;
      card = "siteDown";
    }
    await send(interaction, profileReply(ctx, card, { own, targetName }));
  },
};
