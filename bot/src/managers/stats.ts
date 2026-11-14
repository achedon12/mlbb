import type { ShardStats } from "../discord/shard-api.js";

/**
 * The answer of `GET /internal/stats`, read by the site's admin panel
 * (`src/lib/bot/client.ts`, which validates it). `status` is discord.js's
 * gateway `Status` number (0 = Ready); a shard that did not answer (dead,
 * respawning) is listed as `"unavailable"` instead of failing the whole
 * answer, which made the panel say the bot was down.
 */
export interface StatsAnswer {
  shards: (ShardStats | { id: number; status: "unavailable"; ping: -1; guilds: 0 })[];
  guildCount: number;
  uptimeSec: number;
  /** Manager and shards together: each shard is its own process. */
  memoryMb: number;
  version: string;
  node: string;
  totalShards: number;
}

export function statsAnswer(input: {
  shardIds: number[];
  answers: PromiseSettledResult<ShardStats | null>[];
  startedAt: number;
  now: number;
  managerRssBytes: number;
  version: string;
  node: string;
}): StatsAnswer {
  const shards = input.shardIds.map((id, i) => {
    const answer = input.answers[i];
    return answer?.status === "fulfilled" && answer.value
      ? answer.value
      : { id, status: "unavailable" as const, ping: -1 as const, guilds: 0 as const };
  });
  const managerMb = input.managerRssBytes / 1024 / 1024;
  const shardsMb = shards.reduce((n, s) => n + ("memoryMb" in s ? s.memoryMb : 0), 0);
  return {
    shards,
    guildCount: shards.reduce((n, s) => n + s.guilds, 0),
    uptimeSec: Math.max(0, Math.round((input.now - input.startedAt) / 1000)),
    memoryMb: Math.round(managerMb + shardsMb),
    version: input.version.slice(0, 32),
    node: input.node.slice(0, 32),
    totalShards: input.shardIds.length,
  };
}
