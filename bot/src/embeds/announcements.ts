import type { RESTPostAPIChannelMessageJSONBody } from "discord.js";
import type { Locale } from "../i18n/index.js";
import { PAYLOADS, type AnnouncementType } from "../site/schemas.js";
import { baseEmbed, clip, COLORS, openRow, type View, makeView } from "./common.js";

/**
 * Announcement messages, posted by the manager over REST (no gateway needed).
 *
 * Mentions are locked down here, once: `allowed_mentions` parses nothing and
 * lists only the role the server configured, so a payload can never ping
 * @everyone, @here or anyone else, whatever text it carries.
 */

const COLOR_BY_TYPE: Record<AnnouncementType, number> = {
  patches: COLORS.green,
  skins: COLORS.brand,
  events: COLORS.azure,
  advanceServer: COLORS.night,
  esports: COLORS.blood,
};

/** Mention settings of every bot post: nothing, or exactly the configured role. */
export function allowedMentionsFor(roleId: string | null): RESTPostAPIChannelMessageJSONBody["allowed_mentions"] {
  return { parse: [], roles: roleId ? [roleId] : [], users: [], replied_user: false };
}

function withRole(roleId: string | null, body: RESTPostAPIChannelMessageJSONBody): RESTPostAPIChannelMessageJSONBody {
  return { ...body, ...(roleId ? { content: `<@&${roleId}>` } : {}), allowed_mentions: allowedMentionsFor(roleId) };
}

/**
 * The message of one announcement for one server, or null when the payload
 * does not have the shape of its type (the delivery is then marked failed).
 */
/** "2026-11" as "November 2026" in the locale; the raw value when it is not a month. */
export function monthName(month: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function announcementMessage(
  type: AnnouncementType,
  payload: unknown,
  locale: Locale,
  roleId: string | null,
  siteUrl: string,
): RESTPostAPIChannelMessageJSONBody | null {
  const view = makeView(locale, siteUrl, `announce-${type}`);
  const embed = baseEmbed(view, COLOR_BY_TYPE[type]);
  let path: string;

  switch (type) {
    case "patches": {
      const p = PAYLOADS.patches.safeParse(payload);
      if (!p.success) return null;
      path = p.data.url;
      embed
        .setTitle(clip(view.t("ui.announce.patchTitle", { version: p.data.version }), 256))
        .setDescription(view.t("ui.announce.patchBody", p.data.counts));
      break;
    }
    case "skins": {
      const p = PAYLOADS.skins.safeParse(payload);
      if (!p.success) return null;
      path = p.data.url;
      embed
        .setTitle(clip(view.t("ui.announce.skinTitle", { name: p.data.name }), 256))
        .setDescription(view.t("ui.announce.skinBody", { hero: p.data.heroName }));
      const image = view.asset(p.data.image);
      if (image) embed.setImage(image);
      break;
    }
    case "events": {
      const p = PAYLOADS.events.safeParse(payload);
      if (!p.success) return null;
      path = p.data.url;
      // The site sends the month only: it is named in the server's language.
      const title = p.data.title ?? monthName(p.data.month, locale);
      embed.setTitle(clip(view.t("ui.announce.eventTitle", { title }), 256));
      if (p.data.count !== undefined) embed.setDescription(view.t("ui.announce.eventBody", { count: p.data.count }));
      break;
    }
    case "advanceServer": {
      const p = PAYLOADS.advanceServer.safeParse(payload);
      if (!p.success) return null;
      path = p.data.url;
      embed.setTitle(clip(view.t("ui.announce.advanceTitle", { version: p.data.version }), 256)).setDescription(view.t("ui.announce.advanceBody"));
      break;
    }
    case "esports": {
      const p = PAYLOADS.esports.safeParse(payload);
      if (!p.success) return null;
      path = p.data.url;
      embed.setTitle(clip(view.t("ui.announce.esportsTitle", { name: p.data.name }), 256));
      if (p.data.winner) embed.setDescription(view.t("ui.announce.esportsWinner", { winner: p.data.winner }));
      break;
    }
  }
  embed.setURL(view.link(path));
  return withRole(roleId, { embeds: [embed.toJSON()], components: [openRow(view, path).toJSON()] });
}

/** The dashboard's "send a test" post. */
export function testMessage(view: View): RESTPostAPIChannelMessageJSONBody {
  return withRole(null, {
    embeds: [baseEmbed(view).setTitle(view.t("ui.announce.testTitle")).setDescription(view.t("ui.announce.testBody")).setURL(view.link("/bot")).toJSON()],
  });
}
