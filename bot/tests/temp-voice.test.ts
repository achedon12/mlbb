import { OverwriteType, PermissionFlagsBits } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import {
  grantable,
  hasTempVoicePermissions,
  OWNER_PERMISSIONS,
  parentFor,
  TEMP_VOICE_REQUIRED,
  tempVoiceOverwrites,
} from "../src/discord/temp-voice.js";
import { t } from "../src/i18n/index.js";
import { LOCALES } from "../src/i18n/locales.js";
import {
  CHANNEL_NAME_MAX,
  channelName,
  CREATE_COOLDOWN_MS,
  hubFor,
  MAX_TEMP_CHANNELS_PER_GUILD,
  sweepPlan,
  TempVoiceManager,
  userLimitOf,
  type CreateResult,
  type MoveResult,
  type RemoveResult,
  type TempVoiceDiscord,
  type VoiceMove,
} from "../src/managers/temp-voice.js";
import { DEFAULT_SETTINGS, guildSettings, tempVoiceChannelsPage, type GuildSettings, type TempVoiceChannel } from "../src/site/schemas.js";

const GUILD = "123456789012345678";
const OTHER_GUILD = "123456789012345679";
const HUB = "223456789012345678";
const RANKED = "223456789012345679";
const USER = "323456789012345678";
const USER_2 = "323456789012345679";
const BOT = "423456789012345678";
const ROLE = "523456789012345678";

const withHubs = (hubs: GuildSettings["tempVoice"]["hubs"]): GuildSettings => ({ ...DEFAULT_SETTINGS, tempVoice: { hubs } });
const SETTINGS = withHubs([
  { channelId: HUB, userLimit: 10, nameTemplate: null },
  { channelId: RANKED, userLimit: 5, nameTemplate: "Ranked · {user}" },
]);

describe("channel names", () => {
  it("fills the template or the server language's default with the display name", () => {
    expect(channelName(null, "Leo", "🎯 {user}'s lobby")).toBe("🎯 Leo's lobby");
    expect(channelName("Ranked · {user}", "Leo", "🎯 {user}'s lobby")).toBe("Ranked · Leo");
    expect(channelName("{user} & {user}", "Leo", "x")).toBe("Leo & Leo");
    // A template without the placeholder is used as is.
    expect(channelName("Custom games", "Leo", "x")).toBe("Custom games");
  });

  it("strips line breaks and control characters, and clips to Discord's 100 characters", () => {
    expect(channelName(null, "Le\no\u0000  ", "🎯 {user}'s lobby")).toBe("🎯 Le o's lobby");
    const long = channelName(null, "x".repeat(300), "🎯 {user}'s lobby");
    expect([...long].length).toBeLessThanOrEqual(CHANNEL_NAME_MAX);
    expect(long.startsWith("🎯 xxx")).toBe(true);
  });

  it("falls back when the template or the name comes out blank", () => {
    expect(channelName("   ", "Leo", "🎯 {user}'s lobby")).toBe("🎯 Leo's lobby");
    expect(channelName(null, "", "🎯 {user}'s lobby")).toBe("🎯 ?'s lobby");
  });

  it("has a default name in every bot language, with the placeholder", () => {
    for (const locale of LOCALES) {
      const name = t(locale, "ui.tempVoice.defaultName");
      expect(name, locale).toContain("{user}");
      expect(channelName(null, "Leo", name)).toContain("Leo");
    }
    expect(t("fr", "ui.tempVoice.defaultName")).not.toBe(t("en", "ui.tempVoice.defaultName"));
  });
});

