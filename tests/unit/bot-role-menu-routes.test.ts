import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The role menu routes, exercised as requests: the dashboard's create,
 * update, publish and delete (origin, session, live permission check,
 * channel, roles and emojis checked against the server in the path, the
 * confused-deputy guard) and the bot's signed read.
 */

const SECRET = "a".repeat(64);
const GUILD = "111111111111111111";
const OTHER_GUILD = "999999999999999999";
const USER = "222222222222222222";
/** Another manager of GUILD, without Manage Roles. */
const CO_MANAGER = "222222222222222223";
const CHANNEL = "333333333333333333";
const FOREIGN_CHANNEL = "444444444444444444";
const EPIC = "555555555555555551";
const LEGEND = "555555555555555552";
const MOD_ROLE = "555555555555555553";
const HIGH_ROLE = "555555555555555554";
const FOREIGN_ROLE = "555555555555555559";
const EMOJI = "666666666666666661";
const FOREIGN_EMOJI = "666666666666666669";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://x:y@localhost:5432/z",
  BOT_API_SECRET: SECRET,
  BOT_SESSION_SECRET: "b".repeat(64),
  BOT_INTERNAL_URL: "http://bot:3100",
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "c".repeat(32),
});

const client = vi.hoisted(() => ({
  canManage: vi.fn(
    async (_c: unknown, guild: string, user: string) =>
      guild === "111111111111111111" && (user === "222222222222222222" || user === "222222222222222223"),
  ),
  grants: new Map<string, string[]>([["222222222222222222", ["555555555555555551", "555555555555555552"]]]),
  grantableRoles: vi.fn(async (_c: unknown, _guild: string, user: string) => {
    const ids = client.grants.get(user) ?? [];
    return { refusals: new Map(ids.map((id) => [id, null])), grantable: new Set(ids) };
  }),
  guildChannels: vi.fn(async () => ({
    channels: [{ id: "333333333333333333", name: "ranks", type: "text" }],
    roles: [
      { id: "555555555555555551", name: "Epic", assignable: true, refusal: null },
      { id: "555555555555555552", name: "Legend", assignable: true, refusal: null },
      { id: "555555555555555553", name: "Mod", assignable: false, refusal: "dangerous" },
      { id: "555555555555555554", name: "Staff", assignable: false, refusal: "above_bot" },
    ],
    manageRoles: true,
  })),
  guildEmojis: vi.fn(async () => [{ id: "666666666666666661", name: "rank_epic", animated: false }]),
  refreshGuildQuietly: vi.fn(async () => undefined),
  publishRoleMenu: vi.fn(async (): Promise<{ ok: boolean; messageId?: string; channelId?: string; error?: string }> => ({
    ok: true,
    messageId: "777777777777777777",
    channelId: "333333333333333333",
  })),
  removeRoleMenuMessage: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/bot/client", async (original) => ({ ...(await original<object>()), ...client }));

const jar = vi.hoisted(() => ({ session: undefined as string | undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (jar.session ? { value: jar.session } : undefined) }) }));

type Row = Record<string, unknown> & { id: number; guildId: string };
const store = vi.hoisted(() => ({
  menus: [] as Row[],
  nextId: 1,
}));
vi.mock("@/lib/db", () => {
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (k === "guild" ? true : row[k] === v));
  return {
    databaseConfigured: () => true,
    db: () => ({
      guild: { findUnique: vi.fn(async () => ({ id: GUILD, leftAt: null, locale: "fr" })) },
      roleMenu: {
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => store.menus.find((m) => matches(m, where)) ?? null),
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => store.menus.filter((m) => matches(m, where))),
        count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => store.menus.filter((m) => matches(m, where)).length),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const now = new Date();
          const row = { id: store.nextId++, messageId: null, messageChannelId: null, publishedAt: null, updatedAt: now, ...data } as unknown as Row;
          store.menus.push(row);
          return row;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
          const row = store.menus.find((m) => m.id === where.id)!;
          Object.assign(row, { updatedAt: new Date(Date.now() + 1) }, data);
          return row;
        }),
        delete: vi.fn(async ({ where }: { where: { id: number } }) => {
          store.menus = store.menus.filter((m) => m.id !== where.id);
        }),
      },
    }),
  };
});

const { readBotConfig } = await import("@/lib/bot/config");
const { sealSession } = await import("@/lib/bot/session");
const { signedHeaders } = await import("@/lib/bot/signature");
const createRoute = await import("@/app/api/discord/guilds/[id]/role-menus/route");
const menuRoute = await import("@/app/api/discord/guilds/[id]/role-menus/[menu]/route");
const publishRoute = await import("@/app/api/discord/guilds/[id]/role-menus/[menu]/publish/route");
const botRoute = await import("@/app/api/bot/guilds/[id]/role-menus/route");
// The bot's own schema: what the site serves must be what the bot reads.
const { roleMenuList } = await import("../../bot/src/site/schemas");

