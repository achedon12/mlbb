import { ChannelType, Client, Events, Options, Partials, PermissionFlagsBits, type GuildMember, type PartialGuildMember } from "discord.js";
import { COMMANDS, COMPONENTS, commandMap } from "./commands/index.js";
import { loadConfig, requireDiscord } from "./config.js";
import { DISALLOWED_INTENTS, gatewayIntents, MEMBER_INTENT_WARNING, memberEventsAvailable } from "./discord/intents.js";
import { handleInteraction } from "./discord/interactions.js";
import { createShardApi, guildSummary } from "./discord/shard-api.js";
import type { Services } from "./discord/types.js";
import type { MlbbdleProgress } from "./commands/mlbbdle.js";
import type { QuizProgress } from "./games/quiz.js";
import { DayStore } from "./games/state.js";
import { log } from "./log.js";
import { CommandLogger } from "./managers/command-logger.js";
import { checkGuildRoles } from "./discord/auto-roles.js";
import { AutoRoler, type JoinedMember } from "./managers/auto-roler.js";
import { Greeter, type MemberEvent } from "./managers/greeter.js";
import { restPoster } from "./managers/poster.js";
import { GameData, WARM_INTERVAL_MS } from "./site/game-data.js";
import { serverCount } from "./commands/about.js";
import { presenceAt, PresenceRotator } from "./discord/presence.js";
import { SiteClient } from "./site/internal-api.js";

/**
 * One shard: a gateway connection serving part of the servers, started by
 * the ShardingManager (`index.ts`). It answers interactions and reports
 * joins and leaves, posts the welcome and goodbye messages and gives the
 * auto-roles (member events reach the shard only); the other posting loops
 * run in the manager, over REST.
 */

const config = loadConfig();
const { token, clientId } = requireDiscord(config);
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

// GuildMembers only for the join and leave events of the welcome and
// goodbye messages, and only when the developer portal grants it: without
// it the bot runs as before, those two messages off.
const memberEvents = site ? await memberEventsAvailable(token) : false;

const client = new Client({
  // No message content, no presences; see discord/intents.ts.
  intents: gatewayIntents(memberEvents),
  // A member who leaves is not in the (empty) member cache: the partial
  // carries the user Discord sends with the event, which is all a goodbye needs.
  partials: memberEvents ? [Partials.GuildMember] : [],
  // The bot reads no messages and lists no members: those caches stay empty,
  // except its own member, needed to compute its channel permissions. A
  // member event passes through and is evicted by the next one.
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
  // Sent with the identify: the status shows from the first second.
  presence: { activities: [presenceAt(0, null)], status: "online" },
});
client.mlbbdex = createShardApi(client);

/** Can the bot post embeds in this channel of this server, by its own cache? */
function canPost(guildId: string, channelId: string): boolean {
  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!guild || !channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) return false;
  // Without its own member in the cache (it always is, in practice) the
  // bot cannot tell: Discord's answer to the post decides instead.
  const me = guild.members.me;
  if (!me) return true;
  const needed = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks;
  return channel.permissionsFor(me)?.has(needed) ?? false;
}

const greeter =
  site && memberEvents
    ? new Greeter({
        settings: (guildId) => site.settings(guildId),
        poster: restPoster(client.rest),
        canPost,
        markFailing: (guildId, kind) => site.markGreetingFailing(guildId, kind),
        siteUrl: config.SITE_URL,
      })
    : null;

const autoRoler =
  site && memberEvents
    ? new AutoRoler({
        settings: (guildId) => site.settings(guildId),
        check: (guildId, roleIds) => checkGuildRoles(client.guilds.cache.get(guildId), roleIds),
        markFailing: (guildId) => site.markAutoRoleFailing(guildId),
      })
    : null;

/** What auto-roles read of a member: its ids, bot or not, screening, and the call. */
function joinedMember(member: GuildMember): JoinedMember {
  return {
    guildId: member.guild.id,
    id: member.id,
    bot: member.user.bot,
    pending: member.pending ?? false,
    addRoles: (roleIds, reason) => member.roles.add(roleIds, reason),
  };
}

/** What a greeting reads of a member; nothing of it is stored. */
function memberEvent(member: GuildMember | PartialGuildMember): MemberEvent {
  return {
    guildId: member.guild.id,
    guildName: member.guild.name,
    guildLocale: member.guild.preferredLocale,
    memberCount: member.guild.memberCount,
    member: { id: member.id, username: member.user.username, avatarUrl: member.user.displayAvatarURL({ size: 128 }) },
  };
}

const commands = commandMap();
log.info("commands loaded", { count: COMMANDS.length });

const presence = new PresenceRotator(client, () => serverCount(client));

async function warmGameData(): Promise<void> {
  const failed = await services.data.warm();
  if (failed) log.warn("game data warm-up incomplete", { failed });
}
// Started before the gateway is up: the first commands find the lists loaded.
void warmGameData();
setInterval(() => void warmGameData(), WARM_INTERVAL_MS).unref();

client.once(Events.ClientReady, async (ready) => {
  log.info("shard ready", { user: ready.user.tag, guilds: ready.guilds.cache.size });
  services.logger.start();
  presence.start();
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

// Bots added by the owner are not greeted; they get the bots' auto-roles.
client.on(Events.GuildMemberAdd, (member) => {
  if (greeter && !member.user.bot) void greeter.handle("welcome", memberEvent(member));
  if (autoRoler) void autoRoler.joined(joinedMember(member));
});
// A member passing the membership screening: Discord updates `pending`.
// Out of the member cache (nearly always), the update arrives as
// guildMemberAvailable instead of guildMemberUpdate.
client.on(Events.GuildMemberUpdate, (_old, member) => autoRoler?.screened(joinedMember(member)));
client.on(Events.GuildMemberAvailable, (member) => {
  if (!member.partial) autoRoler?.screened(joinedMember(member));
});
client.on(Events.GuildMemberRemove, (member) => {
  if (greeter && !member.user?.bot) void greeter.handle("goodbye", memberEvent(member));
});

// A new session (after a reconnect) starts without the status: set it again.
client.on(Events.ShardReady, () => void presence.refresh());
client.on(Events.ShardResume, () => void presence.refresh());

client.on(Events.ShardDisconnect, (event) => {
  // Only reachable when the portal check could not run: say why, and let the
  // manager respawn this shard, whose check will then see the intent is off.
  if (event.code !== DISALLOWED_INTENTS) return;
  log.error(MEMBER_INTENT_WARNING);
  process.exit(1);
});

client.on(Events.Error, (error) => log.error("client error", { error }));
client.on(Events.Warn, (message) => log.warn("client warning", { message }));

async function shutdown(signal: string): Promise<void> {
  log.info("shard stopping", { signal });
  greeter?.stop();
  presence.stop();
  autoRoler?.stop();
  await services.logger.stop().catch(() => undefined);
  await client.destroy();
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

// The token comes from the manager through DISCORD_TOKEN; login() reads it.
await client.login(config.DISCORD_TOKEN);