describe("user limits and hubs", () => {
  it("keeps the limit within Discord's 0 to 99", () => {
    expect(userLimitOf(5)).toBe(5);
    expect(userLimitOf(10)).toBe(10);
    expect(userLimitOf(0)).toBe(0);
    expect(userLimitOf(-3)).toBe(0);
    expect(userLimitOf(250)).toBe(99);
    expect(userLimitOf(4.7)).toBe(4);
    expect(userLimitOf(Number.NaN)).toBe(0);
    expect(userLimitOf(undefined)).toBe(0);
  });

  it("finds the hub joined, nothing for another channel", () => {
    expect(hubFor(SETTINGS, RANKED)).toMatchObject({ userLimit: 5 });
    expect(hubFor(SETTINGS, "999999999999999999")).toBeNull();
    expect(hubFor(SETTINGS, null)).toBeNull();
  });

  it("reads the site's hubs, dropping what it cannot use", () => {
    const parsed = guildSettings.parse({
      ...DEFAULT_SETTINGS,
      tempVoice: {
        hubs: [
          { channelId: HUB, userLimit: 10, nameTemplate: "  {user}  " },
          { channelId: HUB, userLimit: 3, nameTemplate: null },
          { channelId: "not a snowflake", userLimit: 1 },
          { channelId: RANKED, userLimit: 500, nameTemplate: 42 },
        ],
      },
    });
    expect(parsed.tempVoice.hubs).toEqual([
      { channelId: HUB, userLimit: 10, nameTemplate: "{user}" },
      { channelId: RANKED, userLimit: 0, nameTemplate: null },
    ]);
    // An older site, or garbage: no hub, nothing created.
    expect(guildSettings.parse({ ...DEFAULT_SETTINGS, tempVoice: undefined }).tempVoice.hubs).toEqual([]);
    expect(guildSettings.parse({ ...DEFAULT_SETTINGS, tempVoice: "x" }).tempVoice.hubs).toEqual([]);
  });

  it("reads a page of registered channels, an unreadable one dropped", () => {
    const page = tempVoiceChannelsPage.parse({
      channels: [{ guildId: GUILD, channelId: HUB, hubChannelId: RANKED, ownerId: USER }, { guildId: "x" }],
      next: null,
    });
    expect(page.channels).toHaveLength(1);
  });
});

describe("permissions", () => {
  const required = TEMP_VOICE_REQUIRED;

  it("needs Manage Channels, Move Members, View Channel and Connect, or Administrator", () => {
    expect(hasTempVoicePermissions(required)).toBe(true);
    expect(hasTempVoicePermissions(PermissionFlagsBits.Administrator)).toBe(true);
    expect(hasTempVoicePermissions(required & ~PermissionFlagsBits.ManageChannels)).toBe(false);
    expect(hasTempVoicePermissions(required & ~PermissionFlagsBits.MoveMembers)).toBe(false);
    expect(hasTempVoicePermissions(0n)).toBe(false);
  });

  it("gives the member their channel's moderation, only what the bot holds itself", () => {
    const bot = required | PermissionFlagsBits.Speak;
    const overwrites = tempVoiceOverwrites([], bot, USER, BOT);
    const owner = overwrites.find((o) => o.id === USER)!;
    expect(owner.type).toBe(OverwriteType.Member);
    expect(owner.allow & PermissionFlagsBits.ManageChannels).toBe(PermissionFlagsBits.ManageChannels);
    expect(owner.allow & PermissionFlagsBits.MoveMembers).toBe(PermissionFlagsBits.MoveMembers);
    // The bot lacks Mute Members: it cannot hand it out.
    expect(owner.allow & PermissionFlagsBits.MuteMembers).toBe(0n);
    // Never more than the owner set, never Manage Roles or Administrator.
    expect(owner.allow & ~OWNER_PERMISSIONS).toBe(0n);
    const admin = tempVoiceOverwrites([], PermissionFlagsBits.Administrator, USER, BOT).find((o) => o.id === USER)!;
    expect(admin.allow).toBe(OWNER_PERMISSIONS);
    expect(overwrites.find((o) => o.id === BOT)!.allow).toBe(required);
  });

  it("copies the category's overwrites, without the bits the bot lacks", () => {
    const base = [
      { id: GUILD, type: OverwriteType.Role, allow: 0n, deny: PermissionFlagsBits.Connect | PermissionFlagsBits.ManageWebhooks },
      { id: ROLE, type: OverwriteType.Role, allow: PermissionFlagsBits.Connect, deny: 0n },
      { id: "623456789012345678", type: OverwriteType.Role, allow: PermissionFlagsBits.ManageWebhooks, deny: 0n },
      // The member's and the bot's own are replaced, not doubled.
      { id: USER, type: OverwriteType.Member, allow: 0n, deny: PermissionFlagsBits.Connect },
      { id: BOT, type: OverwriteType.Member, allow: 0n, deny: PermissionFlagsBits.ViewChannel },
    ];
    const overwrites = tempVoiceOverwrites(base, required, USER, BOT);
    expect(overwrites.find((o) => o.id === GUILD)).toEqual({ id: GUILD, type: OverwriteType.Role, allow: 0n, deny: PermissionFlagsBits.Connect });
    expect(overwrites.find((o) => o.id === ROLE)?.allow).toBe(PermissionFlagsBits.Connect);
    // Left with nothing: dropped.
    expect(overwrites.some((o) => o.id === "623456789012345678")).toBe(false);
    expect(overwrites.filter((o) => o.id === USER)).toHaveLength(1);
    expect(overwrites.filter((o) => o.id === BOT)).toEqual([{ id: BOT, type: OverwriteType.Member, allow: required, deny: 0n }]);
    expect(grantable(PermissionFlagsBits.Administrator) & PermissionFlagsBits.ManageWebhooks).toBe(PermissionFlagsBits.ManageWebhooks);
  });

  it("creates outside a full category (Discord's 50 channels)", () => {
    expect(parentFor("1", 10)).toBe("1");
    expect(parentFor("1", 49)).toBe("1");
    expect(parentFor("1", 50)).toBeNull();
    expect(parentFor(null, 0)).toBeNull();
  });
});

