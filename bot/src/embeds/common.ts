import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown } from "discord.js";
import { formatPercent, translator, type Locale, type Translator } from "../i18n/index.js";
import { assetUrl, siteLink } from "../links.js";

/** Site palette (`src/app/globals.css`): gold for the brand, the rest by meaning. */
export const COLORS = {
  brand: 0xe0a92e,
  azure: 0x2b7fe0,
  blood: 0xd94848,
  green: 0x3fb37f,
  night: 0x131b30,
  violet: 0x8f6ee6,
  blurple: 0x5865f2,
  /** Errors and empty states: visible on Discord's dark and light themes, unlike night. */
  slate: 0x7a86a8,
} as const;

export const TIER_COLORS: Record<string, number> = { "S+": 0xd94848, S: 0xe0a92e, A: 0x3fb37f, B: 0x2b7fe0, C: 0x7a86a8 };

/**
 * Command families, as /help groups them. Each has its colour, so a reply
 * says at a glance what kind of answer it is: a hero, the meta, news...
 */
export const FAMILIES = ["heroes", "meta", "news", "games", "tools", "setup"] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_COLORS: Record<Family, number> = {
  heroes: COLORS.brand,
  meta: COLORS.blood,
  news: COLORS.green,
  games: COLORS.azure,
  tools: COLORS.violet,
  setup: COLORS.blurple,
};

/** The site's icon, shown small next to every footer. */
export const FOOTER_ICON = "/icons/icon-192.png";

/** What an embed builder needs: the language, its texts, and how to link to the site. */
export interface View {
  locale: Locale;
  t: Translator;
  link: (path: string) => string;
  asset: (path: string | null | undefined) => string | undefined;
  percent: (value: number | null | undefined) => string;
}

export function makeView(locale: Locale, siteUrl: string, campaign?: string): View {
  return {
    locale,
    t: translator(locale),
    link: (path) => siteLink(siteUrl, locale, path, campaign),
    asset: (path) => assetUrl(siteUrl, path),
    percent: (value) => formatPercent(locale, value),
  };
}

/** Embed field values are capped at 1024 characters, descriptions at 4096. */
export function clip(text: string, max = 1024): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Text a member typed (an option, a display name), shown back in one of the
 * bot's messages: every markdown construct is escaped, masked links,
 * headings and lists included, which `escapeMarkdown` leaves alone by
 * default. Otherwise `/item name:[Free Nitro](https://evil.example)` posts,
 * in the channel and in the bot's name, a link whose target is hidden
 * behind a trusted-looking label. Mentions are a separate matter: every
 * send path turns them off (`allowedMentions`).
 */
export function plain(text: string): string {
  return escapeMarkdown(text, { maskedLink: true, heading: true, bulletedList: true, numberedList: true });
}

/**
 * The "nothing found" reply, quoting what was typed (escaped, cut to 100
 * characters), with the closest names when there are some.
 */
export function notFoundEmbed(view: View, query: string, suggestions: string[] = []): EmbedBuilder {
  const hint = suggestions.length
    ? view.t("ui.common.didYouMean", { names: suggestions.slice(0, 3).map((s) => `**${plain(s)}**`).join(", ") })
    : view.t("ui.common.pickSuggestion");
  return baseEmbed(view, COLORS.slate).setDescription(`${view.t("ui.common.notFound", { query: plain(query.slice(0, 100)) })}\n${hint}`);
}

/** The reply when something failed: the site down (with when to retry) or anything else. */
export function errorEmbed(view: View, siteDown: boolean): EmbedBuilder {
  return baseEmbed(view, COLORS.slate).setDescription(view.t(siteDown ? "ui.common.siteDown" : "ui.common.error"));
}

/** Every reply's frame: the family's colour, and the source with the site's name in the footer. */
export function baseEmbed(view: View, color: number = COLORS.brand): EmbedBuilder {
  const icon = view.asset(FOOTER_ICON);
  return new EmbedBuilder().setColor(color).setFooter({ text: view.t("ui.common.source"), ...(icon ? { iconURL: icon } : {}) });
}

export function linkButton(label: string, url: string): ButtonBuilder {
  return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label.slice(0, 80)).setURL(url);
}

export function openRow(view: View, path: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton(view.t("ui.common.open"), view.link(path)));
}

/**
 * Should a reply offer "Add to your server"? Everywhere but the community
 * server: its members already know the bot, and an invite there reads as
 * an advert. When the community server is not configured, everywhere.
 */
export function offersInvite(guildId: string | null, communityGuildId: string | undefined): boolean {
  return !communityGuildId || guildId !== communityGuildId;
}

/**
 * The single row of links under the main informational replies: the page on
 * the site and, outside the community server, the invite. Nothing more: no
 * DM, no extra message.
 */
export function replyRow(view: View, path: string, invite: string | null): ActionRowBuilder<ButtonBuilder> {
  const row = openRow(view, path);
  if (invite) row.addComponents(linkButton(view.t("ui.common.addToServer"), invite));
  return row;
}

/** A list joined for a field, never empty (Discord rejects an empty field). */
export function listOr(view: View, values: string[], separator = ", "): string {
  return values.length ? clip(values.join(separator)) : view.t("ui.common.none");
}

/**
 * A list for a field that never ends cut in the middle of a name: past
 * `max` entries, or what fits in the field's 1024 characters, the rest is
 * counted ("+12 more").
 */
export function listMore(view: View, values: string[], separator = ", ", max = values.length): string {
  if (!values.length) return view.t("ui.common.none");
  const more = (n: number) => view.t("ui.common.more", { n });
  const shown: string[] = [];
  for (const v of values.slice(0, max)) {
    const rest = values.length - shown.length - 1;
    const length = [...shown, v].join(separator).length + (rest > 0 ? separator.length + more(rest).length : 0);
    if (length > 1024) break;
    shown.push(v);
  }
  const hidden = values.length - shown.length;
  return hidden > 0 ? `${shown.join(separator)}${separator}${more(hidden)}` : shown.join(separator);
}

/** Translated label, or the raw value when the files have none (a role added by a sync). */
export function label(view: View, group: string, value: string): string {
  const key = `${group}.${value}`;
  const text = view.t(key);
  return text === key ? value : text;
}

export function roleLabels(view: View, roles: string[]): string[] {
  return roles.map((r) => label(view, "labels.roles", r));
}

export function laneLabels(view: View, lanes: string[]): string[] {
  return lanes.map((l) => label(view, "labels.lanes", l));
}
