import { z } from "zod";
import { log } from "@/lib/log";
import type { BotConfig } from "./config";
import type { GreetingKind } from "./kinds";
import { signedHeaders } from "./signature";

/**
 * Calls to the bot's internal API (`bot/`, port 3100, internal network),
 * signed like the calls it makes to the site. Every answer is validated:
 * the dashboard renders what comes back, so a malformed answer is an error,
 * never something displayed as is.
 *
 * Short timeout: a page waiting on a bot that does not answer shows "the bot
 * is unreachable" after a few seconds rather than hanging.
 */

const TIMEOUT_MS = 5_000;

export class BotUnavailable extends Error {}

async function call<S extends z.ZodType>(
  config: BotConfig,
  method: "GET" | "POST",
  path: string,
  schema: S,
  body?: unknown,
): Promise<z.infer<S>> {
  const raw = body === undefined ? "" : JSON.stringify(body);
  let response: Response;
  try {
    response = await fetch(`${config.internalUrl}${path}`, {
      method,
      headers: {
        ...signedHeaders(config.apiSecret, method, path, raw),
        ...(raw ? { "Content-Type": "application/json" } : {}),
      },
      body: raw || undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new BotUnavailable(`bot unreachable: ${path.split("?")[0]}`, { cause: error });
  }
  if (!response.ok) {
    void log("warning", "discord bot: internal call refused", { path: path.split("?")[0], status: response.status });
    throw new BotUnavailable(`bot answered ${response.status}`);
  }
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new BotUnavailable(`unexpected answer from the bot: ${path.split("?")[0]}`);
  return parsed.data;
}

const snowflake = z.string().regex(/^\d{17,20}$/);
const name = z.string().max(100);

const guildSummary = z.object({ id: snowflake, name, icon: z.string().max(64).nullable().optional() });
export type BotGuild = z.infer<typeof guildSummary>;

const channel = z.object({ id: snowflake, name, type: z.enum(["text", "announcement"]) });
const role = z.object({ id: snowflake, name });
export type BotChannel = z.infer<typeof channel>;
export type BotRole = z.infer<typeof role>;

const stats = z.object({
  shards: z
    .array(z.object({ id: z.number().int(), status: z.string().max(32), ping: z.number(), guilds: z.number().int() }))
    .max(1_000),
  guildCount: z.number().int(),
  uptimeSec: z.number(),
  memoryMb: z.number(),
});
export type BotStats = z.infer<typeof stats>;

const q = (user: string) => `user=${encodeURIComponent(user)}`;

/** A server id goes into a path: digits only, or no call. */
function idOf(guild: string): string {
  if (!snowflake.safeParse(guild).success) throw new BotUnavailable("invalid server id");
  return guild;
}

/** Servers where the user has Manage Server and the bot is present. */
export const manageableGuilds = (config: BotConfig, user: string) =>
  call(config, "GET", `/internal/guilds/manageable?${q(user)}`, z.object({ guilds: z.array(guildSummary).max(500) })).then(
    (r) => r.guilds,
  );

/** Asked again before every read and write of a server's settings. */
export const canManage = (config: BotConfig, guild: string, user: string) =>
  call(config, "GET", `/internal/guilds/${idOf(guild)}/manageable?${q(user)}`, z.object({ manageable: z.boolean() })).then(
    (r) => r.manageable,
  );

export const guildChannels = (config: BotConfig, guild: string) =>
  call(
    config,
    "GET",
    `/internal/guilds/${idOf(guild)}/channels`,
    z.object({ channels: z.array(channel).max(500), roles: z.array(role).max(250) }),
  );

/**
 * A welcome or goodbye test: the text being edited (saved or not), shown
 * with the dashboard user as the member and the server as the site knows it.
 */
export interface GreetingTest {
  kind: GreetingKind;
  message: string | null;
  member: { id: string; username: string; avatar: string | null };
  guildName: string;
  memberCount: number;
}

/** "Send a test": the announcement sample, or a greeting when one is given. */
export const testPost = (config: BotConfig, guildId: string, channelId: string, locale: string, greeting?: GreetingTest) =>
  call(config, "POST", "/internal/test-post", z.object({ ok: z.boolean(), error: z.string().max(300).optional() }), {
    guildId,
    channelId,
    locale,
    ...greeting,
  });

export const flushAnnouncements = (config: BotConfig) => call(config, "POST", "/internal/announcements/flush", z.unknown(), {});

export const botStats = (config: BotConfig) => call(config, "GET", "/internal/stats", stats);