describe("which channels the sweep deletes", () => {
  const channel = (channelId: string, guildId = GUILD): TempVoiceChannel => ({ guildId, channelId, hubChannelId: HUB, ownerId: USER });

  it("deletes the empty ones, forgets the gone ones, keeps the others, leaves other shards' alone", () => {
    const facts = { a: "empty", b: "missing", c: "occupied", d: "elsewhere", e: "hub" } as const;
    const all = (Object.keys(facts) as (keyof typeof facts)[]).map((k) => channel(k));
    const plan = sweepPlan(all, (c) => facts[c.channelId as keyof typeof facts]);
    expect(plan.remove.map((c) => c.channelId)).toEqual(["a"]);
    expect(plan.forget.map((c) => c.channelId)).toEqual(["b", "e"]);
    expect(plan.keep.map((c) => c.channelId)).toEqual(["c"]);
  });
});

// ─── The manager, against a fake Discord ─────────────────────────────

function fakeDiscord(options: { guilds?: string[]; channels?: string[] } = {}) {
  const guilds = new Set(options.guilds ?? [GUILD]);
  /** channel → members in it */
  const channels = new Map<string, Set<string>>([[HUB, new Set()], [RANKED, new Set()]]);
  for (const id of options.channels ?? []) channels.set(id, new Set());
  const where = new Map<string, string>();
  let next = 0;
  const calls = { create: [] as { hub: string; name: string; limit: number }[], move: [] as string[], remove: [] as string[] };
  const result = {
    create: null as CreateResult | null,
    move: null as MoveResult | null,
    remove: null as RemoveResult | null,
    /** Run between the creation and the move (a member leaving meanwhile). */
    beforeMove: null as (() => void) | null,
  };
  const join = (user: string, channel: string | null) => {
    const from = where.get(user) ?? null;
    if (from) channels.get(from)?.delete(user);
    if (channel) {
      channels.get(channel)?.add(user);
      where.set(user, channel);
    } else where.delete(user);
    return from;
  };
  const discord: TempVoiceDiscord = {
    hasGuild: (g) => guilds.has(g),
    occupants: (g, c) => (guilds.has(g) && channels.has(c) ? channels.get(c)!.size : null),
    connectedTo: (_g, u) => where.get(u) ?? null,
    create: vi.fn(async (_g, hub, _owner, name, limit) => {
      calls.create.push({ hub: hub.channelId, name, limit });
      if (result.create) return result.create;
      const id = `72345678901234567${next++}`;
      channels.set(id, new Set());
      result.beforeMove?.();
      return { ok: true as const, channelId: id };
    }),
    move: vi.fn(async (_g, user, channel) => {
      calls.move.push(channel);
      if (result.move) return result.move;
      if (!where.has(user)) return "gone" as const;
      join(user, channel);
      return "moved" as const;
    }),
    remove: vi.fn(async (_g, channel) => {
      calls.remove.push(channel);
      if (result.remove) return result.remove;
      return channels.delete(channel) ? ("deleted" as const) : ("gone" as const);
    }),
  };
  return { discord, channels, where, join, calls, result };
}

function setup(options: { settings?: GuildSettings; registered?: TempVoiceChannel[]; guilds?: string[]; channels?: string[] } = {}) {
  const fake = fakeDiscord(options);
  let now = 1_000_000;
  const registry = {
    register: vi.fn(async () => ({})),
    forget: vi.fn(async () => ({})),
    list: vi.fn(async () => options.registered ?? []),
  };
  const manager = new TempVoiceManager({
    settings: async () => options.settings ?? SETTINGS,
    defaultName: () => "🎯 {user}'s lobby",
    discord: fake.discord,
    registry,
    now: () => now,
  });
  /** A member moves (the cache first, then the event, like the gateway). */
  const voice = (user: string, to: string | null, extra: Partial<VoiceMove> = {}) => {
    const from = fake.join(user, to);
    return manager.handle({ guildId: GUILD, userId: user, bot: false, displayName: "Leo", from, to, ...extra });
  };
  return { ...fake, manager, registry, voice, tick: (ms: number) => (now += ms) };
}

