import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "../src/cache.js";
import { sanitize, scrub } from "../src/log.js";
import { CommandLogger } from "../src/managers/command-logger.js";
import { verify } from "../src/security/signing.js";
import { GameData } from "../src/site/game-data.js";
import { SiteUnavailableError } from "../src/site/http.js";
import { SiteClient } from "../src/site/internal-api.js";
import { guildSettings, pendingAnnouncements } from "../src/site/schemas.js";

const SECRET = "k".repeat(64);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("internal API client", () => {
  it("signs pathname + query and the raw body, as the site verifies them", async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => json({ stored: 1 }));
    const client = new SiteClient("http://mlbb:3001", SECRET, fetch);
    await client.leaderboard("123456789012345678", "quiz", "week").catch(() => undefined);
    await client.submitResults([
      { guildId: "123456789012345678", day: "2026-11-14", game: "quiz", discordUserId: "223456789012345678", discordUserName: "x", points: 3 },
    ]);
    for (const [url, init] of fetch.mock.calls) {
      const u = new URL(url);
      const headers = init!.headers as Record<string, string>;
      expect(
        verify({
          secret: SECRET,
          timestamp: headers["X-MLBBDex-Timestamp"],
          signature: headers["X-MLBBDex-Signature"],
          method: init!.method!,
          path: u.pathname + u.search,
          body: (init!.body as string | undefined) ?? "",
        }),
      ).toEqual({ ok: true });
    }
    expect(fetch.mock.calls[0]![0]).toBe("http://mlbb:3001/api/bot/daily/leaderboard?guild=123456789012345678&game=quiz&period=week");
  });

  it("retries a refused signature once, re-signed a second later", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn<(url: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(json({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(json({ ok: true }));
    const client = new SiteClient("http://mlbb:3001", SECRET, fetch, 1100);
    const pending = client.reportDeliveries([]);
    await vi.advanceTimersByTimeAsync(1200);
    await pending;
    vi.useRealTimers();
    expect(fetch).toHaveBeenCalledTimes(2);
    const ts = fetch.mock.calls.map(([, init]) => (init!.headers as Record<string, string>)["X-MLBBDex-Timestamp"]);
    expect(ts[0]).not.toBe(ts[1]);
  });

  it("falls back to default settings on 404, and caches them", async () => {
    const fetch = vi.fn(async () => json({ error: "not found" }, 404));
    const client = new SiteClient("http://mlbb:3001", SECRET, fetch);
    expect((await client.settings("123456789012345678")).dailyHourUtc).toBe(12);
    await client.settings("123456789012345678");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await client.guildLocale(null)).toBeNull();
  });
});

describe("payload validation", () => {
  it("normalizes settings, flat or nested, and drops invalid ids", () => {
    const flat = guildSettings.parse({
      guildId: "1",
      locale: "fr",
      patches: { channelId: "123456789012345678", roleId: "@everyone", failing: false },
      dailyHourUtc: 30,
    });
    expect(flat.locale).toBe("fr");
    expect(flat.announcements.patches).toEqual({ channelId: "123456789012345678", roleId: null, failing: false });
    expect(flat.announcements.skins.channelId).toBeNull();
    expect(flat.dailyHourUtc).toBe(12);
    const nested = guildSettings.parse({ data: { locale: "xx", announcements: { esports: { channelId: "123456789012345678", roleId: null, failing: true } } } });
    expect(nested.locale).toBe("en");
    expect(nested.announcements.esports.failing).toBe(true);
  });

  it("keeps the valid pending announcements and drops the broken ones", () => {
    const parsed = pendingAnnouncements.parse({
      announcements: [
        { id: 1, type: "patches", key: "2.1.90", payload: {}, targets: [{ guildId: "123456789012345678", channelId: "223456789012345678", roleId: null, locale: "it" }] },
        { id: 2, type: "unknown", key: "x", payload: {}, targets: [] },
        { id: 3, type: "skins", key: "x", payload: {}, targets: [{ guildId: "not-a-snowflake", channelId: "1" }] },
      ],
    });
    expect(parsed.announcements.map((a) => a.id)).toEqual(["1"]);
  });
});

