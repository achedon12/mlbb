import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The routes of the Discord profile card, exercised as requests: the bot's
 * signed route (signature, who may see whose card, the PNG), and the account
 * page's route (both logins to link, the game login for the rest).
 */

const SECRET = "a".repeat(64);
const SESSION_SECRET = "b".repeat(64);
const OWNER = "222222222222222222";
const FRIEND = "333333333333333333";
const STRANGER = "444444444444444444";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://x:y@localhost:5432/z",
  BOT_API_SECRET: SECRET,
  BOT_SESSION_SECRET: SESSION_SECRET,
  BOT_INTERNAL_URL: "http://bot:3100",
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "c".repeat(32),
});

/** The `ProfileCard` table, in memory. */
type Row = { discordKey: string; accountId: string; public: boolean; showId: boolean; snapshot: unknown; snapshotAt: Date; linkedAt: Date };
const table = vi.hoisted(() => ({ rows: [] as Row[] }));
const match = (row: Row, where: Record<string, unknown>): boolean =>
  Object.entries(where).every(([k, v]) =>
    k === "OR" ? (v as Record<string, unknown>[]).some((w) => match(row, w)) : k === "snapshotAt" ? row.snapshotAt < (v as { lt: Date }).lt : row[k as keyof Row] === v,
  );
const profileCard = {
  findUnique: async ({ where }: { where: Record<string, unknown> }) => table.rows.find((r) => match(r, where)) ?? null,
  update: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => Object.assign(table.rows.find((r) => match(r, where))!, data),
  updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
    const hit = table.rows.filter((r) => match(r, where));
    for (const r of hit) Object.assign(r, data);
    return { count: hit.length };
  },
  deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
    const before = table.rows.length;
    table.rows = table.rows.filter((r) => !match(r, where));
    return { count: before - table.rows.length };
  },
  create: async ({ data }: { data: Omit<Row, "public" | "showId"> & Partial<Row> }) => table.rows.push({ public: false, showId: true, ...data }),
};
vi.mock("@/lib/db", () => ({
  databaseConfigured: () => true,
  db: () => ({ profileCard, $transaction: async (task: (tx: unknown) => Promise<unknown>) => task({ profileCard }) }),
}));

/** Drawing is tested on its own (discord-profile.test.ts): here, a stand-in PNG. */
const PNG = Buffer.from("89504e470d0a1a0a", "hex");
vi.mock("@/lib/discord-profile/render-cache", () => ({ cardPng: vi.fn(async () => PNG), forgetCard: vi.fn() }));

const jar = vi.hoisted(() => ({ game: undefined as string | undefined, discord: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = name === "mlbb_jeu" ? jar.game : name === "mlbbdex_discord" ? jar.discord : undefined;
      return value ? { value } : undefined;
    },
  }),
}));

/** The game login's answer; a new account each test, so the per-account rate limit starts afresh. */
const game = vi.hoisted(() => ({ status: "ok" as "ok" | "expired" | "unavailable", roleId: 100_000_000 }));
vi.mock("@/lib/mlbb-auth", async (original) => ({
  ...(await original<object>()),
  profile: vi.fn(async () =>
    game.status === "ok"
      ? { status: "ok", data: { roleId: game.roleId, zoneId: 6021, name: "Leo", level: 87, rankCurrent: 200, rankMax: 220, country: "PH", avatar: null } }
      : { status: game.status },
  ),
  seasons: vi.fn(async () => ({ status: "ok", data: [40] })),
  statistics: vi.fn(async () => ({ status: "unavailable" })),
  seasonHeroes: vi.fn(async () => ({ status: "ok", data: { heroes: [], full: true } })),
}));

const { signedHeaders } = await import("@/lib/bot/signature");
const { sealSession } = await import("@/lib/bot/session");
const { readBotConfig } = await import("@/lib/bot/config");
const { profileDiscordKey } = await import("@/lib/discord-profile/access");
const { accountId } = await import("@/lib/community-builds-server");
const { GET: botGET } = await import("@/app/api/bot/profile/route");
const accountRoute = await import("@/app/api/discord-profile/route");

const config = readBotConfig(process.env);
if (typeof config === "string") throw new Error("test configuration invalid");

const BASE = "http://mlbb:3001";
const account = () => accountId(game.roleId, 6021);

let address = 0;
function botRequest(user: string, viewer: string, locale = "en", secret = SECRET) {
  const path = `/api/bot/profile?user=${user}&viewer=${viewer}&locale=${locale}`;
  // A second apart each: the same request signed twice in one second is a replay.
  const at = Date.now() - ++address * 1000;
  return new Request(`${BASE}${path}`, { headers: { ...signedHeaders(secret, "GET", path, "", at), "x-forwarded-for": `198.51.100.${address % 250}` } });
}

const snapshot = {
  v: 1, name: "Leo", avatar: null, roleId: 123456789, zoneId: 6021, country: "PH", level: 87, rankLevel: 200, rankMaxLevel: 220,
  season: 40, matches: 10, wins: 6, full: true, mvp: null, heroes: [],
};

function linked(discordId: string, o: Partial<Row> = {}) {
  table.rows.push({ discordKey: profileDiscordKey(discordId), accountId: account(), public: false, showId: true, snapshot, snapshotAt: new Date(), linkedAt: new Date(), ...o });
}

