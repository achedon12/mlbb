import { PermissionFlagsBits } from "discord.js";
import type { Locale } from "./i18n/index.js";

/**
 * Links back to mlbbdex.com.
 *
 * Every page link carries the language prefix (the site serves one URL per
 * language) and a campaign tag, so Matomo counts the visits the bot brings
 * as their own source instead of "direct" traffic. `utm_campaign` names the
 * command, to tell which ones send readers to the site.
 */

export function siteLink(siteUrl: string, locale: Locale, path: string, campaign?: string): string {
  const url = new URL(`${siteUrl}/${locale}${path === "/" ? "" : path}`);
  url.searchParams.set("utm_source", "discord");
  url.searchParams.set("utm_medium", "bot");
  if (campaign) url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

/**
 * Absolute URL of a site asset ("/visuels/heros/aamon/icone.webp"). Anything
 * that is not a site-relative path or an https URL is dropped: Discord would
 * reject the whole embed for one bad image URL.
 */
export function assetUrl(siteUrl: string, path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https:\/\//.test(path)) return path;
  if (path.startsWith("/") && !path.startsWith("//")) return `${siteUrl}${encodeURI(path)}`;
  return undefined;
}

/**
 * Invite permissions, least privilege: what the announcements and the replies
 * need, nothing more (no Administrator, no moderation).
 */
export const INVITE_PERMISSIONS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.SendMessagesInThreads |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.AttachFiles |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.UseExternalEmojis |
  PermissionFlagsBits.AddReactions;

export function inviteUrl(clientId: string): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("permissions", INVITE_PERMISSIONS.toString());
  url.searchParams.set("scope", "bot applications.commands");
  return url.toString();
}

export function voteUrl(clientId: string): string {
  return `https://top.gg/bot/${clientId}/vote`;
}
