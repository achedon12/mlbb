import { ChannelType, PermissionFlagsBits, RESTJSONErrorCodes, type Client, type Guild } from "discord.js";
import { fromDiscordLocale } from "../i18n/index.js";
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

export interface ShardStats {
  id: number;
  status: number;
  ping: number;
  guilds: number;
}

export interface ShardApi {
  guildSummaries(): GuildSummary[];
  manageableGuilds(userId: string): Promise<{ id: string; name: string; icon: string | null }[]>;
  isManageable(guildId: string, userId: string): Promise<boolean>;
  channels(guildId: string): Promise<{ channels: ChannelChoice[]; roles: { id: string; name: string }[] } | null>;
  stats(): ShardStats;
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

export function createShardApi(client: Client): ShardApi {
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
      // Managed roles (bots, boosts) cannot be pinged usefully; @everyone is never offered.
      const roles = guild.roles.cache
        .filter((r) => r.id !== guild.id && !r.managed)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name }))
        .slice(0, 250);
      return { channels: channels.slice(0, 500), roles };
    },

    stats: () => ({
      id: client.shard?.ids[0] ?? 0,
      status: client.ws.status,
      ping: client.ws.ping,
      guilds: client.guilds.cache.size,
    }),
  };
}
