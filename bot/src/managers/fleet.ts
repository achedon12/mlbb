import { ShardClientUtil, type ShardingManager } from "discord.js";
import type { ChannelChoice, ShardStats } from "../discord/shard-api.js";
import type { GuildSummary } from "../site/internal-api.js";

/**
 * The manager's view of all shards, through `broadcastEval`. The functions
 * passed below are serialized and run inside each shard: they may only use
 * their arguments (`client`, `context`), hence `client.mlbbdex`.
 */
export class Fleet {
  constructor(private readonly manager: ShardingManager) {}

  get shardCount(): number {
    return this.manager.shards.size;
  }

  private shardOf(guildId: string): number {
    return ShardClientUtil.shardIdForGuildId(guildId, this.manager.totalShards as number);
  }

  async guilds(): Promise<GuildSummary[]> {
    const perShard = (await this.manager.broadcastEval((client) => client.mlbbdex?.guildSummaries() ?? [])) as GuildSummary[][];
    return perShard.flat();
  }

  async guildIds(): Promise<string[]> {
    return (await this.guilds()).map((g) => g.id);
  }

  async manageable(userId: string): Promise<{ id: string; name: string; icon: string | null }[]> {
    const perShard = (await this.manager.broadcastEval((client, ctx) => client.mlbbdex?.manageableGuilds(ctx.userId) ?? [], {
      context: { userId },
    })) as { id: string; name: string; icon: string | null }[][];
    return perShard.flat();
  }

  async isManageable(guildId: string, userId: string): Promise<boolean> {
    return Boolean(
      await this.manager.broadcastEval((client, ctx) => client.mlbbdex?.isManageable(ctx.guildId, ctx.userId) ?? false, {
        shard: this.shardOf(guildId),
        context: { guildId, userId },
      }),
    );
  }

  async channels(guildId: string): Promise<{ channels: ChannelChoice[]; roles: { id: string; name: string }[] } | null> {
    return (await this.manager.broadcastEval((client, ctx) => client.mlbbdex?.channels(ctx.guildId) ?? null, {
      shard: this.shardOf(guildId),
      context: { guildId },
    })) as { channels: ChannelChoice[]; roles: { id: string; name: string }[] } | null;
  }

  async hasGuild(guildId: string): Promise<boolean> {
    return Boolean(
      await this.manager.broadcastEval((client, ctx) => client.guilds.cache.has(ctx.guildId), {
        shard: this.shardOf(guildId),
        context: { guildId },
      }),
    );
  }

  async stats(): Promise<ShardStats[]> {
    return (await this.manager.broadcastEval((client) => client.mlbbdex?.stats() ?? null)).filter(Boolean) as ShardStats[];
  }
}
