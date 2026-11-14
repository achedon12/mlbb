import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createInternalServer, MAX_BODY_BYTES, type InternalApi } from "../src/http/server.js";
import { signedHeaders } from "../src/security/signing.js";

const SECRET = "s".repeat(64);
const USER = "123456789012345678";
const GUILD = "223456789012345678";

const api: InternalApi = {
  ready: () => true,
  manageableGuilds: vi.fn(async () => [{ id: GUILD, name: "Guild", icon: null }]),
  isManageable: vi.fn(async () => true),
  channels: vi.fn(async (id: string) => (id === GUILD ? { channels: [], roles: [] } : null)),
  flush: vi.fn(async () => undefined),
  testPost: vi.fn(async () => ({ ok: true })),
  stats: vi.fn(async () => ({ guildCount: 1 })),
};

let base = "";
const server = createInternalServer({ secret: SECRET, api });

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function call(method: "GET" | "POST", path: string, body = "", headers?: Record<string, string>) {
  return fetch(`${base}${path}`, {
    method,
    headers: { ...(headers ?? signedHeaders(SECRET, method, path, body)), ...(body ? { "content-type": "application/json" } : {}) },
    ...(method === "POST" ? { body } : {}),
  });
}

describe("internal HTTP server", () => {
  it("answers /health without a signature, and nothing else", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect((await fetch(`${base}/internal/stats`)).status).toBe(401);
  });

  it("serves the signed routes with their contract shapes", async () => {
    expect(await (await call("GET", `/internal/guilds/manageable?user=${USER}`)).json()).toEqual({
      guilds: [{ id: GUILD, name: "Guild", icon: null }],
    });
    expect(await (await call("GET", `/internal/guilds/${GUILD}/manageable?user=${USER}`)).json()).toEqual({ manageable: true });
    expect(await (await call("GET", `/internal/guilds/${GUILD}/channels`)).json()).toEqual({ channels: [], roles: [] });
    expect((await call("GET", `/internal/guilds/323456789012345678/channels`)).status).toBe(404);
    expect((await call("POST", "/internal/announcements/flush", "{}")).status).toBe(202);
    expect(api.flush).toHaveBeenCalled();
    const body = JSON.stringify({ guildId: GUILD, channelId: USER, locale: "fr" });
    expect(await (await call("POST", "/internal/test-post", body)).json()).toEqual({ ok: true });
    expect(api.testPost).toHaveBeenCalledWith(GUILD, USER, "fr", undefined);
    expect((await call("GET", "/internal/stats")).status).toBe(200);
  });

  it("passes a welcome or goodbye test on, with the text being edited", async () => {
    const greeting = {
      kind: "welcome",
      message: "Hi {user}",
      member: { id: USER, username: "layla", avatar: "a_0123456789abcdef0123456789abcdef" },
      guildName: "Land of Dawn",
      memberCount: 42,
    };
    const body = JSON.stringify({ guildId: GUILD, channelId: USER, locale: "it", ...greeting });
    expect(await (await call("POST", "/internal/test-post", body)).json()).toEqual({ ok: true });
    expect(api.testPost).toHaveBeenLastCalledWith(GUILD, USER, "it", greeting);

    const bad = [
      { ...greeting, kind: "raid" },
      { ...greeting, message: "x".repeat(501) },
      { ...greeting, member: { ...greeting.member, avatar: "../../evil" } },
      { ...greeting, member: undefined },
      { ...greeting, extra: true },
    ];
    for (const b of bad) {
      expect((await call("POST", "/internal/test-post", JSON.stringify({ guildId: GUILD, channelId: USER, ...b }))).status).toBe(400);
    }
  });

  it("validates parameters and bodies", async () => {
    expect((await call("GET", "/internal/guilds/manageable?user=abc")).status).toBe(400);
    expect((await call("GET", "/internal/guilds/manageable")).status).toBe(400);
    expect((await call("POST", "/internal/test-post", '{"guildId":"x"}')).status).toBe(400);
    expect((await call("POST", "/internal/test-post", "not json")).status).toBe(400);
    expect((await call("GET", "/internal/nope")).status).toBe(404);
  });

  it("refuses a tampered, stale or replayed request", async () => {
    const path = `/internal/guilds/${GUILD}/manageable?user=${USER}`;
    const forged = signedHeaders(SECRET, "GET", `/internal/guilds/${GUILD}/manageable?user=323456789012345678`, "");
    expect((await call("GET", path, "", forged)).status).toBe(401);
    const stale = signedHeaders(SECRET, "GET", path, "", Date.now() - 301_000);
    expect((await call("GET", path, "", stale)).status).toBe(401);
    const wrongKey = signedHeaders("x".repeat(64), "GET", path, "");
    expect((await call("GET", path, "", wrongKey)).status).toBe(401);

    const body = JSON.stringify({ guildId: GUILD, channelId: USER });
    const headers = signedHeaders(SECRET, "POST", "/internal/test-post", body);
    expect((await call("POST", "/internal/test-post", body, headers)).status).toBe(200);
    expect((await call("POST", "/internal/test-post", body, headers)).status).toBe(401);
  });

  it("refuses bodies over 64 KB", async () => {
    const big = JSON.stringify({ pad: "x".repeat(MAX_BODY_BYTES) });
    expect((await call("POST", "/internal/test-post", big)).status).toBe(413);
  });

  it("rate limits a flood from one address", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 130; i++) statuses.push((await fetch(`${base}/internal/stats`)).status);
    expect(statuses).toContain(429);
  });
});

describe("without a secret", () => {
  it("keeps the internal routes closed", async () => {
    const closed = createInternalServer({ secret: undefined, api });
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(closed.address() as AddressInfo).port}`;
    expect((await fetch(`${url}/internal/stats`)).status).toBe(503);
    expect((await fetch(`${url}/health`)).status).toBe(200);
    await new Promise<void>((resolve) => closed.close(() => resolve()));
  });

  it("treats a secret too short to resist guessing as no secret", async () => {
    const short = "k".repeat(31);
    const closed = createInternalServer({ secret: short, api });
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(closed.address() as AddressInfo).port}`;
    const response = await fetch(`${url}/internal/stats`, { headers: signedHeaders(short, "GET", "/internal/stats", "") });
    expect(response.status).toBe(503);
    await new Promise<void>((resolve) => closed.close(() => resolve()));
  });
});
