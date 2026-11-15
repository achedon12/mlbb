import { log } from "../log.js";
import type { GuildSettings, TempVoiceChannel, TempVoiceHub } from "../site/schemas.js";
import { TEMP_VOICE_MAX_USER_LIMIT } from "../site/schemas.js";

/**
 * Temporary voice channels ("join to create"). A member who joins one of a
 * server's hubs gets a voice channel of their own, created next to the hub
 * (same category), which they may rename, cap and moderate; the bot moves
 * them into it and deletes it once the last member leaves. The hub stays.
 *
 * Only the shard holding a server receives its voice events, so each
 * server is handled by one process; the channels created are kept by the
 * site (`TempVoiceChannel`), so that after a restart each shard deletes
 * the ones of its servers left empty, forgets the ones gone, and goes on
 * watching the others. A channel the bot did not create is never deleted:
 * only those it created, or the site lists as created by it, are touched.
 *
 * Abuse and races:
 * - a member already owning a channel of that server is sent back to it,
 *   not given a second one;
 * - a member hopping in and out of a hub gets at most one channel per
 *   `CREATE_COOLDOWN_MS`; one creation per member at a time;
 * - at most `MAX_TEMP_CHANNELS_PER_GUILD` channels per server;
 * - a member who left before being moved leaves an empty channel behind,
 *   deleted at once.
 *
 * Discord calls go through `TempVoiceDiscord` (`discord/temp-voice.ts`),
 * so this logic is tested without Discord.
 */

/** Between two channels created for the same member. */
export const CREATE_COOLDOWN_MS = 10_000;
/** Temporary channels per server at once; past it, a hub creates nothing. */
export const MAX_TEMP_CHANNELS_PER_GUILD = 50;
/** Discord's caps: a channel name, the channels of one category. */
export const CHANNEL_NAME_MAX = 100;
export const CATEGORY_MAX_CHANNELS = 50;
/** "Missing permissions" is logged once per server in this window, not at every join. */
export const PERMISSION_LOG_INTERVAL_MS = 10 * 60 * 1000;
/** Members remembered for the cooldown, per shard. */
const COOLDOWN_MAX = 10_000;
/** Reason given in the server's audit log. */
export const TEMP_VOICE_REASON = "MLBBDex temporary voice channel";

// ─── Pure rules ────────────────────────────────────────────────────────

