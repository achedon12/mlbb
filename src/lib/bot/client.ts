import { z } from "zod";
import { log } from "@/lib/log";
import type { BotConfig } from "./config";
import { AUTO_ROLE_REFUSALS, GRANTER_REFUSALS, type GranterRefusal, type GreetingKind } from "./kinds";
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
  if (!parsed.success) {
    // Logged: a shape the two sides disagree on is a bug, not an outage.
    void log("warning", "discord bot: unexpected answer", {
      path: path.split("?")[0],
      issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`),
    });
    throw new BotUnavailable(`unexpected answer from the bot: ${path.split("?")[0]}`);
  }
  return parsed.data;
}

const snowflake = z.string().regex(/^\d{17,20}$/);
const name = z.string().max(100);

const guildSummary = z.object({ id: snowflake, name, icon: z.string().max(64).nullable().optional() });
export type BotGuild = z.infer<typeof guildSummary>;

const channel = z.object({ id: snowflake, name, type: z.enum(["text", "announcement"]) });
/**
 * A role of the server. `assignable`: the bot may give it as an auto-role
 * (below its highest role, not managed, no dangerous permission); otherwise
 * `refusal` says why. An older bot sends neither: nothing is assignable.
 * Managed roles are listed for the auto-role picker only, never offered as
 * a mention.
 */
const role = z.object({
  id: snowflake,
  name,
  assignable: z.boolean().default(false),
  refusal: z.enum(AUTO_ROLE_REFUSALS).nullable().default(null),
});
export type BotChannel = z.infer<typeof channel>;
export type BotRole = z.infer<typeof role>;
export type GuildLists = { channels: BotChannel[]; roles: BotRole[]; manageRoles: boolean };

/** Roles an announcement may mention: managed ones (bots, boosts) are left out. */
export const mentionableRoles = (roles: BotRole[]) => roles.filter((r) => r.refusal !== "managed");

/**
 * discord.js's gateway `Status`, in its enum order: the shards send the
 * number (`client.ws.status`, 0 = Ready). A label sent as text is kept.
 */
export const SHARD_STATUSES = [
  "ready",
  "connecting",
  "reconnecting",
  "idle",
  "nearly",
  "disconnected",
  "waitingForGuilds",
  "identifying",
  "resuming",
] as const;
const shardStatus = z.union([
  z.number().int().transform((n): string => SHARD_STATUSES[n] ?? "unknown"),
  z.string().max(32),
]);
const megabytes = z.number().min(0).max(1_000_000);
const seconds = z.number().min(0);

const stats = z.object({
  shards: z
    .array(
      z.object({
        id: z.number().int(),
        status: shardStatus,
        // -1 until the shard's first heartbeat: no ping known yet.
        ping: z.number().transform((p) => (p < 0 ? null : p)),
        guilds: z.number().int(),
        memoryMb: megabytes.optional(),
        uptimeSec: seconds.optional(),
      }),
    )
    .max(1_000),
  guildCount: z.number().int(),
  uptimeSec: seconds,
  memoryMb: megabytes,
  // From newer bots only.
  version: z.string().max(32).optional(),
  node: z.string().max(32).optional(),
  totalShards: z.number().int().optional(),
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

/**
 * The server's channels and roles, for the pickers and every write's
 * checks, and whether the bot holds Manage Roles there (auto-roles need it).
 */
export const guildChannels = (config: BotConfig, guild: string): Promise<GuildLists> =>
  call(
    config,
    "GET",
    `/internal/guilds/${idOf(guild)}/channels`,
    z.object({ channels: z.array(channel).max(500), roles: z.array(role).max(250), manageRoles: z.boolean().default(false) }),
  );

/**
 * Which roles this user may have the bot give (auto-roles), the member
 * fetched live by the bot: owner, or Manage Roles and the role below their
 * highest. Only the roles with no refusal are in `grantable`.
 */
export const grantableRoles = (config: BotConfig, guild: string, user: string) =>
  call(
    config,
    "GET",
    `/internal/guilds/${idOf(guild)}/can-assign?${q(user)}`,
    z.object({
      member: z.boolean(),
      roles: z.array(z.object({ id: snowflake, refusal: z.enum(GRANTER_REFUSALS).nullable() })).max(250),
    }),
  ).then((r) => ({
    refusals: new Map(r.roles.map((role) => [role.id, role.refusal ?? null])),
    grantable: new Set(r.roles.filter((role) => role.refusal === null).map((role) => role.id)),
  }));

/**
 * Why this dashboard user may not give a role as an auto-role, or null when
 * they may. A role the bot did not answer for counts as refused: never
 * offered on a guess. (`null` is an answer: the role is grantable.)
 */
export function refusalFor(refusals: ReadonlyMap<string, GranterRefusal | null>, roleId: string): GranterRefusal | null {
  return refusals.has(roleId) ? (refusals.get(roleId) ?? null) : "not_member";
}

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

const emoji = z.object({ id: snowflake, name: z.string().min(1).max(32), animated: z.boolean().default(false) });
export type BotEmoji = z.infer<typeof emoji>;

/** The server's custom emojis, for the role menu pickers and the save's checks. */
export const guildEmojis = (config: BotConfig, guild: string): Promise<BotEmoji[]> =>
  call(config, "GET", `/internal/guilds/${idOf(guild)}/emojis`, z.object({ emojis: z.array(emoji).max(500) })).then((r) => r.emojis);

/**
 * The dashboard changed this server: the shard holding it forgets the
 * settings, role menus and managers it cached, so the change applies at
 * once rather than within minutes. A fresh body each time: the bot
 * refuses a signature it has already seen.
 */
export const refreshGuild = (config: BotConfig, guild: string) =>
  call(config, "POST", `/internal/guilds/${idOf(guild)}/refresh`, z.unknown(), { nonce: crypto.randomUUID() });

/** Same, never failing the dashboard's own answer: the cache expires within minutes anyway. */
export const refreshGuildQuietly = (config: BotConfig, guild: string) => refreshGuild(config, guild).catch(() => undefined);

/** What the bot needs to post a role menu: the stored menu, as it reads it from the site. */
export interface BotRoleMenu {
  id: number;
  channelId: string;
  title: string;
  description: string | null;
  mode: string;
  options: { roleId: string; label: string; emoji: string | null }[];
  configuredBy: string;
  messageId: string | null;
  messageChannelId: string | null;
}

/** Posts the menu's message, or edits the one already posted (moved when the channel changed). */
export const publishRoleMenu = (config: BotConfig, guild: string, locale: string, menu: BotRoleMenu) =>
  call(
    config,
    "POST",
    `/internal/guilds/${idOf(guild)}/role-menus/publish`,
    z.object({ ok: z.boolean(), messageId: snowflake.optional(), channelId: snowflake.optional(), error: z.string().max(300).optional() }),
    { locale, menu },
  );

/** Deletes a deleted menu's message, best effort. */
export const removeRoleMenuMessage = (config: BotConfig, guild: string, channelId: string, messageId: string) =>
  call(config, "POST", `/internal/guilds/${idOf(guild)}/role-menus/remove`, z.object({ ok: z.boolean() }), { channelId, messageId });
