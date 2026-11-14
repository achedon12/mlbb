import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { formatPercent, translator, type Locale, type Translator } from "../i18n/index.js";
import { assetUrl, siteLink } from "../links.js";

/** Site palette (`src/app/globals.css`): gold for the brand, the rest by meaning. */
export const COLORS = {
  brand: 0xe0a92e,
  azure: 0x2b7fe0,
  blood: 0xd94848,
  green: 0x3fb37f,
  night: 0x131b30,
} as const;

export const TIER_COLORS: Record<string, number> = { "S+": 0xd94848, S: 0xe0a92e, A: 0x3fb37f, B: 0x2b7fe0, C: 0x7a86a8 };

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

export function baseEmbed(view: View, color: number = COLORS.brand): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setFooter({ text: view.t("ui.common.source") });
}

export function linkButton(label: string, url: string): ButtonBuilder {
  return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label.slice(0, 80)).setURL(url);
}

export function openRow(view: View, path: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton(view.t("ui.common.open"), view.link(path)));
}

/** A list joined for a field, never empty (Discord rejects an empty field). */
export function listOr(view: View, values: string[], separator = ", "): string {
  return values.length ? clip(values.join(separator)) : view.t("ui.common.none");
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