/** A display name as part of a channel name: no control characters, no line breaks, trimmed. */
export function cleanName(name: string): string {
  // eslint-disable-next-line no-control-regex -- stripping them is the point
  return name.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The new channel's name: the hub's template (or the server language's
 * default), `{user}` replaced by the member's display name, clipped to
 * Discord's 100 characters. A name that comes out blank falls back to the
 * default one, then to the bare display name.
 */
export function channelName(template: string | null, displayName: string, fallback: string): string {
  const user = cleanName(displayName) || "?";
  const render = (t: string) => cleanName(t.replaceAll("{user}", user));
  const name = (template && render(template)) || render(fallback) || user;
  return [...name].slice(0, CHANNEL_NAME_MAX).join("").trim();
}

/** The hub's user limit as Discord takes it: 0 (none) to 99. */
export function userLimitOf(limit: number | null | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return 0;
  return Math.min(TEMP_VOICE_MAX_USER_LIMIT, Math.max(0, Math.trunc(limit)));
}

/** The hub a member just joined, if that channel is one. */
export function hubFor(settings: Pick<GuildSettings, "tempVoice">, channelId: string | null): TempVoiceHub | null {
  if (!channelId) return null;
  return settings.tempVoice.hubs.find((h) => h.channelId === channelId) ?? null;
}

/** Where a registered channel stands, by the shard's cache. */
export type ChannelFact =
  /** The server is on another shard (or unavailable): not this shard's to judge. */
  | "elsewhere"
  /** The channel no longer exists. */
  | "missing"
  | "empty"
  | "occupied"
  /** Now one of the server's hubs: never deleted, forgotten. */
  | "hub";

export interface SweepPlan {
  /** Empty: deleted, then forgotten. */
  remove: TempVoiceChannel[];
  /** Gone (or turned into a hub): forgotten without a call to Discord. */
  forget: TempVoiceChannel[];
  /** Occupied: watched, deleted when the last member leaves. */
  keep: TempVoiceChannel[];
}

/** After a restart: what to do with each registered channel. */
export function sweepPlan(registered: readonly TempVoiceChannel[], fact: (channel: TempVoiceChannel) => ChannelFact): SweepPlan {
  const plan: SweepPlan = { remove: [], forget: [], keep: [] };
  for (const channel of registered) {
    const state = fact(channel);
    if (state === "elsewhere") continue;
    if (state === "missing" || state === "hub") plan.forget.push(channel);
    else if (state === "empty") plan.remove.push(channel);
    else plan.keep.push(channel);
  }
  return plan;
}

// ─── The manager ───────────────────────────────────────────────────────

/** A voice state change, as the shard reports it. */
export interface VoiceMove {
  guildId: string;
  userId: string;
  bot: boolean;
  displayName: string;
  /** Channel left, or null. */
  from: string | null;
  /** Channel joined, or null. */
  to: string | null;
}

export type CreateResult =
  | { ok: true; channelId: string }
  | { ok: false; reason: "missing_permissions" | "unknown_hub" | "unknown_guild" | "failed"; error?: string };
export type MoveResult = "moved" | "gone" | "forbidden" | "failed";
export type RemoveResult = "deleted" | "gone" | "forbidden" | "failed";

/** What the manager asks Discord, through the shard. */
export interface TempVoiceDiscord {
  /** Members in this voice channel, null when it no longer exists (or the server is not on this shard). */
  occupants(guildId: string, channelId: string): number | null;
  /** The voice channel this member is in, by the voice state cache. */
  connectedTo(guildId: string, userId: string): string | null;
  /** Is this server on this shard, and available? */
  hasGuild(guildId: string): boolean;
  create(guildId: string, hub: TempVoiceHub, owner: { id: string }, name: string, userLimit: number): Promise<CreateResult>;
  move(guildId: string, userId: string, channelId: string): Promise<MoveResult>;
  remove(guildId: string, channelId: string): Promise<RemoveResult>;
}

/** Where the created channels are kept (the site). */
export interface TempVoiceRegistry {
  register(channel: TempVoiceChannel): Promise<unknown>;
  forget(channelIds: string[]): Promise<unknown>;
  list(): Promise<TempVoiceChannel[]>;
}

export interface TempVoiceDeps {
  settings: (guildId: string) => Promise<GuildSettings>;
  /** The default channel name in the server's language, `{user}` left in. */
  defaultName: (guildId: string, settings: GuildSettings) => string;
  discord: TempVoiceDiscord;
  registry: TempVoiceRegistry | null;
  now?: () => number;
}

type Owned = { guildId: string; hubChannelId: string; ownerId: string };

export class TempVoiceManager {
  /** Every temporary channel this shard watches: created here, or registered before a restart. */
  private readonly channels = new Map<string, Owned>();
  /** `guild:member` creations in progress. */
  private readonly creating = new Set<string>();
  /** `guild:member` → last creation, for the cooldown. */
  private readonly lastCreated = new Map<string, number>();
  private readonly deleting = new Set<string>();
  /** guild → last "missing permissions" log. */
  private readonly permissionLogged = new Map<string, number>();
  private readonly pending = new Set<Promise<unknown>>();
  private readonly now: () => number;

  constructor(private readonly deps: TempVoiceDeps) {
    this.now = deps.now ?? Date.now;
  }

  /** Channels watched, for the tests. */
  get watched(): ReadonlyMap<string, Owned> {
    return this.channels;
  }

  /** `voiceStateUpdate`. Never throws: a voice event must not crash the shard. */
  handle(move: VoiceMove): Promise<void> {
    const work = this.run(move).catch((error: unknown) => log.warn("temp voice failed", { guild: move.guildId, error }));
    this.pending.add(work);
    void work.finally(() => this.pending.delete(work));
    return work;
  }

  /** Resolves once every event received so far is handled (tests, shutdown). */
  async drained(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  private async run(move: VoiceMove): Promise<void> {
    if (move.from === move.to) return;
    if (move.from && this.channels.has(move.from)) {
      // Picked as a hub since it was created: it stays, and is no longer ours.
      const settings = await this.deps.settings(move.guildId).catch(() => null);
      if (settings && hubFor(settings, move.from)) this.channelDeleted(move.from);
      else await this.removeIfEmpty(move.from);
    }
    if (!move.to || move.bot) return;
    // Settings are only read for a join (cached by the site client): a
    // server without hubs costs nothing more.
    const settings = await this.deps.settings(move.guildId);
    const hub = hubFor(settings, move.to);
    if (hub) await this.spawn(move, hub, settings);
  }

  /** A channel was deleted (by anyone): forgotten if it was one of ours. */
  channelDeleted(channelId: string): void {
    if (!this.channels.delete(channelId)) return;
    this.forget([channelId]);
  }

  /**
   * After the shard is ready: the site's registered channels of this
   * shard's servers, deleted when empty, forgotten when gone, watched
   * otherwise. Returns what was done, for the log and the tests.
   */
  async sweep(): Promise<SweepPlan | null> {
    const registry = this.deps.registry;
    if (!registry) return null;
    let registered: TempVoiceChannel[];
    try {
      registered = await registry.list();
    } catch (error) {
      log.warn("temp voice channels not read", { error });
      return null;
    }
    // Each server's hubs; null when its settings could not be read (the
    // site unreachable): its channels are left alone, nothing is deleted on a guess.
    const hubs = new Map<string, ReadonlySet<string> | null>();
    for (const guildId of new Set(registered.filter((c) => this.deps.discord.hasGuild(c.guildId)).map((c) => c.guildId))) {
      const settings = await this.deps.settings(guildId).catch(() => null);
      hubs.set(guildId, settings ? new Set(settings.tempVoice.hubs.map((h) => h.channelId)) : null);
    }
    const plan = sweepPlan(registered, (c) => {
      const guildHubs = hubs.get(c.guildId);
      if (!this.deps.discord.hasGuild(c.guildId) || !guildHubs) return "elsewhere";
      if (guildHubs.has(c.channelId)) return "hub";
      const count = this.deps.discord.occupants(c.guildId, c.channelId);
      return count === null ? "missing" : count === 0 ? "empty" : "occupied";
    });
    for (const c of [...plan.keep, ...plan.remove]) this.channels.set(c.channelId, { guildId: c.guildId, hubChannelId: c.hubChannelId, ownerId: c.ownerId });
    if (plan.forget.length) this.forget(plan.forget.map((c) => c.channelId));
    for (const c of plan.remove) await this.removeIfEmpty(c.channelId);
    if (plan.remove.length || plan.forget.length || plan.keep.length) {
      log.info("temp voice sweep", { removed: plan.remove.length, forgotten: plan.forget.length, kept: plan.keep.length });
    }
    return plan;
  }

  stop(): void {
    this.lastCreated.clear();
    this.permissionLogged.clear();
  }

  private async spawn(move: VoiceMove, hub: TempVoiceHub, settings: GuildSettings): Promise<void> {
    const key = `${move.guildId}:${move.userId}`;
    if (this.creating.has(key)) return;
    const { discord } = this.deps;

    // Already owns one: sent back to it.
    for (const [channelId, owned] of this.channels) {
      // Being deleted (they just left it): not one to send them back to.
      if (owned.guildId !== move.guildId || owned.ownerId !== move.userId || this.deleting.has(channelId)) continue;
      if (discord.occupants(move.guildId, channelId) === null) {
        this.channelDeleted(channelId);
        continue;
      }
      await discord.move(move.guildId, move.userId, channelId);
      return;
    }

    const last = this.lastCreated.get(key);
    if (last !== undefined && this.now() - last < CREATE_COOLDOWN_MS) return;
    const inGuild = [...this.channels.values()].filter((c) => c.guildId === move.guildId).length;
    if (inGuild >= MAX_TEMP_CHANNELS_PER_GUILD) {
      log.warn("temp voice: too many channels in this server", { guild: move.guildId });
      return;
    }

    this.creating.add(key);
    try {
      this.remember(key);
      const name = channelName(hub.nameTemplate, move.displayName, this.deps.defaultName(move.guildId, settings));
      const created = await discord.create(move.guildId, hub, { id: move.userId }, name, userLimitOf(hub.userLimit));
      if (!created.ok) {
        this.refused(move.guildId, created.reason, created.error);
        return;
      }
      const channelId = created.channelId;
      this.channels.set(channelId, { guildId: move.guildId, hubChannelId: hub.channelId, ownerId: move.userId });
      void this.deps.registry
        ?.register({ guildId: move.guildId, channelId, hubChannelId: hub.channelId, ownerId: move.userId })
        .catch((error: unknown) => log.warn("temp voice channel not registered", { guild: move.guildId, error }));

      // Left the hub while the channel was being created (or went to
      // another channel): nobody to move, the empty channel goes.
      if (discord.connectedTo(move.guildId, move.userId) !== hub.channelId) {
        await this.removeIfEmpty(channelId);
        return;
      }
      const moved = await discord.move(move.guildId, move.userId, channelId);
      if (moved === "forbidden") this.refused(move.guildId, "missing_permissions");
      if (moved !== "moved") await this.removeIfEmpty(channelId);
    } finally {
      this.creating.delete(key);
    }
  }

  private async removeIfEmpty(channelId: string): Promise<void> {
    const owned = this.channels.get(channelId);
    if (!owned || this.deleting.has(channelId)) return;
    const count = this.deps.discord.occupants(owned.guildId, channelId);
    if (count === null) {
      this.channelDeleted(channelId);
      return;
    }
    if (count > 0) return;
    this.deleting.add(channelId);
    try {
      const result = await this.deps.discord.remove(owned.guildId, channelId);
      if (result === "deleted" || result === "gone") {
        this.channelDeleted(channelId);
        return;
      }
      // Kept and watched: the next member leaving it, or the next sweep, tries again.
      if (result === "forbidden") this.refused(owned.guildId, "missing_permissions");
      else log.warn("temp voice channel not deleted", { guild: owned.guildId, channel: channelId });
    } finally {
      this.deleting.delete(channelId);
    }
  }

  private forget(channelIds: string[]): void {
    void this.deps.registry?.forget(channelIds).catch((error: unknown) => log.warn("temp voice channels not forgotten", { error }));
  }

  private remember(key: string): void {
    this.lastCreated.delete(key);
    while (this.lastCreated.size >= COOLDOWN_MAX) {
      const oldest = this.lastCreated.keys().next().value;
      if (oldest === undefined) break;
      this.lastCreated.delete(oldest);
    }
    this.lastCreated.set(key, this.now());
  }

  private refused(guildId: string, reason: string, error?: string): void {
    if (reason !== "missing_permissions") {
      log.warn("temp voice channel not created", { guild: guildId, reason, error });
      return;
    }
    const last = this.permissionLogged.get(guildId);
    if (last !== undefined && this.now() - last < PERMISSION_LOG_INTERVAL_MS) return;
    this.permissionLogged.set(guildId, this.now());
    log.warn("temp voice: the bot lacks Manage Channels or Move Members", { guild: guildId });
  }
}
