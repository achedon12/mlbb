import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The gates in front of the bot routes, exercised as requests: the internal
 * API's signature gate, and the dashboard's settings write (origin, session,
 * live permission check, ids checked against the server in the path).
 */

const SECRET = "a".repeat(64);
const SESSION_SECRET = "b".repeat(64);
const GUILD = "111111111111111111";
const OTHER_GUILD = "999999999999999999";
const USER = "222222222222222222";
const CHANNEL = "333333333333333333";
const FOREIGN_CHANNEL = "444444444444444444";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://x:y@localhost:5432/z",
  BOT_API_SECRET: SECRET,
  BOT_SESSION_SECRET: SESSION_SECRET,
  BOT_INTERNAL_URL: "http://bot:3100",
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "c".repeat(32),
});

const client = vi.hoisted(() => ({
  canManage: vi.fn(async (_c: unknown, guild: string, user: string) => guild === "111111111111111111" && user === "222222222222222222"),
  guildChannels: vi.fn(async (_c: unknown, guild: string) => ({
    channels: guild === "111111111111111111" ? [{ id: "333333333333333333", name: "news", type: "text" }] : [],
    roles: [],
  })),
}));
vi.mock("@/lib/bot/client", async (original) => ({ ...(await original<object>()), ...client }));

const jar = vi.hoisted(() => ({ session: undefined as string | undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (jar.session ? { value: jar.session } : undefined) }) }));

const store = vi.hoisted(() => ({
  writes: [] as unknown[],
  guild: { findUnique: vi.fn(async () => ({ id: "111111111111111111", leftAt: null })), update: vi.fn((a: unknown) => a) },
  guildSettings: { upsert: vi.fn((a: unknown) => a) },
}));
vi.mock("@/lib/db", () => ({
  databaseConfigured: () => true,
  db: () => ({
    guild: store.guild,
    guildSettings: store.guildSettings,
    $transaction: async (ops: { create?: unknown; update?: unknown }[]) => {
      store.writes.push(...ops);
      return [{}, { guildId: GUILD, dailyHourUtc: 12 }];
    },
  }),
}));

const { readSigned, MAX_INTERNAL_BODY } = await import("@/lib/bot/internal");
const { readBotConfig } = await import("@/lib/bot/config");
const { signedHeaders } = await import("@/lib/bot/signature");
const { sealSession } = await import("@/lib/bot/session");
const { PUT } = await import("@/app/api/discord/guilds/[id]/settings/route");
const { z } = await import("zod");

const config = readBotConfig(process.env);
if (typeof config === "string") throw new Error("test configuration invalid");

const BASE = "http://mlbb:3001";

function signed(method: string, path: string, body = "", headers: Record<string, string> = {}) {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { ...signedHeaders(SECRET, method, path, body), ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: method === "GET" ? undefined : body,
  });
}

