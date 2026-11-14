import { fileURLToPath } from "node:url";
import { REST, ShardingManager } from "discord.js";
import { TtlCache } from "./cache.js";
import { ConfigError, loadConfig, requireDiscord, type Config } from "./config.js";
import { makeView } from "./embeds/common.js";
import { testMessage } from "./embeds/announcements.js";
import { createInternalServer, type InternalApi } from "./http/server.js";
import { log } from "./log.js";
import { DailyPoster } from "./managers/daily-poster.js";
import { DeliveryService } from "./managers/delivery.js";
import { Fleet } from "./managers/fleet.js";
import { ListingPoster } from "./managers/listing.js";
import { classifyError, errorLabel, restPoster } from "./managers/poster.js";
import { SiteClient } from "./site/internal-api.js";

/**
 * Manager process: spawns the shards (one gateway connection each, see
 * `shard.ts`) and runs everything that does not need the gateway: the
 * internal HTTP server, announcement delivery, daily posts, the full guild
 * sync and the bot-list stats.
 */

/** A full sync also catches servers left while the bot was down; twice a day is enough. */
const FULL_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

function startupConfig(): { config: Config; token: string; clientId: string } {
  try {
    const config = loadConfig();
    const { token, clientId } = requireDiscord(config);
    return { config, token, clientId };
  } catch (error) {
    if (error instanceof ConfigError) {
      log.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const { config, token, clientId } = startupConfig();
if (!config.BOT_API_SECRET) {
  log.warn("BOT_API_SECRET is not set: settings, announcements, daily games and the internal API are off");
}
const site = config.BOT_API_SECRET ? new SiteClient(config.SITE_INTERNAL_URL, config.BOT_API_SECRET) : null;

const manager = new ShardingManager(fileURLToPath(new URL("./shard.js", import.meta.url)), {
  token,
  totalShards: "auto",
  respawn: true,
  mode: "process",
});
manager.on("shardCreate", (shard) => {
  log.info("shard launched", { shard: shard.id });
  shard.on("death", () => log.warn("shard died, respawning", { shard: shard.id }));
});

const fleet = new Fleet(manager);
const rest = new REST({ version: "10" }).setToken(token);
const poster = restPoster(rest);
let ready = false;
const startedAt = Date.now();

/** Channel ids each server lets the bot post in, cached briefly. */
const channelCache = new TtlCache<Set<string>>(5 * 60 * 1000, 5000);
async function ownsChannel(guildId: string, channelId: string): Promise<boolean> {
  const ids = await channelCache.getOrLoad(guildId, async () => new Set((await fleet.channels(guildId))?.channels.map((c) => c.id) ?? []));
  return ids.has(channelId);
}

const delivery = site ? new DeliveryService({ site, poster, siteUrl: config.SITE_URL, ownsChannel }) : null;
const daily = site
  ? new DailyPoster({ site, poster, siteUrl: config.SITE_URL, botId: clientId, ownsChannel })
  : null;
const listing = new ListingPoster(clientId, { topgg: config.TOPGG_TOKEN, dbl: config.DBL_TOKEN, dbotsgg: config.DBOTSGG_TOKEN }, async () => ({
  guilds: (await fleet.guilds()).length,
  shards: fleet.shardCount,
}));

async function fullSync(): Promise<void> {
  if (!site) return;
  try {
    // One call with every shard's servers: a partial list sent as `full`
    // would mark the other shards' servers as left.
    const guilds = await fleet.guilds();
    await site.syncGuilds(true, guilds);
    log.info("full guild sync", { guilds: guilds.length });
  } catch (error) {
    log.warn("full guild sync failed", { error });
  }
}

const api: InternalApi = {
  ready: () => ready,
  manageableGuilds: (userId) => fleet.manageable(userId),
  isManageable: (guildId, userId) => fleet.isManageable(guildId, userId),
  channels: (guildId) => fleet.channels(guildId),
  flush: () => delivery?.flush() ?? Promise.resolve(null),
  async testPost(guildId, channelId, locale) {
    channelCache.delete(guildId);
    if (!(await ownsChannel(guildId, channelId))) return { ok: false, error: "channel_not_available" };
    try {
      await poster.post(channelId, testMessage(makeView(locale, config.SITE_URL, "test-post")));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: classifyError(error) === "forbidden" ? "missing_permissions" : errorLabel(error) };
    }
  },
  async stats() {
    const shards = await fleet.stats();
    return {
      shards,
      guildCount: shards.reduce((n, s) => n + s.guilds, 0),
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };
  },
};

const server = createInternalServer({ secret: config.BOT_API_SECRET, api });
server.on("error", (error) => log.error("internal server error", { error }));
server.listen(config.BOT_HTTP_PORT, config.BOT_HTTP_HOST, () =>
  log.info("internal server listening", { host: config.BOT_HTTP_HOST, port: config.BOT_HTTP_PORT }),
);

let fullSyncTimer: NodeJS.Timeout | null = null;
let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  log.info("stopping", { signal });
  delivery?.stop();
  daily?.stop();
  listing.stop();
  if (fullSyncTimer) clearInterval(fullSyncTimer);
  server.close();
  // Each shard flushes its command logs on SIGTERM before leaving.
  for (const shard of manager.shards.values()) {
    shard.removeAllListeners("death");
    shard.kill();
  }
  setTimeout(() => process.exit(0), 3000).unref();
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

try {
  await manager.spawn({ timeout: 120_000 });
} catch (error) {
  log.error("shards failed to start", { error });
  process.exit(1);
}
ready = true;
log.info("all shards ready", { shards: manager.shards.size });

await fullSync();
fullSyncTimer = setInterval(() => void fullSync(), FULL_SYNC_INTERVAL_MS);
fullSyncTimer.unref();
delivery?.start();
daily?.start();
listing.start();
