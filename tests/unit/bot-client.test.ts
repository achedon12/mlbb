import { afterEach, describe, expect, it, vi } from "vitest";
import { botStats, BotUnavailable, refusalFor } from "@/lib/bot/client";
import type { BotConfig } from "@/lib/bot/config";

/**
 * The site's reading of the bot's `/internal/stats`, against the answer the
 * bot really sends. The shards report discord.js's `client.ws.status`, a
 * number (0 = Ready): a schema expecting a string refused every answer, and
 * the admin panel said "the bot does not answer" while `/health` was fine.
 */

const config: BotConfig = {
  apiSecret: "a".repeat(64),
  sessionSecret: "b".repeat(64),
  internalUrl: "http://bot:3100",
  clientId: "123456789012345678",
  clientSecret: "c".repeat(32),
  superAdmins: new Set(),
};

function answer(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}

afterEach(() => vi.unstubAllGlobals());

describe("botStats", () => {
  it("reads the answer of a bot whose shards report a numeric status", async () => {
    // Exactly what bot/src/index.ts sent in production (one shard, ready).
    answer({ shards: [{ id: 0, status: 0, ping: 41, guilds: 1 }], guildCount: 1, uptimeSec: 2460, memoryMb: 88 });
    const stats = await botStats(config);
    expect(stats.guildCount).toBe(1);
    expect(stats.shards[0]).toMatchObject({ id: 0, status: "ready", ping: 41, guilds: 1 });
  });

  it("names every gateway status, and keeps a label sent as text", async () => {
    answer({
      shards: [
        { id: 0, status: 5, ping: -1, guilds: 0 },
        { id: 1, status: "reconnecting", ping: 80, guilds: 3 },
        { id: 2, status: 42, ping: 10, guilds: 1 },
      ],
      guildCount: 4,
      uptimeSec: 10,
      memoryMb: 50,
    });
    const stats = await botStats(config);
    expect(stats.shards.map((s) => s.status)).toEqual(["disconnected", "reconnecting", "unknown"]);
    // A shard that has not heartbeated yet reports -1: no ping known.
    expect(stats.shards[0].ping).toBeNull();
  });

  it("reads the details of a newer bot, and does without them from an older one", async () => {
    answer({
      shards: [{ id: 0, status: "ready", ping: 30, guilds: 2, memoryMb: 70, uptimeSec: 100 }],
      guildCount: 2,
      uptimeSec: 100,
      memoryMb: 60,
      version: "1.2.0",
      node: "v22.11.0",
      totalShards: 1,
    });
    const stats = await botStats(config);
    expect(stats).toMatchObject({ version: "1.2.0", node: "v22.11.0", totalShards: 1 });
    expect(stats.shards[0]).toMatchObject({ memoryMb: 70, uptimeSec: 100 });
  });

  it("still refuses an answer that is not stats", async () => {
    answer({ shards: "nope" });
    await expect(botStats(config)).rejects.toBeInstanceOf(BotUnavailable);
  });
});

describe("refusalFor", () => {
  const refusals = new Map<string, "not_member" | "no_manage_roles" | "above_user" | null>([
    ["1", null],
    ["2", "above_user"],
  ]);
  it("keeps a grantable role grantable", () => {
    expect(refusalFor(refusals, "1")).toBeNull();
  });
  it("passes the bot's reason through", () => {
    expect(refusalFor(refusals, "2")).toBe("above_user");
  });
  it("refuses a role the bot did not answer for", () => {
    expect(refusalFor(refusals, "3")).toBe("not_member");
  });
});