describe("public API client", () => {
  it("reads the response envelope, caches, and survives the site going down", async () => {
    let up = true;
    const fetch = vi.fn(async () => (up ? json({ data: [{ slug: "layla", name: "Layla", title: null, roles: ["Marksman"], lanes: ["Gold"], release: null, extra: 1 }] }) : json({}, 503)));
    const data = new GameData("https://mlbbdex.com", fetch);
    const heroes = await data.heroes();
    expect(heroes).toEqual([{ slug: "layla", name: "Layla", title: null, roles: ["Marksman"], lanes: ["Gold"], release: null }]);
    await data.heroes();
    expect(fetch).toHaveBeenCalledTimes(1);
    up = false;
    await expect(data.rankings()).rejects.toBeInstanceOf(SiteUnavailableError);
  });

  it("treats a missing optional endpoint as absent, and refuses odd slugs without a request", async () => {
    const fetch = vi.fn(async () => json({ error: "Hero not found" }, 404));
    const data = new GameData("https://mlbbdex.com", fetch);
    expect(await data.counters("layla")).toBeNull();
    expect(await data.hero("../admin")).toBeNull();
    expect(await data.patch("latest; rm", "en")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("cache", () => {
  it("expires, caps its size, shares loads and serves stale on failure", async () => {
    let now = 0;
    const cache = new TtlCache<number>(1000, 2, () => now);
    const load = vi.fn(async () => 1);
    await Promise.all([cache.getOrLoad("a", load), cache.getOrLoad("a", load)]);
    expect(load).toHaveBeenCalledTimes(1);
    now = 2000;
    expect(cache.get("a")).toBeUndefined();
    expect(await cache.getOrLoad("a", async () => Promise.reject(new Error("down")))).toBe(1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.size).toBe(2);
  });
});

describe("logging", () => {
  it("redacts secrets by field name and token-looking strings anywhere", () => {
    const token = `${"M".repeat(24)}.${"G".repeat(6)}.${"x".repeat(38)}`;
    expect(scrub(`failed with ${token}`)).toBe("failed with [redacted]");
    expect(sanitize({ token: "abc", nested: { BOT_API_SECRET: "x", Authorization: "y", ok: 1 } })).toEqual({
      token: "[redacted]",
      nested: { BOT_API_SECRET: "[redacted]", Authorization: "[redacted]", ok: 1 },
    });
    expect(sanitize(new Error(`bad ${token}`))).toMatchObject({ name: "Error", message: "bad [redacted]" });
  });
});

describe("command usage log", () => {
  it("buffers, sends in batches without user ids, and keeps entries when the site fails", async () => {
    const logCommands = vi.fn(async () => undefined);
    const logger = new CommandLogger({ logCommands });
    for (let i = 0; i < 501; i++) logger.record({ command: "hero", guildId: null, locale: "en", durationMs: 12.6, ok: true });
    await logger.flush();
    expect(logCommands).toHaveBeenCalledTimes(2);
    const first = (logCommands.mock.calls[0] as unknown as [unknown[]])[0];
    expect(first).toHaveLength(500);
    expect(first[0]).toEqual({ command: "hero", guildId: null, locale: "en", durationMs: 13, ok: true });

    logCommands.mockRejectedValueOnce(new Error("down"));
    logger.record({ command: "item", guildId: "123456789012345678", locale: "fr", durationMs: 5, ok: false });
    await logger.flush();
    expect(logger.pending).toBe(1);
    await logger.flush();
    expect(logger.pending).toBe(0);
  });

  it("records nothing when the site is not configured", () => {
    const logger = new CommandLogger(null);
    logger.record({ command: "hero", guildId: null, locale: "en", durationMs: 1, ok: true });
    expect(logger.pending).toBe(0);
  });
});
