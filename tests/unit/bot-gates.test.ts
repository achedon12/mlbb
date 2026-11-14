import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The gates in front of the bot routes, exercised as requests: the internal
 * API's signature gate, and the dashboard's settings write and test post
 * (origin, session, live permission check, ids checked against the server
 * in the path).
 */

const SECRET = "a".repeat(64);
const SESSION_SECRET = "b".repeat(64);
const GUILD = "111111111111111111";
const OTHER_GUILD = "999999999999999999";
const USER = "222222222222222222";
/** Another manager of GUILD (Manage Server), with or without Manage Roles per test. */
const CO_MANAGER = "222222222222222223";
const CHANNEL = "333333333333333333";
const FOREIGN_CHANNEL = "444444444444444444";
/** Roles of GUILD as the bot reports them: one it may give, and three it refuses. */
const MEMBER_ROLE = "555555555555555551";
const MOD_ROLE = "555555555555555552";
const HIGH_ROLE = "555555555555555553";
const BOOSTER_ROLE = "555555555555555554";
/** A role of OTHER_GUILD, assignable there. */
const FOREIGN_ROLE = "555555555555555559";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://x:y@localhost:5432/z",
  BOT_API_SECRET: SECRET,
  BOT_SESSION_SECRET: SESSION_SECRET,
  BOT_INTERNAL_URL: "http://bot:3100",
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "c".repeat(32),
  BOT_SUPER_ADMIN_IDS: "555555555555555555",
});
const ADMIN = "555555555555555555";

const backup = vi.hoisted(() => ({
  runBackup: vi.fn(async (): Promise<{ ok: true; file: unknown; removed: string[] } | { ok: false; error: string }> => ({
    ok: true,
    file: { name: "mlbbdex-20261114-033000.dump", size: 10, createdAt: "2026-11-14T03:30:00.000Z" },
    removed: [],
  })),
}));
vi.mock("@/lib/db-backup", async (original) => ({ ...(await original<object>()), ...backup }));

const client = vi.hoisted(() => ({
  // Two managers of GUILD: USER and CO_MANAGER.
  canManage: vi.fn(
    async (_c: unknown, guild: string, user: string) =>
      guild === "111111111111111111" && (user === "222222222222222222" || user === "222222222222222223"),
  ),
  /** Roles each manager may give themselves, as the bot would report them. */
  grants: new Map<string, string[]>([["222222222222222222", ["555555555555555551"]]]),
  grantableRoles: vi.fn(async (_c: unknown, _guild: string, user: string) => {
    const ids = client.grants.get(user) ?? [];
    return { refusals: new Map(ids.map((id) => [id, null])), grantable: new Set(ids) };
  }),
  guildChannels: vi.fn(async (_c: unknown, guild: string) =>
    guild === "111111111111111111"
      ? {
          channels: [{ id: "333333333333333333", name: "news", type: "text" }],
          roles: [
            { id: "555555555555555551", name: "Player", assignable: true, refusal: null },
            { id: "555555555555555552", name: "Mod", assignable: false, refusal: "dangerous" },
            { id: "555555555555555553", name: "Staff", assignable: false, refusal: "above_bot" },
            { id: "555555555555555554", name: "Booster", assignable: false, refusal: "managed" },
          ],
          manageRoles: true,
        }
      : { channels: [], roles: [{ id: "555555555555555559", name: "Player", assignable: true, refusal: null }], manageRoles: true },
  ),
  testPost: vi.fn(async () => ({ ok: true })),
  refreshGuildQuietly: vi.fn(async () => undefined),
}));
vi.mock("@/lib/bot/client", async (original) => ({ ...(await original<object>()), ...client }));

const jar = vi.hoisted(() => ({ session: undefined as string | undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (jar.session ? { value: jar.session } : undefined) }) }));

