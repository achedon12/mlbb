import { describe, expect, it, vi } from "vitest";
import { ListingPoster, listingTargets, postListings } from "../src/managers/listing.js";

const BOT = "123456789012345678";
const counts = { guilds: 1234, shards: 2 };

function fakeFetch(status = 200) {
  return vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status }));
}

describe("bot list stats", () => {
  it("posts nothing without tokens", async () => {
    const fetch = fakeFetch();
    expect(await postListings(BOT, {}, counts, fetch)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(new ListingPoster(BOT, {}, async () => counts, fetch).enabled).toBe(false);
  });

  it("posts each list's own body to its own endpoint, token in the header only", async () => {
    const fetch = fakeFetch();
    const ok = await postListings(BOT, { topgg: "tg-token", dbl: "dbl-token", dbotsgg: "dbgg-token" }, counts, fetch);
    expect(ok.sort()).toEqual(["discord.bots.gg", "discordbotlist.com", "top.gg"]);
    const calls = Object.fromEntries(fetch.mock.calls.map(([url, init]) => [url, init!]));

    const topgg = calls[`https://top.gg/api/bots/${BOT}/stats`]!;
    expect(JSON.parse(String(topgg.body))).toEqual({ server_count: 1234, shard_count: 2 });
    expect((topgg.headers as Record<string, string>).Authorization).toBe("tg-token");

    expect(JSON.parse(String(calls[`https://discordbotlist.com/api/v1/bots/${BOT}/stats`]!.body))).toEqual({ guilds: 1234 });
    expect(JSON.parse(String(calls[`https://discord.bots.gg/api/v1/bots/${BOT}/stats`]!.body))).toEqual({ guildCount: 1234, shardCount: 2 });
    for (const init of Object.values(calls)) expect(String(init.body)).not.toContain("token");
  });

  it("posts only to the lists that have a token", () => {
    expect(listingTargets(BOT, { dbl: "x" }, counts).map((t) => t.name)).toEqual(["discordbotlist.com"]);
  });

  it("a refusing or unreachable list does not stop the others", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("top.gg")) throw new Error("ECONNRESET");
      if (url.includes("bots.gg")) return new Response("", { status: 401 });
      return new Response("{}", { status: 200 });
    });
    expect(await postListings(BOT, { topgg: "a", dbl: "b", dbotsgg: "c" }, counts, fetch)).toEqual(["discordbotlist.com"]);
  });
});
