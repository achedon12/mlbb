import { escapeMarkdown, type RESTPostAPIChannelMessageJSONBody } from "discord.js";
import { formatNumber } from "../i18n/index.js";
import { GREETING_MAX_LENGTH, type GreetingKind } from "../site/schemas.js";
import { baseEmbed, clip, type View } from "./common.js";

/**
 * Welcome and goodbye messages, posted when a member joins or leaves.
 *
 * The text is the owner's (or the default one, in the server's language),
 * so it is treated as untrusted twice over: mentions in it are neutralised
 * before the placeholders are filled, the names that fill them are escaped,
 * and `allowed_mentions` lets through at most the newcomer, never a role,
 * @everyone or @here, whatever the text says.
 */

export const PLACEHOLDERS = ["user", "username", "server", "count"] as const;
type Placeholder = (typeof PLACEHOLDERS)[number];

/** A member as the message needs it: nothing else is read, nothing is kept. */
export interface GreetedMember {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface GreetingContext {
  member: GreetedMember;
  guildName: string;
  memberCount: number;
  /** The owner's text, or null for the default one. */
  custom: string | null;
}

// A zero-width space after the @ breaks the mention for Discord while the
// text still reads the same.
const BREAK = "@\u200b";

/**
 * The owner's text, safe to post: @everyone and @here broken, role and user
 * mentions removed (only `{user}` may name someone), blank runs squeezed,
 * capped at the dashboard's limit.
 */
export function sanitizeGreeting(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/<@&\d+>/g, "")
    .replace(/<@!?\d+>/g, "")
    .replace(/@(everyone|here)/gi, `${BREAK}$1`)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, GREETING_MAX_LENGTH);
}

/** A name dropped into the text: no Markdown, no mention of any kind. */
export function escapeName(name: string): string {
  return escapeMarkdown(name).replace(/@/g, BREAK);
}

/**
 * Fills the placeholders in one pass, so a value that itself reads
 * "{server}" (a username can) is never expanded again. Unknown
 * placeholders are left as typed.
 */
export function fillPlaceholders(template: string, values: Record<Placeholder, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    (PLACEHOLDERS as readonly string[]).includes(name) ? values[name as Placeholder] : match,
  );
}

/**
 * The text of a welcome or goodbye message. On a goodbye, `{user}` is the
 * plain name: someone who left is never pinged, and a mention of a former
 * member would only show as an unknown user anyway.
 */
export function greetingText(view: View, kind: GreetingKind, ctx: GreetingContext): string {
  const custom = ctx.custom ? sanitizeGreeting(ctx.custom) : "";
  const template = custom || view.t(`ui.greetings.${kind}`);
  const username = escapeName(ctx.member.username);
  return clip(
    fillPlaceholders(template, {
      user: kind === "welcome" ? `<@${ctx.member.id}>` : username,
      username,
      server: escapeName(ctx.guildName),
      count: formatNumber(view.locale, ctx.memberCount),
    }),
    4096,
  );
}

/** Mention settings: the newcomer alone on a welcome that pings, nobody otherwise. */
export function greetingMentions(userId: string | null): NonNullable<RESTPostAPIChannelMessageJSONBody["allowed_mentions"]> {
  return { parse: [], users: userId ? [userId] : [], roles: [], replied_user: false };
}

/**
 * The message for one member. A mention inside an embed never notifies, so
 * a welcome that should ping carries the mention in `content` as well;
 * `ping: false` (the dashboard's test) leaves it out.
 */
export function greetingMessage(
  view: View,
  kind: GreetingKind,
  ctx: GreetingContext,
  options: { ping: boolean; title?: string },
): RESTPostAPIChannelMessageJSONBody {
  const embed = baseEmbed(view).setDescription(greetingText(view, kind, ctx));
  if (options.title) embed.setTitle(clip(options.title, 256));
  if (kind === "welcome" && ctx.member.avatarUrl) embed.setThumbnail(ctx.member.avatarUrl);
  const ping = kind === "welcome" && options.ping;
  return {
    ...(ping ? { content: `<@${ctx.member.id}>` } : {}),
    embeds: [embed.toJSON()],
    allowed_mentions: greetingMentions(ping ? ctx.member.id : null),
  };
}

/** One message for a burst of joins or leaves: no names, no pings. */
export function greetingSummary(view: View, kind: GreetingKind, count: number): RESTPostAPIChannelMessageJSONBody {
  const key = kind === "welcome" ? "ui.greetings.welcomeRaid" : "ui.greetings.goodbyeRaid";
  return {
    embeds: [baseEmbed(view).setDescription(view.t(key, { count: formatNumber(view.locale, count) })).toJSON()],
    allowed_mentions: greetingMentions(null),
  };
}
