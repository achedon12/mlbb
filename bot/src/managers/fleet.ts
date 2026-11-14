import { ShardClientUtil, type ShardingManager } from "discord.js";
import type { Grantable, GuildLists, ShardStats } from "../discord/shard-api.js";
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

  async channels(guildId: string): Promise<GuildLists | null> {
    return (await this.manager.broadcastEval((client, ctx) => client.mlbbdex?.channels(ctx.guildId) ?? null, {
      shard: this.shardOf(guildId),
      context: { guildId },
    })) as GuildLists | null;
  }

  async grantable(guildId: string, userId: string): Promise<Grantable | null> {
    return (await this.manager.broadcastEval((client, ctx) => client.mlbbdex?.grantable(ctx.guildId, ctx.userId) ?? null, {
      shard: this.shardOf(guildId),
      context: { guildId, userId },
    })) as Grantable | null;
  }

  async hasGuild(guildId: string): Promise<boolean> {
    return Boolean(
      await this.manager.broadcastEval((client, ctx) => client.guilds.cache.has(ctx.guildId), {
        shard: this.shardOf(guildId),
        context: { guildId },
      }),
    );
  }

  /**
   * Shard by shard, not one `broadcastEval`: that rejects as a whole when a
   * single shard is dead or respawning, and the admin panel then saw no bot
   * at all. Each answer is settled on its own, bounded in time.
   */
  async stats(timeoutMs = 3_000): Promise<{ shardIds: number[]; answers: PromiseSettledResult<ShardStats | null>[] }> {
    const shards = [...this.manager.shards.values()];
    const answers = await Promise.allSettled(
      shards.map((shard) =>
        Promise.race([
          shard.eval((client) => client.mlbbdex?.stats() ?? null) as Promise<ShardStats | null>,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("shard stats timed out")), timeoutMs).unref()),
        ]),
      ),
    );
    return { shardIds: shards.map((s) => s.id), answers };
  }
}
