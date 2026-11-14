import { GatewayIntentBits } from "discord.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeView } from "../src/embeds/common.js";
import {
  escapeName,
  fillPlaceholders,
  greetingMessage,
  greetingMentions,
  greetingSummary,
  greetingText,
  sanitizeGreeting,
  type GreetingContext,
} from "../src/embeds/greetings.js";
import { gatewayIntents, memberIntentEnabled } from "../src/discord/intents.js";
import { LOCALES, MESSAGES } from "../src/i18n/index.js";
import { BURST_MAX, BURST_WINDOW_MS, Greeter, type GreeterDeps, type MemberEvent } from "../src/managers/greeter.js";
import { DEFAULT_SETTINGS, GREETING_MAX_LENGTH, guildSettings, type GuildSettings } from "../src/site/schemas.js";

const SITE = "https://mlbbdex.com";
const en = makeView("en", SITE);
const fr = makeView("fr", SITE);
const GUILD = "123456789012345678";
const CHANNEL = "223456789012345678";
const USER = "323456789012345678";

const ctx = (custom: string | null = null, extra: Partial<GreetingContext> = {}): GreetingContext => ({
  member: { id: USER, username: "lay_la", avatarUrl: "https://cdn.discordapp.com/avatars/x.png" },
  guildName: "Land of Dawn",
  memberCount: 12345,
  custom,
  ...extra,
});

describe("greeting text", () => {
  it("fills every placeholder, the count in the server's language", () => {
    const text = greetingText(fr, "welcome", ctx("{user} · {username} · {server} · {count} · {unknown}"));
    expect(text).toBe(`<@${USER}> · lay\\_la · Land of Dawn · 12\u202f345 · {unknown}`);
    expect(greetingText(en, "welcome", ctx("{count}"))).toBe("12,345");
  });

  it("never mentions someone who left: {user} is their plain name on a goodbye", () => {
    expect(greetingText(en, "goodbye", ctx("Bye {user} ({username})"))).toBe("Bye lay\\_la (lay\\_la)");
  });

  it("uses the default text in the server's language when the owner wrote none", () => {
    const welcome = greetingText(fr, "welcome", ctx());
    expect(welcome).toContain(`<@${USER}>`);
    expect(welcome).toContain("Land of Dawn");
    expect(welcome).toContain("12\u202f345");
    expect(welcome).toContain("Salons et rôles");
    expect(greetingText(en, "goodbye", ctx("   "))).toBe("**lay\\_la** has left the server.");
  });

  it("breaks @everyone and @here, and removes role and user mentions", () => {
    const clean = sanitizeGreeting("@everyone @HERE <@&123456789012345678> <@123456789012345678> <@!123456789012345678> hi <#123456789012345678>");
    expect(clean).not.toMatch(/@(everyone|here)/i);
    expect(clean).not.toMatch(/<@[&!]?\d+>/);
    expect(clean).toContain("<#123456789012345678>");
    expect(clean.endsWith("hi <#123456789012345678>")).toBe(true);
  });

  it("caps the owner's text and squeezes blank lines", () => {
    expect(sanitizeGreeting("x".repeat(GREETING_MAX_LENGTH * 2))).toHaveLength(GREETING_MAX_LENGTH);
    expect(sanitizeGreeting("a \r\n\r\n\r\n\r\nb")).toBe("a\n\nb");
  });

  it("escapes the names it fills in, and never expands a placeholder twice", () => {
    expect(escapeName("**@everyone**")).toBe("\\*\\*@\u200beveryone\\*\\*");
    const evil = greetingText(en, "welcome", ctx("{username} joined {server}", { member: { id: USER, username: "{server}", avatarUrl: null }, guildName: "<@&1> @here" }));
    expect(evil).toBe("{server} joined <@\u200b&1> @\u200bhere");
    expect(fillPlaceholders("{user}{user}", { user: "a", username: "", server: "", count: "" })).toBe("aa");
  });
});

