import { describe, expect, it, vi } from "vitest";
import { COMMANDS } from "../src/commands/index.js";
import { dblAuthorization, ListingPoster, listingTargets, postCommandsToDbl, postListings } from "../src/managers/listing.js";

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

  it("sends the registered command list to discordbotlist.com, token in the header only", async () => {
    const fetch = fakeFetch();
    const commands = COMMANDS.map((c) => c.data());
    expect(await postCommandsToDbl(BOT, "dbl-token", commands, fetch)).toBe(true);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`https://discordbotlist.com/api/v1/bots/${BOT}/commands`);
    expect(init!.method).toBe("POST");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bot dbl-token");
    const body = JSON.parse(String(init!.body)) as { name: string }[];
    expect(body.map((c) => c.name)).toEqual(commands.map((c) => c.name));
    expect(String(init!.body)).not.toContain("dbl-token");
    expect(dblAuthorization("Bot abc")).toBe("Bot abc");
  });

  it("a refused or unreachable command post is reported, never thrown", async () => {
    expect(await postCommandsToDbl(BOT, "t", [], fakeFetch(401))).toBe(false);
    const down = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    await expect(postCommandsToDbl(BOT, "t", [], down)).resolves.toBe(false);
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