beforeEach(() => {
  table.rows = [];
  jar.game = undefined;
  jar.discord = undefined;
  game.status = "ok";
  game.roleId++;
});

describe("the bot's profile card route", () => {
  it("refuses an unsigned or forged call, and invalid ids", async () => {
    const unsigned = new Request(`${BASE}/api/bot/profile?user=${OWNER}&viewer=${OWNER}&locale=en`);
    expect((await botGET(unsigned)).status).toBe(401);
    expect((await botGET(botRequest(OWNER, OWNER, "en", "z".repeat(64)))).status).toBe(401);
    // Signed, but for another path: the query is part of what is signed.
    const path = `/api/bot/profile?user=${OWNER}&viewer=${OWNER}&locale=en`;
    const moved = new Request(`${BASE}/api/bot/profile?user=${FRIEND}&viewer=${OWNER}&locale=en`, { headers: signedHeaders(SECRET, "GET", path, "") });
    expect((await botGET(moved)).status).toBe(401);
    expect((await botGET(botRequest("12", OWNER))).status).toBe(400);
    expect((await botGET(botRequest(OWNER, OWNER, "xx"))).status).toBe(400);
  });

  it("gives the owner their card once linked, as a PNG", async () => {
    expect(await (await botGET(botRequest(OWNER, OWNER))).json()).toEqual({ reason: "notLinked" });
    linked(OWNER);
    const response = await botGET(botRequest(OWNER, OWNER, "fr"));
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG);
  });

  it("gives someone else's card only when it is public, and says nothing more otherwise", async () => {
    expect(await (await botGET(botRequest(OWNER, FRIEND))).json()).toEqual({ reason: "unavailable" });
    linked(OWNER);
    expect(await (await botGET(botRequest(OWNER, FRIEND))).json()).toEqual({ reason: "unavailable" });
    table.rows[0]!.public = true;
    expect((await botGET(botRequest(OWNER, FRIEND))).headers.get("content-type")).toBe("image/png");
  });

  it("no longer shows figures older than 30 days", async () => {
    linked(OWNER, { public: true, snapshotAt: new Date(Date.now() - 31 * 86_400_000) });
    expect(await (await botGET(botRequest(OWNER, OWNER))).json()).toEqual({ reason: "stale" });
    expect(await (await botGET(botRequest(OWNER, FRIEND))).json()).toEqual({ reason: "unavailable" });
  });

  it("limits each member typing the command", async () => {
    linked(OWNER, { public: true });
    const answers = [];
    for (let i = 0; i < 5; i++) answers.push((await botGET(botRequest(OWNER, STRANGER))).headers.get("content-type"));
    expect(answers.slice(0, 4).every((t) => t === "image/png")).toBe(true);
    expect(answers[4]).toMatch(/json/);
  });
});

describe("the account page's card route", () => {
  const call = (method: "POST" | "PATCH" | "DELETE", body?: unknown, origin = "https://mlbbdex.com") =>
    accountRoute[method](
      new Request(`${BASE}/api/discord-profile`, {
        method,
        headers: { origin, "content-type": "application/json", "x-forwarded-for": `203.0.113.${++address % 250}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const signIn = { game: () => (jar.game = `header.e30.${game.roleId}`), discord: (id = OWNER) => (jar.discord = sealSession(config, { id, name: "Leo", avatar: null })) };

  it("links only with both logins on the request, from the site itself", async () => {
    signIn.game();
    expect((await call("POST", { action: "link" })).status).toBe(401);
    signIn.discord();
    expect((await call("POST", { action: "link" }, "https://evil.example")).status).toBe(403);
    expect((await call("POST", { action: "link" })).status).toBe(200);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toMatchObject({ discordKey: profileDiscordKey(OWNER), accountId: account(), public: false, showId: true });
    // Never the ids themselves.
    expect(JSON.stringify(table.rows[0]!.discordKey)).not.toContain(OWNER);
  });

  it("moves the card when the same game account links another Discord account", async () => {
    signIn.game();
    signIn.discord(OWNER);
    await call("POST", { action: "link" });
    signIn.discord(FRIEND);
    expect((await call("POST", { action: "link" })).status).toBe(200);
    expect(table.rows.map((r) => r.discordKey)).toEqual([profileDiscordKey(FRIEND)]);
  });

  it("refreshes, sets and deletes with the game login alone", async () => {
    signIn.game();
    expect((await call("POST", { action: "refresh" })).status).toBe(409);
    linked(OWNER, { snapshotAt: new Date(0) });
    expect((await call("POST", { action: "refresh" })).status).toBe(200);
    expect(table.rows[0]!.snapshotAt.getTime()).toBeGreaterThan(0);
    expect((await call("PATCH", { public: true })).status).toBe(200);
    expect(table.rows[0]!.public).toBe(true);
    expect((await call("PATCH", {})).status).toBe(400);
    expect((await call("DELETE")).status).toBe(200);
    expect(table.rows).toHaveLength(0);
  });

  it("answers the game service's states", async () => {
    signIn.game();
    signIn.discord();
    game.status = "unavailable";
    expect((await call("POST", { action: "link" })).status).toBe(503);
    expect((await call("POST", { action: "link" })).status).toBe(503);
    jar.game = undefined;
    expect((await call("DELETE")).status).toBe(401);
  });
});
