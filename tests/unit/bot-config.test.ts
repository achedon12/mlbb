import { describe, expect, it } from "vitest";
import { isSuperAdmin, parseAdminIds, readBotConfig } from "@/lib/bot/config";
import { BOT_PERMISSIONS, communityInvite, discordImage, inviteUrl, PERMISSIONS_BITFIELD } from "@/lib/bot/public";
import { daysBetween, fillDays, isWindow, percentile } from "@/lib/bot/stats";

const ENV = {
  DATABASE_URL: "postgresql://mlbbdex:x@postgres:5432/mlbbdex",
  BOT_API_SECRET: "a".repeat(64),
  BOT_SESSION_SECRET: "b".repeat(64),
  BOT_INTERNAL_URL: "http://bot:3100",
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "c".repeat(32),
  BOT_SUPER_ADMIN_IDS: "111111111111111111, 222222222222222222,not-an-id,",
};

describe("bot configuration", () => {
  it("is absent without any variable, and off when one is wrong", () => {
    expect(readBotConfig({})).toBe("absent");
    expect(readBotConfig({ ...ENV, BOT_API_SECRET: "short" })).toBe("invalid");
    expect(readBotConfig({ ...ENV, BOT_SESSION_SECRET: ENV.BOT_API_SECRET })).toBe("invalid");
    expect(readBotConfig({ ...ENV, DATABASE_URL: "" })).toBe("invalid");
    expect(readBotConfig({ ...ENV, BOT_INTERNAL_URL: "ftp://bot" })).toBe("invalid");
    expect(readBotConfig({ ...ENV, DISCORD_CLIENT_ID: "abc" })).toBe("invalid");
  });

  it("reads a complete configuration", () => {
    const config = readBotConfig(ENV);
    expect(config).toMatchObject({ internalUrl: "http://bot:3100", clientId: "123456789012345678" });
  });
});

describe("super admin authorization", () => {
  const config = { superAdmins: parseAdminIds(ENV.BOT_SUPER_ADMIN_IDS) };

  it("keeps valid Discord ids only", () => {
    expect([...config.superAdmins]).toEqual(["111111111111111111", "222222222222222222"]);
  });

  it("admits listed ids, nobody else", () => {
    expect(isSuperAdmin(config, "111111111111111111")).toBe(true);
    expect(isSuperAdmin(config, "333333333333333333")).toBe(false);
    expect(isSuperAdmin(config, "not-an-id")).toBe(false);
    expect(isSuperAdmin(config, "")).toBe(false);
    expect(isSuperAdmin(config, null)).toBe(false);
    expect(isSuperAdmin(null, "111111111111111111")).toBe(false);
    expect(isSuperAdmin({ superAdmins: parseAdminIds("") }, "111111111111111111")).toBe(false);
  });
});

describe("invite link and public values", () => {
  it("asks for the least-privilege permission set, with the bot and commands scopes", () => {
    // View Channels, Send Messages, Send Messages in Threads, Embed Links, Attach
    // Files, Read Message History, Use External Emojis, Add Reactions.
    expect(PERMISSIONS_BITFIELD).toBe("274878286912");
    expect(Object.keys(BOT_PERMISSIONS)).not.toContain("Administrator");
    const url = new URL(inviteUrl("123456789012345678"));
    expect(url.searchParams.get("permissions")).toBe("274878286912");
    expect(url.searchParams.get("scope")).toBe("bot applications.commands");
    expect(url.searchParams.has("guild_id")).toBe(false);
    expect(new URL(inviteUrl("123456789012345678", "999999999999999999")).searchParams.get("guild_id")).toBe("999999999999999999");
    expect(new URL(inviteUrl("123456789012345678", "x&y")).searchParams.has("guild_id")).toBe(false);
  });

  it("only accepts Discord invite addresses for the community link", () => {
    const withInvite = (value: string) => {
      const before = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;
      process.env.NEXT_PUBLIC_DISCORD_INVITE_URL = value;
      try {
        return communityInvite();
      } finally {
        process.env.NEXT_PUBLIC_DISCORD_INVITE_URL = before;
      }
    };
    expect(withInvite("https://discord.gg/abc")).toBe("https://discord.gg/abc");
    expect(withInvite("https://discord.com/invite/abc")).toBe("https://discord.com/invite/abc");
    expect(withInvite("http://discord.gg/abc")).toBeNull();
    expect(withInvite("https://discord.gg.evil.example/abc")).toBeNull();
    expect(withInvite("javascript:alert(1)")).toBeNull();
    expect(withInvite("")).toBeNull();
  });

  it("builds Discord CDN images from hashes only", () => {
    expect(discordImage("icons", "123456789012345678", "a_0123456789abcdef0123456789abcdef")).toBe(
      "https://cdn.discordapp.com/icons/123456789012345678/a_0123456789abcdef0123456789abcdef.webp?size=64",
    );
    expect(discordImage("icons", "123456789012345678", "../../evil")).toBeNull();
    expect(discordImage("avatars", "123", "0123456789abcdef0123456789abcdef")).toBeNull();
    expect(discordImage("avatars", "123456789012345678", null)).toBeNull();
  });
});

describe("admin figures", () => {
  it("reads only the three windows from the query, not what every object inherits", () => {
    expect(["24h", "7d", "30d"].every(isWindow)).toBe(true);
    for (const w of [undefined, "", "1y", "constructor", "toString", "__proto__", "hasOwnProperty"]) expect(isWindow(w)).toBe(false);
  });

  it("computes a nearest-rank percentile", () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([5], 95)).toBe(5);
    expect(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95)).toBe(95);
  });

  it("fills every day of the range, zero when the database had no row", () => {
    const days = daysBetween(new Date("2026-11-12T10:00:00Z"), new Date("2026-11-14T08:00:00Z"));
    expect(days).toEqual(["2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(fillDays([{ day: "2026-11-14", value: 2 }, { day: "2026-11-01", value: 7 }], days)).toEqual([
      { day: "2026-11-12", value: 0 },
      { day: "2026-11-13", value: 0 },
      { day: "2026-11-14", value: 2 },
    ]);
  });
});
