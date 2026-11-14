import { ChannelType, PermissionFlagsBits, RESTJSONErrorCodes, type Client, type Guild } from "discord.js";
import { fromDiscordLocale } from "../i18n/index.js";
import {
  granterFacts,
  granterRefusal,
  NOT_A_MEMBER,
  roleFacts,
  roleRefusal,
  type GranterFacts,
  type GranterRefusal,
  type RoleRefusal,
} from "./auto-roles.js";
import type { GuildSummary } from "../site/internal-api.js";

/**
 * What the manager process asks each shard through `broadcastEval`. The
 * functions run inside the shard, against its cache; only plain JSON comes
 * back. Attached to the client as `client.mlbbdex`, because a broadcast
 * function is serialized and cannot import anything.
 */

export interface ChannelChoice {
  id: string;
  name: string;
  type: "text" | "announcement";
}

/** A role for the dashboard: `assignable` as an auto-role, or why not. */
export interface RoleChoice {
  id: string;
  name: string;
  assignable: boolean;
  refusal: RoleRefusal | null;
}

/** The pickers' lists, and whether the bot holds Manage Roles (auto-roles need it). */
export interface GuildLists {
  channels: ChannelChoice[];
  roles: RoleChoice[];
  manageRoles: boolean;
}

export interface ShardStats {
  id: number;
  /** discord.js's gateway `Status` (0 = Ready); the site names it. */
  status: number;
  /** -1 until the first heartbeat. */
  ping: number;
  guilds: number;
  /** This shard's process (resident set). */
  memoryMb: number;
  /** Since the shard's client became ready. */
  uptimeSec: number;
}

export interface ShardApi {
  guildSummaries(): GuildSummary[];
  manageableGuilds(userId: string): Promise<{ id: string; name: string; icon: string | null }[]>;
  isManageable(guildId: string, userId: string): Promise<boolean>;
  channels(guildId: string): Promise<GuildLists | null>;
  /** Which roles this person may hand out through the bot; null: server not here. */
  grantable(guildId: string, userId: string): Promise<Grantable | null>;
  /** The dashboard saved this server: drop what the shard cached of it. */
  forget(guildId: string): void;
  stats(): ShardStats;
}

/** What the shard drops when the dashboard saves a server (its site caches). */
export interface ShardHooks {
  forget?: (guildId: string) => void;
}

/** Per role (every one but @everyone), may this person give it? */
export interface Grantable {
  member: boolean;
  roles: { id: string; refusal: GranterRefusal | null }[];
}

declare module "discord.js" {
  interface Client {
    mlbbdex?: ShardApi;
  }
}

/** Members asked to Discord at once when listing a user's servers: bounded to stay clear of rate limits. */
const MEMBER_LOOKUP_CONCURRENCY = 8;

export function guildSummary(guild: Guild): GuildSummary {
  return {
    id: guild.id,
    name: guild.name.slice(0, 100),
    icon: guild.icon,
    memberCount: guild.memberCount ?? 0,
    locale: fromDiscordLocale(guild.preferredLocale) ?? "en",
  };
}

/**
 * Can this user configure the bot in this server? Owner, or a member whose
 * roles grant Manage Server (Administrator included). The member is fetched
 * by id, which needs no privileged intent, and is not kept in the cache.
 */
async function canManage(guild: Guild, userId: string): Promise<boolean> {
  if (guild.ownerId === userId) return true;
  try {
    const member = await guild.members.fetch({ user: userId, cache: false, force: true });
    return member.permissions.has(PermissionFlagsBits.ManageGuild);
  } catch (error) {
    if ((error as { code?: number }).code === RESTJSONErrorCodes.UnknownMember) return false;
    throw error;
  }
}

/**
 * The facts deciding which roles this person may give (see
 * `granterRefusal`), from the member fetched live by id, not cached.
 */
export async function fetchGranter(guild: Guild, userId: string): Promise<GranterFacts> {
  try {
    const member = await guild.members.fetch({ user: userId, cache: false, force: true });
    return granterFacts(guild, member);
  } catch (error) {
    if ((error as { code?: number }).code === RESTJSONErrorCodes.UnknownMember) return NOT_A_MEMBER;
    throw error;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

export function createShardApi(client: Client, hooks: ShardHooks = {}): ShardApi {
  return {
    guildSummaries: () => client.guilds.cache.filter((g) => g.available).map(guildSummary),

    async manageableGuilds(userId) {
      const guilds = [...client.guilds.cache.values()].filter((g) => g.available);
      const allowed = await mapLimit(guilds, MEMBER_LOOKUP_CONCURRENCY, (g) => canManage(g, userId).catch(() => false));
      return guilds.filter((_, i) => allowed[i]).map((g) => ({ id: g.id, name: g.name, icon: g.icon }));
    },

    async isManageable(guildId, userId) {
      const guild = client.guilds.cache.get(guildId);
      return guild?.available ? canManage(guild, userId) : false;
    },

    async channels(guildId) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild?.available) return null;
      const me = guild.members.me ?? (await guild.members.fetchMe());
      const needed = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks;
      const channels = guild.channels.cache
        .filter((c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
        .filter((c) => c.permissionsFor(me)?.has(needed) ?? false)
        .sort((a, b) => ("position" in a && "position" in b ? a.position - b.position : 0))
        .map((c) => ({ id: c.id, name: c.name, type: c.type === ChannelType.GuildAnnouncement ? ("announcement" as const) : ("text" as const) }));
      // @everyone is never offered. Managed roles (bots, boosts) are listed
      // for the auto-role picker, refused there; the site never offers them
      // as a mention. `assignable` follows the very rules applied before
      // every assignment (discord/auto-roles.ts).
      const roles = guild.roles.cache
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => {
          const refusal = roleRefusal(roleFacts(r, me));
          return { id: r.id, name: r.name, assignable: refusal === null, refusal };
        })
        .slice(0, 250);
      return { channels: channels.slice(0, 500), roles, manageRoles: me.permissions.has(PermissionFlagsBits.ManageRoles) };
    },

    async grantable(guildId, userId) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild?.available) return null;
      const granter = await fetchGranter(guild, userId);
      const roles = guild.roles.cache
        .filter((r) => r.id !== guild.id)
        .map((r) => ({ id: r.id, refusal: granterRefusal(granter, r.id) }))
        .slice(0, 250);
      return { member: granter.member, roles };
    },

    forget: (guildId) => hooks.forget?.(guildId),

    stats: () => ({
      id: client.shard?.ids[0] ?? 0,
      status: client.ws.status,
      ping: client.ws.ping,
      guilds: client.guilds.cache.size,
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      uptimeSec: Math.round((client.uptime ?? 0) / 1000),
    }),
  };
}