describe("greeting messages", () => {
  it("pings the newcomer alone, in the content, with their avatar", () => {
    const message = greetingMessage(en, "welcome", ctx("@everyone welcome {user}"), { ping: true });
    expect(message.content).toBe(`<@${USER}>`);
    expect(message.allowed_mentions).toEqual({ parse: [], users: [USER], roles: [], replied_user: false });
    const embed = message.embeds![0]!;
    expect(embed.color).toBe(0xe0a92e);
    expect(embed.thumbnail?.url).toBe("https://cdn.discordapp.com/avatars/x.png");
    expect(embed.description).toBe(`@\u200beveryone welcome <@${USER}>`);
  });

  it("pings nobody on a goodbye, a test or a summary", () => {
    const goodbye = greetingMessage(en, "goodbye", ctx(), { ping: true });
    expect(goodbye.content).toBeUndefined();
    expect(goodbye.allowed_mentions).toEqual(greetingMentions(null));
    expect(goodbye.embeds![0]!.thumbnail).toBeUndefined();

    const test = greetingMessage(en, "welcome", ctx(), { ping: false, title: "Test" });
    expect(test.content).toBeUndefined();
    expect(test.allowed_mentions).toEqual({ parse: [], users: [], roles: [], replied_user: false });
    expect(test.embeds![0]!.title).toBe("Test");

    const summary = greetingSummary(fr, "welcome", 1234);
    expect(summary.allowed_mentions).toEqual(greetingMentions(null));
    expect(summary.embeds![0]!.description).toBe("Bienvenue aux 1\u202f234 nouveaux membres ! Choisissez vos rôles dans Salons et rôles.");
  });
});

describe("greeting translations", () => {
  it("every language has the default texts with their placeholders", () => {
    for (const locale of LOCALES) {
      const g = (MESSAGES[locale] as { ui: { greetings: Record<string, string> } }).ui.greetings;
      for (const p of ["{user}", "{server}", "{count}"]) expect(g.welcome, `${locale} welcome`).toContain(p);
      expect(g.goodbye, `${locale} goodbye`).toContain("{username}");
      // A goodbye names, never mentions.
      expect(g.goodbye).not.toContain("{user}");
      expect(g.welcomeRaid).toContain("{count}");
      expect(g.goodbyeRaid).toContain("{count}");
    }
  });
});

describe("gateway intents", () => {
  it("adds GuildMembers only for member events, and never message content", () => {
    expect(gatewayIntents(false)).toEqual([GatewayIntentBits.Guilds]);
    expect(gatewayIntents(true)).toEqual([GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]);
    for (const on of [true, false]) {
      expect(gatewayIntents(on)).not.toContain(GatewayIntentBits.MessageContent);
      expect(gatewayIntents(on)).not.toContain(GatewayIntentBits.GuildPresences);
    }
  });

  it("reads the portal's member intent switch from the application flags", () => {
    expect(memberIntentEnabled(0)).toBe(false);
    expect(memberIntentEnabled(1 << 14)).toBe(true);
    expect(memberIntentEnabled(1 << 15)).toBe(true);
    expect(memberIntentEnabled((1 << 12) | (1 << 13) | (1 << 18))).toBe(false);
  });
});

describe("greeting settings from the site", () => {
  it("are off when absent or unreadable, and clip an over-long text", () => {
    expect(guildSettings.parse({ locale: "fr" }).welcome).toEqual({ channelId: null, message: null, failing: false });
    expect(guildSettings.parse({ welcome: "yes" }).welcome).toEqual({ channelId: null, message: null, failing: false });
    const parsed = guildSettings.parse({ goodbye: { channelId: CHANNEL, message: "x".repeat(900), failing: true } });
    expect(parsed.goodbye).toEqual({ channelId: CHANNEL, message: "x".repeat(GREETING_MAX_LENGTH), failing: true });
    expect(guildSettings.parse({ welcome: { channelId: "#general", message: 3 } }).welcome).toEqual({ channelId: null, message: null, failing: false });
  });
});