const config = readBotConfig(process.env);
if (typeof config === "string") throw new Error("test configuration invalid");
const BASE = "http://mlbb:3001";
let address = 0;

function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  // A fresh address each time: the per-address limit is not the subject here.
  address += 1;
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      origin: "https://mlbbdex.com",
      "x-forwarded-for": `198.51.${Math.floor(address / 250)}.${address % 250}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const create = (body: unknown, guild = GUILD, headers?: Record<string, string>) =>
  createRoute.POST(request("POST", `/api/discord/guilds/${guild}/role-menus`, body, headers), { params: Promise.resolve({ id: guild }) });
const update = (menu: number | string, body: unknown, guild = GUILD) =>
  menuRoute.PUT(request("PUT", `/api/discord/guilds/${guild}/role-menus/${menu}`, body), { params: Promise.resolve({ id: guild, menu: String(menu) }) });
const remove = (menu: number | string, guild = GUILD) =>
  menuRoute.DELETE(request("DELETE", `/api/discord/guilds/${guild}/role-menus/${menu}`), { params: Promise.resolve({ id: guild, menu: String(menu) }) });
const publish = (menu: number | string, guild = GUILD) =>
  publishRoute.POST(request("POST", `/api/discord/guilds/${guild}/role-menus/${menu}/publish`), { params: Promise.resolve({ id: guild, menu: String(menu) }) });

const ranks = (o: Partial<{ channelId: string; roles: string[]; emoji: string | null; mode: string }> = {}) => ({
  channelId: o.channelId ?? CHANNEL,
  title: "  Your rank ",
  description: "",
  mode: o.mode ?? "single",
  options: (o.roles ?? [EPIC, LEGEND]).map((roleId, i) => ({ roleId, label: `Rank ${i}`, emoji: i === 0 ? (o.emoji ?? null) : "🔥" })),
});
const as = (user: string) => (jar.session = sealSession(config, { id: user, name: "Leo", avatar: null }));

beforeEach(() => {
  as(USER);
  store.menus = [];
  store.nextId = 1;
  for (const fn of [client.canManage, client.grantableRoles, client.publishRoleMenu, client.refreshGuildQuietly, client.removeRoleMenuMessage]) fn.mockClear();
});

describe("role menu save", () => {
  it("creates a menu for a manager who can give its roles, and owns it", async () => {
    const response = await create(ranks({ emoji: `<:rank_epic:${EMOJI}>` }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: 1, title: "Your rank", description: null, configuredBy: USER, messageId: null });
    expect(store.menus[0]).toMatchObject({ guildId: GUILD, configuredBy: USER, options: [{ roleId: EPIC, emoji: `<:rank_epic:${EMOJI}>` }, { roleId: LEGEND }] });
    expect(client.refreshGuildQuietly).toHaveBeenCalledWith(expect.anything(), GUILD);
  });

  it("refuses a channel, role or emoji of another server, and a dangerous or higher role", async () => {
    for (const body of [
      ranks({ channelId: FOREIGN_CHANNEL }),
      ranks({ roles: [EPIC, FOREIGN_ROLE] }),
      ranks({ roles: [MOD_ROLE] }),
      ranks({ roles: [HIGH_ROLE] }),
      ranks({ emoji: `<:stolen:${FOREIGN_EMOJI}>` }),
    ]) {
      expect((await create(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(store.menus).toHaveLength(0);
  });

  it("refuses a malformed menu: duplicates, too many options, bad emoji, extra fields", async () => {
    const options26 = Array.from({ length: 26 }, (_, i) => ({ roleId: `5555555555555556${String(i).padStart(2, "0")}`, label: "x", emoji: null }));
    for (const body of [
      ranks({ roles: [EPIC, EPIC] }),
      { ...ranks(), options: options26 },
      { ...ranks(), options: [] },
      ranks({ emoji: "not an emoji" }),
      ranks({ mode: "all" }),
      { ...ranks(), title: "   " },
      { ...ranks(), guildId: OTHER_GUILD },
      { ...ranks(), configuredBy: CO_MANAGER },
    ]) {
      expect((await create(body)).status, JSON.stringify(body).slice(0, 80)).toBe(400);
    }
  });

  it("refuses a manager without Manage Roles (Manage Server alone): the confused deputy", async () => {
    as(CO_MANAGER);
    const response = await create(ranks());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "role menu not grantable" });
    expect(store.menus).toHaveLength(0);
  });

  it("lets another manager edit the text of a menu without taking it over, not its roles", async () => {
    await create(ranks());
    as(CO_MANAGER);
    const retitled = await update(1, { ...ranks(), title: "Rangs" });
    expect(retitled.status).toBe(200);
    expect(store.menus[0]).toMatchObject({ title: "Rangs", configuredBy: USER });
    expect((await update(1, ranks({ roles: [EPIC] }))).status).toBe(400);
    expect(store.menus[0]!.options).toHaveLength(2);
  });

  it("refuses a server the user does not manage, another server's menu id, and more than 10 menus", async () => {
    expect((await create(ranks(), OTHER_GUILD)).status).toBe(403);
    await create(ranks());
    store.menus[0]!.guildId = OTHER_GUILD;
    expect((await update(1, ranks())).status).toBe(404);
    expect((await update("1; drop", ranks())).status).toBe(404);
    store.menus = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, guildId: GUILD }) as Row);
    expect((await create(ranks())).status).toBe(409);
  });

  it("refuses a cross-origin request or a missing session", async () => {
    expect((await create(ranks(), GUILD, { origin: "https://evil.example" })).status).toBe(403);
    jar.session = undefined;
    expect((await create(ranks())).status).toBe(401);
    expect(store.menus).toHaveLength(0);
  });
});

describe("role menu publish and delete", () => {
  it("publishes the stored menu, records the message and tells the bot to forget its copy", async () => {
    await create(ranks());
    const response = await publish(1);
    expect(await response.json()).toMatchObject({ ok: true, menu: { messageId: "777777777777777777", messageChannelId: CHANNEL } });
    expect(client.publishRoleMenu).toHaveBeenCalledWith(
      expect.anything(),
      GUILD,
      "fr",
      expect.objectContaining({ id: 1, mode: "single", configuredBy: USER, options: [expect.objectContaining({ roleId: EPIC }), expect.anything()] }),
    );
    const row = store.menus[0]!;
    expect((row.publishedAt as Date).getTime()).toBe((row.updatedAt as Date).getTime());
    expect(client.refreshGuildQuietly).toHaveBeenCalledTimes(2);
  });

  it("refuses to publish a role the bot may no longer give, or for another server", async () => {
    await create(ranks());
    store.menus[0]!.options = [{ roleId: MOD_ROLE, label: "Mod", emoji: null }];
    expect(await (await publish(1)).json()).toEqual({ ok: false, error: "role menu roles unavailable" });
    expect((await publish(1, OTHER_GUILD)).status).toBe(403);
    expect(client.publishRoleMenu).not.toHaveBeenCalled();
  });

  it("passes the bot's refusal on, without recording a message", async () => {
    await create(ranks());
    client.publishRoleMenu.mockResolvedValueOnce({ ok: false, error: "missing_permissions" });
    expect(await (await publish(1)).json()).toEqual({ ok: false, error: "missing_permissions" });
    expect(store.menus[0]!.messageId).toBeNull();
  });

  it("deletes the menu and its message", async () => {
    await create(ranks());
    await publish(1);
    expect(await (await remove(1)).json()).toEqual({ ok: true, messageRemoved: true });
    expect(client.removeRoleMenuMessage).toHaveBeenCalledWith(expect.anything(), GUILD, CHANNEL, "777777777777777777");
    expect(store.menus).toHaveLength(0);
    expect((await remove(1)).status).toBe(404);
  });
});

describe("the bot's read", () => {
  it("serves a server's menus, signed only", async () => {
    await create(ranks());
    const path = `/api/bot/guilds/${GUILD}/role-menus`;
    const signed = new Request(`${BASE}${path}`, { headers: signedHeaders(SECRET, "GET", path, "") });
    const response = await botRoute.GET(signed, { params: Promise.resolve({ id: GUILD }) });
    const served = await response.json();
    // The bot reads every menu the site serves, none dropped as unreadable.
    expect(roleMenuList.parse(served).menus).toEqual([expect.objectContaining({ id: "1", mode: "single", configuredBy: USER })]);
    expect(served).toEqual({
      menus: [
        {
          id: 1,
          channelId: CHANNEL,
          title: "Your rank",
          description: null,
          mode: "single",
          options: [
            { roleId: EPIC, label: "Rank 0", emoji: null },
            { roleId: LEGEND, label: "Rank 1", emoji: "🔥" },
          ],
          configuredBy: USER,
          messageId: null,
          messageChannelId: null,
        },
      ],
    });
    const unsigned = await botRoute.GET(new Request(`${BASE}${path}`), { params: Promise.resolve({ id: GUILD }) });
    expect(unsigned.status).toBe(401);
  });
});
