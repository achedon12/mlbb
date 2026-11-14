import { describe, expect, it } from "vitest";
import { statsAnswer } from "../src/managers/stats.js";
import { BOT_VERSION } from "../src/version.js";

const MB = 1024 * 1024;
const shard = (id: number, guilds: number) => ({ id, status: 0, ping: 40, guilds, memoryMb: 100, uptimeSec: 60 });

describe("stats answer", () => {
  it("sums the shards, and counts their memory with the manager's", () => {
    const answer = statsAnswer({
      shardIds: [0, 1],
      answers: [
        { status: "fulfilled", value: shard(0, 3) },
        { status: "fulfilled", value: shard(1, 4) },
      ],
      startedAt: 0,
      now: 125_400,
      managerRssBytes: 50 * MB,
      version: "1.0.0",
      node: "v22.0.0",
    });
    expect(answer).toMatchObject({ guildCount: 7, uptimeSec: 125, memoryMb: 250, totalShards: 2, version: "1.0.0" });
    // The site reads `status` as discord.js's Status number.
    expect(answer.shards[0]!.status).toBe(0);
  });

  it("lists a shard that did not answer instead of failing the whole answer", () => {
    const answer = statsAnswer({
      shardIds: [0, 1, 2],
      answers: [
        { status: "fulfilled", value: shard(0, 3) },
        { status: "rejected", reason: new Error("Shard 1's process exited") },
        { status: "fulfilled", value: null },
      ],
      startedAt: 0,
      now: 1000,
      managerRssBytes: 10 * MB,
      version: "1.0.0",
      node: "v22.0.0",
    });
    expect(answer.shards.map((s) => s.status)).toEqual([0, "unavailable", "unavailable"]);
    expect(answer.guildCount).toBe(3);
    expect(answer.memoryMb).toBe(110);
  });

  it("reads its version from package.json", () => {
    expect(BOT_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
