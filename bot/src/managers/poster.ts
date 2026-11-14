import { RESTJSONErrorCodes, Routes, type REST, type RESTPostAPIChannelMessageJSONBody } from "discord.js";

/**
 * Posting from the manager process, over Discord's REST API: a message to a
 * channel id needs no gateway connection, so the delivery loops do not care
 * which shard holds the server. Rate limits and 5xx retries are handled by
 * @discordjs/rest.
 */

export interface Poster {
  post(channelId: string, body: RESTPostAPIChannelMessageJSONBody): Promise<{ id: string }>;
  /** Custom ids of the components of the bot's own recent messages in a channel. */
  recentCustomIds(channelId: string, botId: string, limit?: number): Promise<string[]>;
}

export function restPoster(rest: REST): Poster {
  return {
    async post(channelId, body) {
      return (await rest.post(Routes.channelMessages(channelId), { body })) as { id: string };
    },
    async recentCustomIds(channelId, botId, limit = 20) {
      const query = new URLSearchParams({ limit: String(limit) });
      const messages = (await rest.get(Routes.channelMessages(channelId), { query })) as {
        author?: { id?: string };
        components?: { components?: { custom_id?: string }[] }[];
      }[];
      return messages
        .filter((m) => m.author?.id === botId)
        .flatMap((m) => (m.components ?? []).flatMap((row) => (row.components ?? []).flatMap((c) => (c.custom_id ? [c.custom_id] : []))));
    },
  };
}

export type Failure = "forbidden" | "transient" | "failed";

/**
 * What a posting error means for the delivery:
 * - `forbidden`: the channel is gone or the bot lost its permissions. Retrying
 *   will not help; the dashboard shows the setting as failing.
 * - `transient`: Discord or the network hiccuped; retry later, with backoff.
 * - `failed`: anything else (a malformed message): give up on this one.
 */
export function classifyError(error: unknown): Failure {
  const e = error as { code?: unknown; status?: unknown };
  const code = typeof e.code === "number" ? e.code : undefined;
  const status = typeof e.status === "number" ? e.status : undefined;
  const forbiddenCodes: number[] = [
    RESTJSONErrorCodes.MissingAccess,
    RESTJSONErrorCodes.MissingPermissions,
    RESTJSONErrorCodes.UnknownChannel,
    RESTJSONErrorCodes.UnknownGuild,
    RESTJSONErrorCodes.CannotSendMessagesInNonTextChannel,
  ];
  if (code !== undefined && forbiddenCodes.includes(code)) return "forbidden";
  if (status === 403 || status === 404) return "forbidden";
  if (status === undefined || status === 429 || status >= 500) return "transient";
  return "failed";
}

/** A short, secret-free error label for the site's delivery record. */
export function errorLabel(error: unknown): string {
  const e = error as { code?: unknown; status?: unknown; name?: unknown };
  return [e.name, e.status, e.code].filter((x) => x !== undefined).join(" ").slice(0, 200) || "error";
}
