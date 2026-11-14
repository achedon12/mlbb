import { Client, Events, GatewayIntentBits, Options } from "discord.js";
import { COMMANDS, COMPONENTS, commandMap } from "./commands/index.js";
import { loadConfig, requireDiscord } from "./config.js";
import { handleInteraction } from "./discord/interactions.js";
import { createShardApi, guildSummary } from "./discord/shard-api.js";
import type { Services } from "./discord/types.js";
import type { MlbbdleProgress } from "./commands/mlbbdle.js";
import type { QuizProgress } from "./games/quiz.js";
import { DayStore } from "./games/state.js";
import { log } from "./log.js";
import { CommandLogger } from "./managers/command-logger.js";
import { GameData } from "./site/game-data.js";
import { SiteClient } from "./site/internal-api.js";

/**
 * One shard: a gateway connection serving part of the servers, started by
 * the ShardingManager (`index.ts`). It answers interactions and reports
 * joins and leaves; the posting loops run in the manager, over REST.
 */

const config = loadConfig();
const { clientId } = requireDiscord(config);
const site = config.BOT_API_SECRET ? new SiteClient(config.SITE_INTERNAL_URL, config.BOT_API_SECRET) : null;

const services: Services = {
  config,
  clientId,
  data: new GameData(config.SITE_URL),
  site,
  logger: new CommandLogger(site),
  mlbbdle: new DayStore<MlbbdleProgress>(),
  quiz: new DayStore<QuizProgress>(),
};

const client = new Client({
  // Guilds only: no privileged intent, no message content, no member list.
  intents: [GatewayIntentBits.Guilds],
  // The bot reads no messages and lists no members: those caches stay empty,
  // except its own member, needed to compute its channel permissions.
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 0,
    GuildMemberManager: { maxSize: 1, keepOverLimit: (member) => member.id === member.client.user.id },
    UserManager: { maxSize: 0, keepOverLimit: (user) => user.id === user.client.user.id },
    PresenceManager: 0,
    ReactionManager: 0,
    ReactionUserManager: 0,
    ThreadMemberManager: 0,
    VoiceStateManager: 0,
    GuildEmojiManager: 0,
    GuildStickerManager: 0,
    GuildInviteManager: 0,
    GuildScheduledEventManager: 0,
    StageInstanceManager: 0,
  }),
  allowedMentions: { parse: [] },
});
client.mlbbdex = createShardApi(client);

const commands = commandMap();
log.info("commands loaded", { count: COMMANDS.length });

client.once(Events.ClientReady, async (ready) => {
  log.info("shard ready", { user: ready.user.tag, guilds: ready.guilds.cache.size });
  services.logger.start();
  // A partial sync refreshes names and member counts; the full one, which
  // also detects servers left while offline, is the manager's job.
  if (site) {
    await site.syncGuilds(false, ready.guilds.cache.filter((g) => g.available).map(guildSummary)).catch((error: unknown) =>
      log.warn("partial guild sync failed", { error }),
    );
  }
});

client.on(Events.InteractionCreate, (interaction) => {
  void handleInteraction(interaction, commands, COMPONENTS, services).catch((error: unknown) =>
    log.error("interaction handler crashed", { error }),
  );
});

client.on(Events.GuildCreate, (guild) => {
  log.info("joined a server", { guild: guild.id, members: guild.memberCount });
  site?.joinGuild(guildSummary(guild)).catch((error: unknown) => log.warn("join not recorded", { error }));
});

client.on(Events.GuildDelete, (guild) => {
  // An outage also removes a guild from the cache: only a real removal counts.
  if (!guild.available) return;
  log.info("left a server", { guild: guild.id });
  site?.leaveGuild(guild.id).catch((error: unknown) => log.warn("leave not recorded", { error }));
});

client.on(Events.Error, (error) => log.error("client error", { error }));
client.on(Events.Warn, (message) => log.warn("client warning", { message }));

async function shutdown(signal: string): Promise<void> {
  log.info("shard stopping", { signal });
  await services.logger.stop().catch(() => undefined);
  await client.destroy();
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

// The token comes from the manager through DISCORD_TOKEN; login() reads it.
await client.login(config.DISCORD_TOKEN);
