/**
 * Discord bot: the public side, safe in the browser. Only `NEXT_PUBLIC_*`
 * values, inlined at build time: the application id (for the "Add to
 * Discord" link) and the community server's invite.
 *
 * The bot pages exist only when the application id is set at build time;
 * the invite link stands on its own, with or without the bot.
 */

const SNOWFLAKE = /^\d{17,20}$/;

/** Application id, or null when the bot is not deployed. */
export function botClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID?.trim() ?? "";
  return SNOWFLAKE.test(id) ? id : null;
}

export const botPublished = () => botClientId() !== null;

/**
 * Community server invite, or null. Only Discord's own invite addresses are
 * accepted: a typo in the variable must not turn the header link into a
 * link to anywhere.
 */
export function communityInvite(): string | null {
  const raw = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL?.trim() ?? "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const valid =
      url.protocol === "https:" &&
      (host === "discord.gg" || ((host === "discord.com" || host === "www.discord.com") && url.pathname.startsWith("/invite/")));
    return valid ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Permissions asked at invite, least privilege (docs/discord-bot.md): no
 * Administrator, nothing that reads members or manages anything.
 */
export const BOT_PERMISSIONS = {
  AddReactions: 2 ** 6,
  ViewChannel: 2 ** 10,
  SendMessages: 2 ** 11,
  EmbedLinks: 2 ** 14,
  AttachFiles: 2 ** 15,
  ReadMessageHistory: 2 ** 16,
  UseExternalEmojis: 2 ** 18,
  SendMessagesInThreads: 2 ** 38,
} as const;

// A sum rather than `|`: bitwise operators work on 32 bits, and threads sit at
// bit 38. Every value is a distinct power of two, below 2^53: the sum is exact.
export const PERMISSIONS_BITFIELD = String(Object.values(BOT_PERMISSIONS).reduce((a, b) => a + b, 0));

export const BOT_SCOPES = ["bot", "applications.commands"] as const;

/**
 * "Add to Discord" address. `guild` preselects a server, for the dashboard's
 * "add the bot" links; Discord then lets the user pick another one anyway.
 */
export function inviteUrl(clientId: string, guild?: string): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("permissions", PERMISSIONS_BITFIELD);
  url.searchParams.set("scope", BOT_SCOPES.join(" "));
  if (guild && SNOWFLAKE.test(guild)) {
    url.searchParams.set("guild_id", guild);
    url.searchParams.set("disable_guild_select", "true");
  }
  return url.toString();
}

export const isSnowflake = (value: string) => SNOWFLAKE.test(value);

/** Server icon or user avatar on Discord's CDN, or null. Hashes only: no URL from the outside. */
export function discordImage(kind: "icons" | "avatars", id: string, hash: string | null, size = 64): string | null {
  if (!hash || !/^(a_)?[0-9a-f]{32}$/.test(hash) || !SNOWFLAKE.test(id)) return null;
  return `https://cdn.discordapp.com/${kind}/${id}/${hash}.webp?size=${size}`;
}