describe("greeter", () => {
  let settings: GuildSettings;
  let posted: { channelId: string; body: { content?: string; embeds?: { description?: string }[] } }[];
  let deps: GreeterDeps & { markFailing: ReturnType<typeof vi.fn> };
  let greeter: Greeter;

  const event = (n: number, guildId = GUILD): MemberEvent => ({
    guildId,
    guildName: "Land of Dawn",
    guildLocale: "en-US",
    memberCount: 100 + n,
    member: { id: `4${String(n).padStart(17, "0")}`, username: `member${n}`, avatarUrl: null },
  });
  const flush = () => vi.advanceTimersByTimeAsync(0);

  beforeEach(() => {
    vi.useFakeTimers();
    settings = { ...DEFAULT_SETTINGS, welcome: { channelId: CHANNEL, message: null, failing: false }, goodbye: { channelId: CHANNEL, message: null, failing: false } };
    posted = [];
    deps = {
      settings: async () => settings,
      poster: {
        post: vi.fn(async (channelId: string, body: unknown) => {
          posted.push({ channelId, body: body as (typeof posted)[number]["body"] });
          return { id: "1" };
        }),
      },
      canPost: () => true,
      markFailing: vi.fn(async (_guildId: string, kind: "welcome" | "goodbye") => {
        settings = { ...settings, [kind]: { ...settings[kind], failing: true } };
      }),
      siteUrl: SITE,
    };
    greeter = new Greeter(deps);
  });
  afterEach(() => {
    greeter.stop();
    vi.useRealTimers();
  });

  it("greets one member at once, and a few in a row one by one", async () => {
    await greeter.handle("welcome", event(1));
    expect(posted).toHaveLength(1);
    expect(posted[0]!.body.content).toBe(`<@${event(1).member.id}>`);
    for (let n = 2; n <= BURST_MAX; n++) await greeter.handle("welcome", event(n));
    expect(posted).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(BURST_WINDOW_MS);
    expect(posted).toHaveLength(BURST_MAX);
    expect(posted.map((p) => p.body.content)).toEqual(Array.from({ length: BURST_MAX }, (_, i) => `<@${event(i + 1).member.id}>`));
    expect(greeter.pending).toBe(0);
  });

  it("sums up a raid in one message instead of flooding the channel", async () => {
    for (let n = 1; n <= 50; n++) await greeter.handle("welcome", event(n));
    expect(posted).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(BURST_WINDOW_MS);
    expect(posted).toHaveLength(2);
    expect(posted[1]!.body.content).toBeUndefined();
    expect(posted[1]!.body.embeds![0]!.description).toBe("Welcome to the 49 new members! Pick your roles in Channels & Roles.");

    // The raid goes on: nobody is greeted at once, one summary per window.
    for (let n = 51; n <= 60; n++) await greeter.handle("welcome", event(n));
    expect(posted).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(BURST_WINDOW_MS);
    expect(posted).toHaveLength(3);
    expect(posted[2]!.body.embeds![0]!.description).toContain("10 new members");

    // Then it calms down: after a quiet window, a newcomer is greeted at once again.
    await vi.advanceTimersByTimeAsync(BURST_WINDOW_MS);
    expect(greeter.pending).toBe(0);
    await greeter.handle("welcome", event(61));
    expect(posted).toHaveLength(4);
    expect(posted[3]!.body.content).toBe(`<@${event(61).member.id}>`);
  });

  it("counts each server and each kind on its own", async () => {
    for (let n = 1; n <= 8; n++) await greeter.handle("welcome", event(n));
    await greeter.handle("welcome", event(9, "999999999999999999"));
    await greeter.handle("goodbye", event(10));
    expect(posted).toHaveLength(3);
    expect(posted[2]!.body.content).toBeUndefined();
    expect(posted[2]!.body.embeds![0]!.description).toBe("**member10** has left the server.");
  });

  it("posts nothing while a message is off or failing", async () => {
    settings = { ...settings, welcome: { channelId: null, message: "hi", failing: false }, goodbye: { channelId: CHANNEL, message: null, failing: true } };
    await greeter.handle("welcome", event(1));
    await greeter.handle("goodbye", event(2));
    await vi.advanceTimersByTimeAsync(BURST_WINDOW_MS);
    expect(posted).toHaveLength(0);
    expect(greeter.pending).toBe(0);
  });

  it("marks a channel it cannot post in as failing, and stops there", async () => {
    deps.canPost = () => false;
    greeter = new Greeter(deps);
    await greeter.handle("welcome", event(1));
    expect(posted).toHaveLength(0);
    expect(deps.markFailing).toHaveBeenCalledWith(GUILD, "welcome");
    await greeter.handle("welcome", event(2));
    await vi.advanceTimersByTimeAsync(BURST_WINDOW_MS);
    expect(deps.markFailing).toHaveBeenCalledTimes(1);
  });

  it("marks failing on a permission error, not on a hiccup", async () => {
    deps.poster.post = vi.fn(async () => {
      throw Object.assign(new Error("Server Error"), { status: 503 });
    });
    await greeter.handle("welcome", event(1));
    expect(deps.markFailing).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(BURST_WINDOW_MS);

    deps.poster.post = vi.fn(async () => {
      throw Object.assign(new Error("Missing Access"), { code: 50001, status: 403 });
    });
    await greeter.handle("goodbye", event(2));
    expect(deps.markFailing).toHaveBeenCalledWith(GUILD, "goodbye");
  });

  it("never throws when the site cannot be reached", async () => {
    deps.settings = async () => {
      throw new Error("site down");
    };
    greeter = new Greeter(deps);
    await expect(greeter.handle("welcome", event(1))).resolves.toBeUndefined();
    await flush();
    expect(posted).toHaveLength(0);
  });
});