describe("join to create", () => {
  it("creates a channel from the hub's settings, moves the member in, registers it", async () => {
    const s = setup();
    await s.voice(USER, RANKED);
    expect(s.calls.create).toEqual([{ hub: RANKED, name: "Ranked · Leo", limit: 5 }]);
    const [created] = [...s.manager.watched.keys()];
    expect(s.where.get(USER)).toBe(created);
    expect(s.registry.register).toHaveBeenCalledWith({ guildId: GUILD, channelId: created, hubChannelId: RANKED, ownerId: USER });
    // The hub stays.
    expect(s.channels.has(RANKED)).toBe(true);
  });

  it("uses the default name in the server's language without a template", async () => {
    const s = setup();
    await s.voice(USER, HUB);
    expect(s.calls.create[0]).toEqual({ hub: HUB, name: "🎯 Leo's lobby", limit: 10 });
  });

  it("deletes the channel once the last member leaves, never the hub", async () => {
    const s = setup();
    await s.voice(USER, HUB);
    const created = s.where.get(USER)!;
    await s.voice(USER_2, created);
    await s.voice(USER, null);
    expect(s.calls.remove).toEqual([]);
    await s.voice(USER_2, null);
    expect(s.calls.remove).toEqual([created]);
    expect(s.manager.watched.size).toBe(0);
    expect(s.registry.forget).toHaveBeenCalledWith([created]);
    // Leaving the hub itself deletes nothing.
    await s.voice(USER, HUB);
    s.join(USER, null);
    await s.manager.handle({ guildId: GUILD, userId: USER, bot: false, displayName: "Leo", from: HUB, to: null });
    expect(s.calls.remove).toHaveLength(1);
    expect(s.channels.has(HUB)).toBe(true);
  });

  it("never deletes a channel it did not create", async () => {
    const s = setup({ channels: ["823456789012345678"] });
    await s.voice(USER, "823456789012345678");
    await s.voice(USER, null);
    expect(s.calls.remove).toEqual([]);
    expect(s.calls.create).toEqual([]);
  });

  it("deletes the new channel when the member left before the move", async () => {
    const s = setup();
    s.result.beforeMove = () => s.join(USER, null);
    await s.voice(USER, HUB);
    expect(s.calls.move).toEqual([]);
    expect(s.calls.remove).toHaveLength(1);
    expect(s.manager.watched.size).toBe(0);
  });

  it("deletes it too when Discord says the member is gone at the move", async () => {
    const s = setup();
    s.result.move = "gone";
    await s.voice(USER, HUB);
    expect(s.calls.remove).toHaveLength(1);
  });

  it("logs and creates nothing without Manage Channels or Move Members", async () => {
    const s = setup();
    s.result.create = { ok: false, reason: "missing_permissions" };
    await s.voice(USER, HUB);
    expect(s.manager.watched.size).toBe(0);
    expect(s.registry.register).not.toHaveBeenCalled();
    expect(s.where.get(USER)).toBe(HUB);
  });

  it("keeps watching a channel it was not allowed to delete", async () => {
    const s = setup();
    await s.voice(USER, HUB);
    const created = s.where.get(USER)!;
    s.result.remove = "forbidden";
    await s.voice(USER, null);
    expect(s.manager.watched.has(created)).toBe(true);
    expect(s.registry.forget).not.toHaveBeenCalled();
  });

  it("sends a member back to the channel they own instead of creating a second one", async () => {
    const s = setup();
    await s.voice(USER, HUB);
    const created = s.where.get(USER)!;
    await s.voice(USER_2, created);
    s.tick(CREATE_COOLDOWN_MS * 2);
    await s.voice(USER, RANKED);
    expect(s.calls.create).toHaveLength(1);
    expect(s.where.get(USER)).toBe(created);
  });

  it("creates one channel per member at a time, and at most one per cooldown", async () => {
    const s = setup();
    // Two events for the same join, handled at once.
    s.join(USER, HUB);
    const move = { guildId: GUILD, userId: USER, bot: false, displayName: "Leo", from: null, to: HUB };
    await Promise.all([s.manager.handle(move), s.manager.handle({ ...move, from: RANKED })]);
    expect(s.calls.create).toHaveLength(1);
    // In and out of the hub: the channel goes, no new one before the cooldown.
    await s.voice(USER, null);
    await s.voice(USER, HUB);
    expect(s.calls.create).toHaveLength(1);
    s.tick(CREATE_COOLDOWN_MS);
    await s.voice(USER, null);
    await s.voice(USER, HUB);
    expect(s.calls.create).toHaveLength(2);
  });

  it("gives bots nothing, and ignores a hub of no server's settings", async () => {
    const s = setup({ settings: withHubs([]) });
    await s.voice(USER, HUB);
    const t = setup();
    await t.voice(USER, HUB, { bot: true });
    expect(s.calls.create).toEqual([]);
    expect(t.calls.create).toEqual([]);
  });

  it("stops at the per-server cap", async () => {
    const registered = Array.from({ length: MAX_TEMP_CHANNELS_PER_GUILD }, (_, i) => ({
      guildId: GUILD,
      channelId: `9234567890123${String(i).padStart(5, "0")}`,
      hubChannelId: HUB,
      ownerId: `8234567890123${String(i).padStart(5, "0")}`,
    }));
    const s = setup({ registered, channels: registered.map((c) => c.channelId) });
    // Every registered channel occupied, so the sweep keeps them.
    registered.forEach((c, i) => s.join(`6234567890123${String(i).padStart(5, "0")}`, c.channelId));
    await s.manager.sweep();
    expect(s.manager.watched.size).toBe(MAX_TEMP_CHANNELS_PER_GUILD);
    await s.voice(USER, HUB);
    expect(s.calls.create).toEqual([]);
  });

  it("forgets a channel deleted by someone else", async () => {
    const s = setup();
    await s.voice(USER, HUB);
    const created = s.where.get(USER)!;
    s.manager.channelDeleted(created);
    expect(s.manager.watched.size).toBe(0);
    expect(s.registry.forget).toHaveBeenCalledWith([created]);
    s.manager.channelDeleted(HUB);
    expect(s.registry.forget).toHaveBeenCalledTimes(1);
  });
});

