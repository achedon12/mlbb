import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  type CategoryChannel,
  type Client,
  type Guild,
  type GuildMember,
  type OverwriteData,
  type VoiceBasedChannel,
} from "discord.js";
import { CATEGORY_MAX_CHANNELS, TEMP_VOICE_REASON, type CreateResult, type MoveResult, type RemoveResult, type TempVoiceDiscord } from "../managers/temp-voice.js";
import { errorLabel } from "../managers/poster.js";

/**
 * The Discord side of temporary voice channels (`managers/temp-voice.ts`):
 * reading the shard's voice state cache, creating, moving, deleting.
 *
 * Permissions. The bot needs, in the server (or the hub's category):
 * Manage Channels to create and delete the channels, Move Members to move
 * the member in, and View Channel and Connect on the hub. A channel
 * created with permission overwrites may only allow or deny what the bot
 * holds itself in the server, so:
 * - the overwrites of the category (or of the hub, outside one, or when
 *   the category is full) are copied, each bit the bot lacks dropped;
 * - the member gets Manage Channels (rename, user limit), Move Members and
 *   Mute / Deafen Members in their channel, each only if the bot has it;
 * - the bot gives itself View Channel, Connect, Manage Channels and Move
 *   Members there, so a category denying them cannot lock it out of the
 *   channel it has to delete.
 */

/** Without these the bot creates nothing. */
export const TEMP_VOICE_REQUIRED =
  PermissionFlagsBits.ViewChannel | PermissionFlagsBits.Connect | PermissionFlagsBits.ManageChannels | PermissionFlagsBits.MoveMembers;

/** What the member gets in their own channel, as far as the bot can give it. */
export const OWNER_PERMISSIONS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.Connect |
  PermissionFlagsBits.Speak |
  PermissionFlagsBits.ManageChannels |
  PermissionFlagsBits.MoveMembers |
  PermissionFlagsBits.MuteMembers |
  PermissionFlagsBits.DeafenMembers;

const ALL = (1n << 64n) - 1n;

/** The bits the bot may put in an overwrite: everything for an administrator. */
export const grantable = (botPermissions: bigint): bigint =>
  (botPermissions & PermissionFlagsBits.Administrator) !== 0n ? ALL : botPermissions;

/** Does the bot hold everything temporary channels need? */
export const hasTempVoicePermissions = (permissions: bigint): boolean =>
  (permissions & PermissionFlagsBits.Administrator) !== 0n || (permissions & TEMP_VOICE_REQUIRED) === TEMP_VOICE_REQUIRED;

/** A plain overwrite, ids and bits only. */
export interface PlainOverwrite {
  id: string;
  type: OverwriteType;
  allow: bigint;
  deny: bigint;
}

/**
 * The overwrites of the new channel: those copied (bits the bot lacks
 * dropped, the member's and the bot's own replaced), then the member's
 * and the bot's.
 */
export function tempVoiceOverwrites(base: readonly PlainOverwrite[], botPermissions: bigint, ownerId: string, botId: string): PlainOverwrite[] {
  const mask = grantable(botPermissions);
  const copied = base
    .filter((o) => o.id !== ownerId && o.id !== botId)
    .map((o) => ({ ...o, allow: o.allow & mask, deny: o.deny & mask }))
    .filter((o) => o.allow !== 0n || o.deny !== 0n);
  return [
    ...copied,
    { id: ownerId, type: OverwriteType.Member, allow: OWNER_PERMISSIONS & mask, deny: 0n },
    { id: botId, type: OverwriteType.Member, allow: TEMP_VOICE_REQUIRED & mask, deny: 0n },
  ];
}

/**
 * Where the channel goes: the hub's category while it has room (Discord
 * caps a category at 50 channels), otherwise outside any category.
 */
export const parentFor = (parentId: string | null, childCount: number): string | null =>
  parentId && childCount < CATEGORY_MAX_CHANNELS ? parentId : null;

const codeOf = (error: unknown) => (error as { code?: unknown }).code;
const forbidden = (error: unknown) => {
  const code = codeOf(error);
  return code === RESTJSONErrorCodes.MissingPermissions || code === RESTJSONErrorCodes.MissingAccess || (error as { status?: unknown }).status === 403;
};

