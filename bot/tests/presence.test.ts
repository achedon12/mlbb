import { ActivityType, type Client } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { presenceAt, presenceLines, PresenceRotator, SERVER_COUNT_SHOWN_FROM } from "../src/discord/presence.js";

describe("presence", () => {
  it("rotates between where to start and the daily game, then adds the server count once it is worth showing", () => {
    expect(presenceLines(null).map((a) => a.name)).toEqual(["/help · mlbbdex.com", "/mlbbdle daily"]);
    expect(presenceLines(SERVER_COUNT_SHOWN_FROM - 1)).toHaveLength(2);
    expect(presenceLines(1234).at(-1)).toEqual({ type: ActivityType.Watching, name: "1,234 servers · /help" });
    expect(presenceAt(0, 1234).name).toBe("/help · mlbbdex.com");
    expect(presenceAt(1, 1234).type).toBe(ActivityType.Playing);
    expect(presenceAt(5, 1234).name).toBe("1,234 servers · /help");
  });

  it("is set at start, at every turn, and again on demand after a reconnect", async () => {
    vi.useFakeTimers();
    const setPresence = vi.fn();
    const client = { user: { setPresence } } as unknown as Client;
    const rotator = new PresenceRotator(client, async () => 40);
    rotator.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(setPresence).toHaveBeenLastCalledWith({ activities: [{ type: ActivityType.Watching, name: "/help · mlbbdex.com" }], status: "online" });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(setPresence).toHaveBeenLastCalledWith({ activities: [{ type: ActivityType.Playing, name: "/mlbbdle daily" }], status: "online" });
    await rotator.refresh();
    expect(setPresence).toHaveBeenCalledTimes(3);
    rotator.stop();
    vi.useRealTimers();
  });

  it("does nothing before the client is logged in", async () => {
    const rotator = new PresenceRotator({ user: null } as unknown as Client, async () => null);
    await expect(rotator.refresh()).resolves.toBeUndefined();
  });
});
