import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Statement counts of the bulk paths, with the database faked (the real
 * queries run in tests/functional/bot-database.test.ts against Postgres).
 */

const SECRET = "a".repeat(64);
Object.assign(process.env, {
  DATABASE_URL: "postgresql://x:y@localhost:5432/z",
  BOT_API_SECRET: SECRET,
  BOT_SESSION_SECRET: "b".repeat(64),
  BOT_INTERNAL_URL: "http://bot:3100",
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "c".repeat(32),
});

const fake = vi.hoisted(() => {
  const state = {
    statements: [] as string[],
    transactions: [] as unknown[][],
    settingsQuery: null as unknown,
    settingsRows: [] as unknown[],
  };
  const raw = (strings: TemplateStringsArray) => {
    const text = strings.join("?").trim().split(/\s+/).slice(0, 3).join(" ");
    state.statements.push(text);
    return text;
  };
  const client = {
    $executeRaw: raw,
    $transaction: async (ops: unknown[]) => {
      state.transactions.push(ops);
      return ops.map(() => 7);
    },
    announcement: { findMany: async () => [{ id: 1, type: "patches" }] },
    guild: { findMany: async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ id })) },
    guildSettings: {
      updateMany: (args: unknown) => ({ updateMany: args }),
      findMany: async (args: unknown) => {
        state.settingsQuery = args;
        return state.settingsRows;
      },
    },
  };
  return { state, client };
});
vi.mock("@/lib/db", () => ({ databaseConfigured: () => true, db: () => fake.client }));

const { syncGuilds, dailyGuilds, DAILY_PAGE, SYNC_CHUNK } = await import("@/lib/bot/guild-store");
const { recordDeliveries } = await import("@/lib/bot/delivery-store");
const { deliveriesBody } = await import("@/app/api/bot/deliveries/route");
const { GET: dailyGuildsRoute } = await import("@/app/api/bot/daily/guilds/route");
const { signedHeaders } = await import("@/lib/bot/signature");

const id = (n: number) => `1${String(n).padStart(17, "0")}`;

beforeEach(() => {
  fake.state.statements = [];
  fake.state.transactions = [];
  fake.state.settingsRows = [];
});

describe("guild sync", () => {
  it("writes a thousand servers per statement, plus one for the servers left", async () => {
    const guilds = Array.from({ length: 2 * SYNC_CHUNK + 1 }, (_, i) => ({ id: id(i), name: "x", icon: null, memberCount: 1, locale: "en" }));
    const result = await syncGuilds(true, [...guilds, guilds[0]]);
    expect(fake.state.transactions).toHaveLength(1);
    expect(fake.state.statements.filter((s) => s.startsWith("INSERT INTO"))).toHaveLength(3);
    expect(fake.state.statements.filter((s) => s.startsWith("UPDATE"))).toHaveLength(1);
    expect(result).toEqual({ synced: guilds.length, left: 7 });
  });

  it("marks nobody as left on a partial sync", async () => {
    await syncGuilds(false, [{ id: id(1), name: "x", icon: null, memberCount: 1, locale: "en" }]);
    expect(fake.state.statements).toEqual([expect.stringMatching(/^INSERT INTO/)]);
  });
});

describe("delivery reports", () => {
  it("stores a batch in one insert, and one failing update per type", async () => {
    const stored = await recordDeliveries([
      { announcementId: 1, guildId: id(1), status: "sent" },
      { announcementId: 1, guildId: id(2), status: "forbidden" },
      { announcementId: 1, guildId: id(3), status: "forbidden" },
      { announcementId: 2, guildId: id(4), status: "sent" },
    ]);
    expect(stored).toBe(3);
    expect(fake.state.statements.filter((s) => s.startsWith("INSERT INTO"))).toHaveLength(1);
    const ops = fake.state.transactions[0];
    expect(ops).toHaveLength(2);
    expect(ops[1]).toEqual({ updateMany: { where: { guildId: { in: [id(2), id(3)] } }, data: { patchesFailing: true } } });
  });

  it("reads announcement ids sent as numbers or as the bot's strings", () => {
    const report = { guildId: id(1), status: "sent" };
    expect(deliveriesBody.parse([{ ...report, announcementId: "12" }])[0].announcementId).toBe(12);
    expect(deliveriesBody.parse([{ ...report, announcementId: 12 }])[0].announcementId).toBe(12);
    expect(deliveriesBody.safeParse([{ ...report, announcementId: "1e3" }]).success).toBe(false);
    expect(deliveriesBody.safeParse([{ ...report, announcementId: "0" }]).success).toBe(false);
  });
});

describe("daily servers by hour", () => {
  const call = (query: string) => {
    const path = `/api/bot/daily/guilds${query}`;
    return dailyGuildsRoute(new Request(`http://mlbb:3001${path}`, { headers: signedHeaders(SECRET, "GET", path, "") }));
  };

  it("reads one hour's servers with a daily channel, paged by id", async () => {
    fake.state.settingsRows = Array.from({ length: DAILY_PAGE + 1 }, (_, i) => ({
      guildId: id(i),
      dailyMlbbdleChannelId: null,
      dailyQuizChannelId: id(9),
      guild: { locale: "xx" },
    }));
    const page = await dailyGuilds(7, id(0));
    expect(fake.state.settingsQuery).toMatchObject({
      where: { dailyHourUtc: 7, guild: { leftAt: null }, guildId: { gt: id(0) } },
      orderBy: { guildId: "asc" },
      take: DAILY_PAGE + 1,
    });
    expect(page.guilds).toHaveLength(DAILY_PAGE);
    expect(page.guilds[0].locale).toBe("en");
    expect(page.next).toBe(id(DAILY_PAGE - 1));
  });

  it("validates the hour and the cursor", async () => {
    expect((await call("?hour=7")).status).toBe(200);
    expect((await call("?hour=24")).status).toBe(400);
    expect((await call("?hour=x")).status).toBe(400);
    expect((await call("?hour=7&after=1%27%3B")).status).toBe(400);
  });
});