const plain = (channel: CategoryChannel | VoiceBasedChannel): PlainOverwrite[] =>
  channel.permissionOverwrites.cache.map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }));

async function me(guild: Guild): Promise<GuildMember | null> {
  return guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
}

/** `TempVoiceDiscord` over a shard's client. */
export function discordTempVoice(client: Client): TempVoiceDiscord {
  const guildOf = (guildId: string) => {
    const guild = client.guilds.cache.get(guildId);
    return guild?.available ? guild : null;
  };

  return {
    hasGuild: (guildId) => guildOf(guildId) !== null,

    occupants(guildId, channelId) {
      const guild = guildOf(guildId);
      const channel = guild?.channels.cache.get(channelId);
      if (!guild || !channel?.isVoiceBased()) return null;
      // The voice state cache, not `channel.members`: that one also needs
      // the members cached, and the member cache is kept nearly empty.
      return guild.voiceStates.cache.filter((s) => s.channelId === channelId).size;
    },

    connectedTo: (guildId, userId) => guildOf(guildId)?.voiceStates.cache.get(userId)?.channelId ?? null,

    async create(guildId, hub, owner, name, userLimit): Promise<CreateResult> {
      const guild = guildOf(guildId);
      if (!guild) return { ok: false, reason: "unknown_guild" };
      const hubChannel = guild.channels.cache.get(hub.channelId);
      if (!hubChannel?.isVoiceBased()) return { ok: false, reason: "unknown_hub" };
      const bot = await me(guild);
      if (!bot) return { ok: false, reason: "unknown_guild" };
      const category = hubChannel.parent;
      const parentId = parentFor(category?.id ?? null, category?.children.cache.size ?? 0);
      const where = parentId && category ? category : hubChannel;
      if (!hasTempVoicePermissions(where.permissionsFor(bot)?.bitfield ?? 0n) || !hasTempVoicePermissions(hubChannel.permissionsFor(bot)?.bitfield ?? 0n)) {
        return { ok: false, reason: "missing_permissions" };
      }
      const overwrites: OverwriteData[] = tempVoiceOverwrites(plain(where), bot.permissions.bitfield, owner.id, bot.id);
      try {
        const channel = await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          parent: parentId,
          userLimit,
          // Right below the hub, inside the category.
          ...(parentId ? { position: hubChannel.rawPosition + 1 } : {}),
          permissionOverwrites: overwrites,
          reason: TEMP_VOICE_REASON,
        });
        return { ok: true, channelId: channel.id };
      } catch (error) {
        if (forbidden(error)) return { ok: false, reason: "missing_permissions" };
        // The server's 500 channels reached: logged like any other failure.
        if (codeOf(error) === RESTJSONErrorCodes.MaximumNumberOfGuildChannelsReached) return { ok: false, reason: "failed", error: "too many channels" };
        return { ok: false, reason: "failed", error: errorLabel(error) };
      }
    },

    async move(guildId, userId, channelId): Promise<MoveResult> {
      const guild = guildOf(guildId);
      if (!guild) return "gone";
      try {
        await guild.members.edit(userId, { channel: channelId, reason: TEMP_VOICE_REASON });
        return "moved";
      } catch (error) {
        const code = codeOf(error);
        // Left the server, or no longer in a voice channel: nobody to move.
        if (code === RESTJSONErrorCodes.UnknownMember || code === RESTJSONErrorCodes.TargetUserIsNotConnectedToVoice) return "gone";
        if (code === RESTJSONErrorCodes.UnknownChannel) return "gone";
        return forbidden(error) ? "forbidden" : "failed";
      }
    },

    async remove(guildId, channelId): Promise<RemoveResult> {
      const guild = guildOf(guildId);
      if (!guild) return "failed";
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return "gone";
      // Only a voice channel: an id the registry holds can never delete
      // anything else. Anything else is forgotten, untouched.
      if (channel.type !== ChannelType.GuildVoice) return "gone";
      try {
        await channel.delete(TEMP_VOICE_REASON);
        return "deleted";
      } catch (error) {
        if (codeOf(error) === RESTJSONErrorCodes.UnknownChannel) return "gone";
        return forbidden(error) ? "forbidden" : "failed";
      }
    },
  };
}