describe("internal API gate", () => {
  const schema = z.object({ n: z.number() });

  it("lets a signed request through, parsed", async () => {
    const gate = await readSigned(signed("POST", "/api/bot/x", '{"n":1}'), schema, MAX_INTERNAL_BODY, config);
    expect(gate instanceof Response ? gate.status : gate.body).toEqual({ n: 1 });
  });

  it("answers one identical 401 for a forged, moved, stale or replayed request", async () => {
    const forged = signed("POST", "/api/bot/x", '{"n":1}');
    const moved = new Request(`${BASE}/api/bot/y`, { method: "POST", headers: forged.headers, body: '{"n":1}' });
    const old = new Request(`${BASE}/api/bot/x`, {
      method: "POST",
      headers: signedHeaders(SECRET, "POST", "/api/bot/x", '{"n":2}', Date.now() - 600_000),
      body: '{"n":2}',
    });
    const tampered = new Request(`${BASE}/api/bot/x`, { method: "POST", headers: forged.headers, body: '{"n":9}' });
    const unsigned = new Request(`${BASE}/api/bot/x`, { method: "POST", body: '{"n":1}' });
    const once = signed("POST", "/api/bot/x", '{"n":3}');
    const again = new Request(once.url, { method: "POST", headers: once.headers, body: '{"n":3}' });
    expect(await readSigned(once, schema, MAX_INTERNAL_BODY, config)).not.toBeInstanceOf(Response);

    for (const request of [moved, old, tampered, unsigned, again]) {
      const gate = await readSigned(request, schema, MAX_INTERNAL_BODY, config);
      expect(gate).toBeInstanceOf(Response);
      const response = gate as Response;
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("refuses an oversized body before verifying or parsing it", async () => {
    const big = JSON.stringify({ n: 1, pad: "x".repeat(2_000) });
    const gate = await readSigned(signed("POST", "/api/bot/x", big), schema, 1_000, config);
    expect((gate as Response).status).toBe(413);
  });

  it("does not exist without the bot's configuration", async () => {
    const gate = await readSigned(signed("GET", "/api/bot/x"), null, MAX_INTERNAL_BODY, null);
    expect((gate as Response).status).toBe(404);
  });
});

describe("dashboard settings write", () => {
  const form = (o: { channel?: string | null } = {}) => ({
    locale: "fr",
    announcements: Object.fromEntries(
      ["patches", "skins", "events", "advanceServer", "esports"].map((t) => [t, { channelId: t === "patches" ? (o.channel ?? null) : null, roleId: null }]),
    ),
    dailyMlbbdleChannelId: null,
    dailyQuizChannelId: null,
    dailyHourUtc: 12,
  });
  const put = (guild: string, body: unknown, headers: Record<string, string> = {}) =>
    PUT(
      new Request(`${BASE}/api/discord/guilds/${guild}/settings`, {
        method: "PUT",
        headers: { origin: "https://mlbbdex.com", "content-type": "application/json", "x-forwarded-for": "198.51.100.1", ...headers },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: guild }) },
    );

  beforeEach(() => {
    jar.session = sealSession(config, { id: USER, name: "Leo", avatar: null });
    store.writes = [];
    client.canManage.mockClear();
  });

  it("saves for a manager of the server in the path, with its own channels", async () => {
    const response = await put(GUILD, form({ channel: CHANNEL }));
    expect(response.status).toBe(200);
    expect(client.canManage).toHaveBeenCalledWith(expect.anything(), GUILD, USER);
    expect(store.writes).toHaveLength(2);
  });

  it("refuses a server the user does not manage, without writing", async () => {
    const response = await put(OTHER_GUILD, form());
    expect(response.status).toBe(403);
    expect(store.writes).toHaveLength(0);
  });

  it("refuses a channel of another server", async () => {
    expect((await put(GUILD, form({ channel: FOREIGN_CHANNEL }))).status).toBe(400);
    expect(store.writes).toHaveLength(0);
  });

  it("refuses a malformed server id before asking the bot", async () => {
    expect((await put("../admin", form())).status).toBe(400);
    expect(client.canManage).not.toHaveBeenCalled();
  });

  it("refuses a cross-origin request or a missing session", async () => {
    expect((await put(GUILD, form(), { origin: "https://evil.example" })).status).toBe(403);
    expect((await put(GUILD, form(), { "sec-fetch-site": "cross-site" })).status).toBe(403);
    jar.session = undefined;
    expect((await put(GUILD, form())).status).toBe(401);
    expect(store.writes).toHaveLength(0);
  });

  it("refuses a body over the cap and extra fields", async () => {
    expect((await put(GUILD, { ...form(), pad: "x".repeat(20_000) })).status).toBe(413);
    expect((await put(GUILD, { ...form(), guildId: OTHER_GUILD })).status).toBe(400);
  });
});

describe("dashboard page views", () => {
  // Each view asks the bot, and listing a user's servers costs the bot one
  // Discord member lookup per server it is in: one signed-in account
  // refreshing in a loop must not be able to keep the bot busy for everyone.
  it("are capped per account and per address", async () => {
    const { dashboardReadAllowed, DASHBOARD_READS_PER_USER, DASHBOARD_READS_PER_ADDRESS } = await import("@/lib/bot/dashboard-guard");
    for (let i = 0; i < DASHBOARD_READS_PER_USER; i += 1) expect(dashboardReadAllowed(USER, "203.0.113.7")).toBe(true);
    expect(dashboardReadAllowed(USER, "203.0.113.7")).toBe(false);
    // Another account is not held back by the first one's views...
    expect(dashboardReadAllowed("555555555555555555", "198.51.100.1")).toBe(true);
    // ...but many accounts from one address share its ceiling.
    let allowed = 0;
    for (let i = 0; i < 2 * DASHBOARD_READS_PER_ADDRESS; i += 1) {
      if (dashboardReadAllowed(`6${String(i).padStart(17, "0")}`, "192.0.2.9")) allowed += 1;
    }
    expect(allowed).toBe(DASHBOARD_READS_PER_ADDRESS);
  });
});