const store = vi.hoisted(() => ({
  writes: [] as unknown[],
  /** The server's stored settings row (null: never saved). */
  settings: null as Record<string, unknown> | null,
  guild: {
    findUnique: vi.fn(async () => ({
      id: "111111111111111111",
      name: "Land of Dawn",
      memberCount: 42,
      leftAt: null,
      locale: "fr",
      settings: store.settings,
    })),
    update: vi.fn((a: unknown) => a),
  },
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
const testRoute = await import("@/app/api/discord/guilds/[id]/test/route");
const backupRoute = await import("@/app/api/discord/admin/backup/route");
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
  const form = (
    o: { channel?: string | null; welcome?: string | null; mention?: string | null; roles?: string[]; botRoles?: string[] } = {},
  ) => ({
    locale: "fr",
    announcements: Object.fromEntries(
      ["patches", "skins", "events", "advanceServer", "esports"].map((t) => [
        t,
        { channelId: t === "patches" ? (o.channel ?? null) : null, roleId: t === "patches" ? (o.mention ?? null) : null },
      ]),
    ),
    dailyMlbbdleChannelId: null,
    dailyQuizChannelId: null,
    dailyHourUtc: 12,
    welcome: { channelId: o.welcome ?? null, message: "Hi {user}" },
    goodbye: { channelId: null, message: null },
    autoRoles: { roleIds: o.roles ?? [], botRoleIds: o.botRoles ?? [] },
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
    store.settings = null;
    client.canManage.mockClear();
    client.grantableRoles.mockClear();
  });

  it("saves for a manager of the server in the path, with its own channels", async () => {
    const response = await put(GUILD, form({ channel: CHANNEL }));
    expect(response.status).toBe(200);
    expect(client.canManage).toHaveBeenCalledWith(expect.anything(), GUILD, USER);
    expect(store.writes).toHaveLength(2);
    // The bot is told to read the server's settings again at once.
    expect(client.refreshGuildQuietly).toHaveBeenCalledWith(expect.anything(), GUILD);
  });

  it("refuses a server the user does not manage, without writing", async () => {
    const response = await put(OTHER_GUILD, form());
    expect(response.status).toBe(403);
    expect(store.writes).toHaveLength(0);
  });

  it("refuses a channel of another server", async () => {
    expect((await put(GUILD, form({ channel: FOREIGN_CHANNEL }))).status).toBe(400);
    expect((await put(GUILD, form({ welcome: FOREIGN_CHANNEL }))).status).toBe(400);
    expect(store.writes).toHaveLength(0);
  });

  it("saves auto-roles the bot reported as assignable in that server", async () => {
    const response = await put(GUILD, form({ roles: [MEMBER_ROLE], botRoles: [MEMBER_ROLE] }));
    expect(response.status).toBe(200);
    const upsert = store.writes[1] as { create: Record<string, unknown> };
    expect(upsert.create).toMatchObject({
      autoRoleIds: [MEMBER_ROLE],
      botAutoRoleIds: [MEMBER_ROLE],
      autoRoleFailing: false,
      autoRolesConfiguredBy: USER,
    });
    expect(client.grantableRoles).toHaveBeenCalledWith(expect.anything(), GUILD, USER);
  });

  describe("confused deputy: a manager cannot have the bot give a role they could not", () => {
    // Its own address: the save limit (30 a minute per address) is not the subject here.
    const putHere = (body: unknown) => put(GUILD, body, { "x-forwarded-for": "198.51.100.2" });
    const asCoManager = () => (jar.session = sealSession(config, { id: CO_MANAGER, name: "Alt", avatar: null }));
    const saved = (extra: Record<string, unknown> = {}) => ({
      guildId: GUILD,
      dailyHourUtc: 12,
      autoRoleIds: [MEMBER_ROLE],
      botAutoRoleIds: [],
      autoRoleFailing: false,
      autoRoleFailReason: null,
      autoRolesConfiguredBy: USER,
      ...extra,
    });
    const refusedNotGrantable = async (response: Response) => {
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "auto-roles not grantable" });
    };

    it("refuses a manager without Manage Roles (Manage Server alone)", async () => {
      asCoManager();
      client.grants.set(CO_MANAGER, []);
      await refusedNotGrantable(await putHere(form({ roles: [MEMBER_ROLE] })));
      await refusedNotGrantable(await putHere(form({ botRoles: [MEMBER_ROLE] })));
      expect(store.writes).toHaveLength(0);
    });

    it("refuses a role above the manager's own, even with Manage Roles", async () => {
      // The bot reports the role as one this manager may not give (above_user).
      asCoManager();
      client.grants.set(CO_MANAGER, ["555555555555555550"]);
      await refusedNotGrantable(await putHere(form({ roles: [MEMBER_ROLE] })));
      expect(store.writes).toHaveLength(0);
    });

    it("accepts the owner (any role below the bot)", async () => {
      asCoManager();
      client.grants.set(CO_MANAGER, [MEMBER_ROLE]);
      expect((await putHere(form({ roles: [MEMBER_ROLE] }))).status).toBe(200);
      expect((store.writes[1] as { create: Record<string, unknown> }).create).toMatchObject({ autoRolesConfiguredBy: CO_MANAGER });
    });

    it("lets another manager save unrelated settings without asking about the roles", async () => {
      store.settings = saved();
      asCoManager();
      client.grants.set(CO_MANAGER, []);
      expect((await putHere(form({ channel: CHANNEL, roles: [MEMBER_ROLE] }))).status).toBe(200);
      expect(client.grantableRoles).not.toHaveBeenCalled();
      // The roles stay the first manager's.
      expect((store.writes[1] as { update: Record<string, unknown> }).update).toMatchObject({ autoRolesConfiguredBy: USER, autoRoleFailing: false });
    });

    it("keeps failing auto-roles failing when a manager who cannot give them saves", async () => {
      store.settings = saved({ autoRoleFailing: true, autoRoleFailReason: "granter" });
      asCoManager();
      client.grants.set(CO_MANAGER, []);
      expect((await putHere(form({ roles: [MEMBER_ROLE] }))).status).toBe(200);
      expect((store.writes[1] as { update: Record<string, unknown> }).update).toMatchObject({
        autoRolesConfiguredBy: USER,
        autoRoleFailing: true,
        autoRoleFailReason: "granter",
      });
    });

    it("lets a manager who can give them take failing auto-roles over", async () => {
      store.settings = saved({ autoRoleFailing: true, autoRoleFailReason: "granter" });
      asCoManager();
      client.grants.set(CO_MANAGER, [MEMBER_ROLE]);
      expect((await putHere(form({ roles: [MEMBER_ROLE] }))).status).toBe(200);
      expect((store.writes[1] as { update: Record<string, unknown> }).update).toMatchObject({
        autoRolesConfiguredBy: CO_MANAGER,
        autoRoleFailing: false,
        autoRoleFailReason: null,
      });
    });

    it("checks the whole new list against the saver when it changes", async () => {
      store.settings = saved();
      asCoManager();
      client.grants.set(CO_MANAGER, []);
      await refusedNotGrantable(await putHere(form({ roles: [MEMBER_ROLE], botRoles: [MEMBER_ROLE] })));
      expect(store.writes).toHaveLength(0);
    });
  });

  it("refuses dangerous, higher, managed and foreign auto-roles server-side", async () => {
    for (const role of [MOD_ROLE, HIGH_ROLE, BOOSTER_ROLE, FOREIGN_ROLE, "666666666666666666"]) {
      expect((await put(GUILD, form({ roles: [role] }))).status).toBe(400);
      expect((await put(GUILD, form({ botRoles: [MEMBER_ROLE, role] }))).status).toBe(400);
    }
    // Four roles, a duplicate: refused by the schema.
    expect((await put(GUILD, form({ roles: [MEMBER_ROLE, MEMBER_ROLE] }))).status).toBe(400);
    expect(store.writes).toHaveLength(0);
  });

  it("takes the server from the path: another server's roles cannot be set through it", async () => {
    // The user manages GUILD only; naming OTHER_GUILD in the path is refused before anything.
    expect((await put(OTHER_GUILD, form({ roles: [FOREIGN_ROLE] }))).status).toBe(403);
    expect(store.writes).toHaveLength(0);
  });

  it("never offers a managed role as a mention", async () => {
    expect((await put(GUILD, form({ channel: CHANNEL, mention: BOOSTER_ROLE }))).status).toBe(400);
    expect((await put(GUILD, form({ channel: CHANNEL, mention: MOD_ROLE }))).status).toBe(200);
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

describe("dashboard greeting test", () => {
  const AVATAR = "0123456789abcdef0123456789abcdef";
  const post = (guild: string, body: unknown, headers: Record<string, string> = {}) =>
    testRoute.POST(
      new Request(`${BASE}/api/discord/guilds/${guild}/test`, {
        method: "POST",
        headers: { origin: "https://mlbbdex.com", "content-type": "application/json", "x-forwarded-for": "198.51.100.2", ...headers },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: guild }) },
    );

  beforeEach(() => {
    jar.session = sealSession(config, { id: USER, name: "Leo", avatar: AVATAR });
    client.testPost.mockClear();
    client.canManage.mockClear();
  });

  it("posts the text being edited, with the signed-in user and the server's own name", async () => {
    const response = await post(GUILD, { channelId: CHANNEL, locale: "es", kind: "welcome", message: "  Hola {user}  " });
    expect(response.status).toBe(200);
    expect(client.testPost).toHaveBeenCalledWith(expect.anything(), GUILD, CHANNEL, "es", {
      kind: "welcome",
      message: "Hola {user}",
      member: { id: USER, username: "Leo", avatar: AVATAR },
      guildName: "Land of Dawn",
      memberCount: 42,
    });
    // Without a kind, the announcement test as before.
    expect((await post(GUILD, { channelId: CHANNEL, locale: "fr" })).status).toBe(200);
    expect(client.testPost).toHaveBeenLastCalledWith(expect.anything(), GUILD, CHANNEL, "fr", undefined);
  });

  it("checks the user, the channel and the body like any other write", async () => {
    const ok = { channelId: CHANNEL, locale: "en", kind: "goodbye", message: null };
    expect((await post(OTHER_GUILD, ok)).status).toBe(403);
    expect((await post(GUILD, { ...ok, channelId: FOREIGN_CHANNEL })).status).toBe(400);
    expect((await post(GUILD, { ...ok, kind: "raid" })).status).toBe(400);
    expect((await post(GUILD, { ...ok, message: "x".repeat(501) })).status).toBe(400);
    expect((await post(GUILD, { ...ok, guildName: "@everyone" })).status).toBe(400);
    expect((await post(GUILD, ok, { origin: "https://evil.example" })).status).toBe(403);
    expect(client.testPost).not.toHaveBeenCalled();
  });
});

describe("admin backup now", () => {
  const post = (headers: Record<string, string> = {}) =>
    backupRoute.POST(
      new Request(`${BASE}/api/discord/admin/backup`, {
        method: "POST",
        headers: { origin: "https://mlbbdex.com", "content-type": "application/json", "x-forwarded-for": "198.51.100.3", ...headers },
        body: "{}",
      }),
    );

  beforeEach(() => backup.runBackup.mockClear());

  it("backs up for a super admin, from the site's own pages only", async () => {
    jar.session = sealSession(config, { id: ADMIN, name: "Admin", avatar: null });
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, file: { name: "mlbbdex-20261114-033000.dump" } });
    expect(backup.runBackup).toHaveBeenCalledWith({ trigger: "admin" });
    expect((await post({ origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ "sec-fetch-site": "same-site" })).status).toBe(403);
    expect(backup.runBackup).toHaveBeenCalledTimes(1);
  });

  it("answers 409 while one runs, 500 when it fails", async () => {
    jar.session = sealSession(config, { id: ADMIN, name: "Admin", avatar: null });
    backup.runBackup.mockResolvedValueOnce({ ok: false, error: "already_running" });
    expect((await post()).status).toBe(409);
    backup.runBackup.mockResolvedValueOnce({ ok: false, error: "pg_dump exited with 1: secret detail" });
    const failed = await post();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "backup failed" });
  });

  it("is a missing page for anyone else, signed out included", async () => {
    jar.session = sealSession(config, { id: USER, name: "Leo", avatar: null });
    expect((await post()).status).toBe(404);
    jar.session = undefined;
    expect((await post()).status).toBe(401);
    expect(backup.runBackup).not.toHaveBeenCalled();
  });
});