describe("the sweep after a restart", () => {
  const reg = (channelId: string, guildId = GUILD): TempVoiceChannel => ({ guildId, channelId, hubChannelId: HUB, ownerId: USER });
  const EMPTY = "723456789012345601";
  const BUSY = "723456789012345602";
  const GONE = "723456789012345603";
  const FOREIGN = "723456789012345604";

  it("deletes the empty ones, forgets the gone ones, watches the busy ones, leaves other shards' alone", async () => {
    const s = setup({ registered: [reg(EMPTY), reg(BUSY), reg(GONE), reg(FOREIGN, OTHER_GUILD)], channels: [EMPTY, BUSY] });
    s.join(USER_2, BUSY);
    const plan = await s.manager.sweep();
    expect(plan?.remove.map((c) => c.channelId)).toEqual([EMPTY]);
    expect(plan?.forget.map((c) => c.channelId)).toEqual([GONE]);
    expect(s.calls.remove).toEqual([EMPTY]);
    expect(s.registry.forget).toHaveBeenCalledWith([GONE]);
    expect([...s.manager.watched.keys()]).toEqual([BUSY]);
    // The busy one goes once its last member leaves.
    await s.voice(USER_2, null);
    expect(s.calls.remove).toEqual([EMPTY, BUSY]);
  });

  it("never deletes a registered channel that became a hub, and nothing when the settings are unreadable", async () => {
    const hubbed = setup({ registered: [reg(HUB)] });
    const plan = await hubbed.manager.sweep();
    expect(plan?.forget.map((c) => c.channelId)).toEqual([HUB]);
    expect(hubbed.calls.remove).toEqual([]);

    const fake = fakeDiscord({ channels: [EMPTY] });
    const blind = new TempVoiceManager({
      settings: async () => {
        throw new Error("site down");
      },
      defaultName: () => "x",
      discord: fake.discord,
      registry: { register: async () => ({}), forget: async () => ({}), list: async () => [reg(EMPTY)] },
    });
    await blind.sweep();
    expect(fake.calls.remove).toEqual([]);
  });

  it("does nothing when the site cannot list them", async () => {
    const fake = fakeDiscord();
    const manager = new TempVoiceManager({
      settings: async () => SETTINGS,
      defaultName: () => "x",
      discord: fake.discord,
      registry: {
        register: async () => ({}),
        forget: async () => ({}),
        list: async () => {
          throw new Error("site down");
        },
      },
    });
    expect(await manager.sweep()).toBeNull();
    expect(fake.calls.remove).toEqual([]);
  });
});
