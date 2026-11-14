import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The bot's database paths against a real Postgres: the bulk statements
 * (guild sync, deliveries), the narrowed pending list, the daily-post
 * list by hour, the aggregated leaderboard and admin figures, the welcome
 * and goodbye settings and the auto-roles (migration, signed read, failing
 * flag).
 *
 * Needs a migrated, disposable database, for instance:
 *   docker run -d --rm -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=t postgres:17-alpine
 *   DATABASE_URL=postgresql://postgres:t@127.0.0.1:55432/postgres npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://postgres:t@127.0.0.1:55432/postgres npx vitest run tests/functional/bot-database.test.ts
 * Skipped without TEST_DATABASE_URL. Every table it uses is emptied first.
 */
const url = process.env.TEST_DATABASE_URL?.trim();

const SECRET = "a".repeat(64);
const g = (n: number) => `1${String(n).padStart(17, "0")}`;

describe.skipIf(!url)("bot database paths", async () => {
  if (!url) return;
  Object.assign(process.env, {
    DATABASE_URL: url,
    BOT_API_SECRET: SECRET,
    BOT_SESSION_SECRET: "b".repeat(64),
    BOT_INTERNAL_URL: "http://bot:3100",
    DISCORD_CLIENT_ID: "123456789012345678",
    DISCORD_CLIENT_SECRET: "c".repeat(32),
  });
  const { db } = await import("@/lib/db");
  const { syncGuilds, dailyGuilds, DAILY_PAGE } = await import("@/lib/bot/guild-store");
  const { recordDeliveries } = await import("@/lib/bot/delivery-store");
  const { pendingAnnouncements } = await import("@/lib/bot/announcement-store");
  const { adminStats, percentile } = await import("@/lib/bot/stats");
  const { rank } = await import("@/lib/bot/leaderboard");
  const { signedHeaders } = await import("@/lib/bot/signature");
  const leaderboard = await import("@/app/api/bot/daily/leaderboard/route");
  const deliveriesRoute = await import("@/app/api/bot/deliveries/route");
  const settingsRoute = await import("@/app/api/bot/guilds/[id]/settings/route");
  const greetingFailure = await import("@/app/api/bot/guilds/[id]/greeting-failure/route");
  const autoRoleFailure = await import("@/app/api/bot/guilds/[id]/auto-role-failure/route");
  const { settingsRow } = await import("@/lib/bot/settings");

  const entry = (n: number, extra: Partial<{ name: string; memberCount: number; locale: string }> = {}) => ({
    id: g(n),
    name: extra.name ?? `Server ${n}`,
    icon: null,
    memberCount: extra.memberCount ?? n,
    locale: extra.locale ?? "fr",
  });

  beforeAll(async () => {
    await db().$transaction([
      db().delivery.deleteMany(),
      db().announcement.deleteMany(),
      db().guildSettings.deleteMany(),
      db().guild.deleteMany(),
      db().commandLog.deleteMany(),
      db().dailyResult.deleteMany(),
      db().vote.deleteMany(),
    ]);
  });
  afterAll(async () => {
    await db().$disconnect();
  });

  it("syncs thousands of servers in a few statements, with the same rules as one by one", async () => {
    const many = Array.from({ length: 2_345 }, (_, i) => entry(i + 1));
    expect(await syncGuilds(true, many)).toEqual({ synced: 2_345, left: 0 });
    expect(await db().guild.count()).toBe(2_345);

    // The dashboard changed a locale; the bot reports a new name and Discord's locale.
    await db().guild.update({ where: { id: g(1) }, data: { locale: "it" } });
    const joined = (await db().guild.findUniqueOrThrow({ where: { id: g(1) } })).joinedAt;
    const again = [entry(1, { name: "Renamed", locale: "es-ES" }), entry(1, { name: "Renamed twice" }), ...many.slice(1, 2_000)];
    expect(await syncGuilds(true, again)).toEqual({ synced: 2_000, left: 345 });
    const one = await db().guild.findUniqueOrThrow({ where: { id: g(1) } });
    expect(one).toMatchObject({ name: "Renamed twice", locale: "it", leftAt: null, joinedAt: joined });
    expect(await db().guild.count({ where: { leftAt: { not: null } } })).toBe(345);

    // A partial sync brings one back and marks nobody else.
    expect(await syncGuilds(false, [entry(2_100)])).toEqual({ synced: 1, left: 0 });
    expect((await db().guild.findUniqueOrThrow({ where: { id: g(2_100) } })).leftAt).toBeNull();
    expect(await db().guild.count({ where: { leftAt: { not: null } } })).toBe(344);
  });

  it("records a batch of deliveries at once, string ids included, and flags forbidden channels", async () => {
    const created = await db().announcement.create({ data: { type: "patches", key: "1.9.99", payload: {} } });
    await db().guildSettings.createMany({
      data: [1, 2, 3].map((n) => ({ guildId: g(n), patchesChannelId: g(900 + n) })),
    });
    const body = JSON.stringify([
      { announcementId: String(created.id), guildId: g(1), status: "failed", error: "first" },
      { announcementId: created.id, guildId: g(1), status: "sent", messageId: g(42) },
      { announcementId: created.id, guildId: g(2), status: "forbidden", error: "Missing Access" },
      { announcementId: created.id + 1000, guildId: g(3), status: "sent" },
      { announcementId: created.id, guildId: "999999999999999999", status: "sent" },
    ]);
    const path = "/api/bot/deliveries";
    const response = await deliveriesRoute.POST(
      new Request(`http://mlbb:3001${path}`, { method: "POST", headers: signedHeaders(SECRET, "POST", path, body), body }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ stored: 2 });
    expect(await db().delivery.findUniqueOrThrow({ where: { announcementId_guildId: { announcementId: created.id, guildId: g(1) } } })).toMatchObject({
      status: "sent",
      messageId: g(42),
      error: null,
    });
    expect((await db().guildSettings.findUniqueOrThrow({ where: { guildId: g(2) } })).patchesFailing).toBe(true);
    expect((await db().guildSettings.findUniqueOrThrow({ where: { guildId: g(1) } })).patchesFailing).toBe(false);
    expect(await recordDeliveries([{ announcementId: created.id, guildId: g(3), status: "sent" }])).toBe(1);
  });

  it("offers an announcement to the servers that can still receive it, and only those", async () => {
    await db().delivery.deleteMany();
    await db().guildSettings.updateMany({ data: { patchesFailing: false } });
    await db().guildSettings.update({ where: { guildId: g(2) }, data: { patchesFailing: true } });
    await recordDeliveries([{ announcementId: (await db().announcement.findFirstOrThrow()).id, guildId: g(3), status: "sent" }]);
    const pending = await pendingAnnouncements();
    expect(pending).toHaveLength(1);
    expect(pending[0].targets).toEqual([{ guildId: g(1), channelId: g(901), roleId: null, locale: "it" }]);
  });

  it("lists one hour's daily servers, paged by id", async () => {
    const ids = Array.from({ length: DAILY_PAGE + 5 }, (_, i) => g(10 + i));
    await db().guildSettings.createMany({
      data: ids.map((id, i) => ({ guildId: id, dailyHourUtc: 7, dailyQuizChannelId: i === 0 ? null : g(5) })),
      skipDuplicates: true,
    });
    await db().guildSettings.create({ data: { guildId: g(2_100), dailyHourUtc: 8, dailyQuizChannelId: g(5) } });
    const first = await dailyGuilds(7, null);
    expect(first.guilds).toHaveLength(DAILY_PAGE);
    expect(first.guilds[0]).toEqual({ guildId: g(11), locale: "fr", dailyMlbbdleChannelId: null, dailyQuizChannelId: g(5) });
    const second = await dailyGuilds(7, first.next);
    // g(10) has no daily channel; servers marked as left are skipped too.
    const left = await db().guild.count({ where: { id: { in: ids }, leftAt: { not: null } } });
    expect(first.guilds.length + second.guilds.length).toBe(ids.length - 1 - left);
    expect(second.next).toBeNull();
    expect((await dailyGuilds(8, null)).guilds.map((x) => x.guildId)).toEqual([g(2_100)]);
  });

  it("ranks a leaderboard from database totals exactly as from the rows", async () => {
    const rows: { guildId: string; day: string; game: string; discordUserId: string; discordUserName: string; score: number }[] = [];
    for (let u = 0; u < 80; u++) {
      for (let d = 1; d <= 1 + (u % 5); d++) {
        rows.push({
          guildId: g(1),
          day: `2026-11-${String(d).padStart(2, "0")}`,
          game: "mlbbdle-classic",
          discordUserId: g(5_000 + u),
          discordUserName: `p${u}-d${d}`,
          score: 1 + ((u * 7 + d * 3) % 6),
        });
      }
    }
    await db().dailyResult.createMany({ data: rows });
    const path = "/api/bot/daily/leaderboard?guild=" + g(1) + "&game=mlbbdle-classic&period=week&day=2026-11-05";
    const response = await leaderboard.GET(new Request(`http://mlbb:3001${path}`, { headers: signedHeaders(SECRET, "GET", path, "") }));
    expect(response.status).toBe(200);
    const { entries } = (await response.json()) as { entries: unknown[] };
    expect(entries).toEqual(rank("mlbbdle-classic", rows.map((r) => ({ ...r }))));
  });

  it("stores welcome and goodbye settings, serves them to the bot and flags a failing channel", async () => {
    const id = g(1);
    // Defaults straight from the migration: both messages off.
    expect(await db().guildSettings.findUniqueOrThrow({ where: { guildId: id } })).toMatchObject({
      welcomeChannelId: null,
      welcomeMessage: null,
      welcomeFailing: false,
      goodbyeChannelId: null,
      goodbyeMessage: null,
      goodbyeFailing: false,
    });
    const long = "é".repeat(500);
    await db().guildSettings.update({
      where: { guildId: id },
      data: { welcomeChannelId: g(77), welcomeMessage: long, goodbyeChannelId: null, goodbyeMessage: "Bye {username}" },
    });

    // Each read signs with its own second: the site refuses a signature twice.
    let second = 0;
    const read = async () => {
      const path = `/api/bot/guilds/${id}/settings`;
      const headers = signedHeaders(SECRET, "GET", path, "", Date.now() - 60_000 + 1_000 * second++);
      const response = await settingsRoute.GET(new Request(`http://mlbb:3001${path}`, { headers }), { params: Promise.resolve({ id }) });
      expect(response.status).toBe(200);
      return (await response.json()) as { welcome: unknown; goodbye: unknown };
    };
    const fail = async (kind: string) => {
      const path = `/api/bot/guilds/${id}/greeting-failure`;
      const body = JSON.stringify({ kind });
      return greetingFailure.POST(
        new Request(`http://mlbb:3001${path}`, { method: "POST", headers: signedHeaders(SECRET, "POST", path, body), body }),
        { params: Promise.resolve({ id }) },
      );
    };

    expect(await read()).toMatchObject({
      welcome: { channelId: g(77), message: long, failing: false },
      goodbye: { channelId: null, message: "Bye {username}", failing: false },
    });
    expect(await (await fail("welcome")).json()).toEqual({ ok: true, marked: 1 });
    // A message that is off has nothing to fail.
    expect(await (await fail("goodbye")).json()).toEqual({ ok: true, marked: 0 });
    expect((await fail("announcement")).status).toBe(400);
    expect(await read()).toMatchObject({ welcome: { failing: true }, goodbye: { failing: false } });

    // Saving from the dashboard clears the flag, as for announcements.
    const row = settingsRow({
      locale: "fr",
      announcements: {
        patches: { channelId: g(901), roleId: null },
        skins: { channelId: null, roleId: null },
        events: { channelId: null, roleId: null },
        advanceServer: { channelId: null, roleId: null },
        esports: { channelId: null, roleId: null },
      },
      dailyMlbbdleChannelId: null,
      dailyQuizChannelId: null,
      dailyHourUtc: 12,
      welcome: { channelId: g(77), message: null },
      goodbye: { channelId: null, message: "Bye {username}" },
      autoRoles: { roleIds: [], botRoleIds: [] },
    });
    await db().guildSettings.update({ where: { guildId: id }, data: row });
    expect(await read()).toMatchObject({ welcome: { channelId: g(77), message: null, failing: false } });
  });

  it("stores the auto-roles, serves them to the bot and flags them failing", async () => {
    const id = g(990);
    // Defaults straight from the migration, written by SQL alone: off, for people and bots.
    await db().guild.upsert({ where: { id }, create: entry(990), update: {} });
    await db().guildSettings.deleteMany({ where: { guildId: id } });
    await db().$executeRaw`INSERT INTO "GuildSettings" ("guildId", "updatedAt") VALUES (${id}, now())`;
    expect(await db().guildSettings.findUniqueOrThrow({ where: { guildId: id } })).toMatchObject({
      autoRoleIds: [],
      botAutoRoleIds: [],
      autoRoleFailing: false,
      autoRoleFailReason: null,
      autoRolesConfiguredBy: null,
    });

    let second = 0;
    const read = async () => {
      const path = `/api/bot/guilds/${id}/settings`;
      const headers = signedHeaders(SECRET, "GET", path, "", Date.now() - 50_000 + 1_000 * second++);
      const response = await settingsRoute.GET(new Request(`http://mlbb:3001${path}`, { headers }), { params: Promise.resolve({ id }) });
      expect(response.status).toBe(200);
      return ((await response.json()) as { autoRoles: unknown }).autoRoles;
    };
    const fail = async (body = "{}") => {
      const path = `/api/bot/guilds/${id}/auto-role-failure`;
      return autoRoleFailure.POST(
        new Request(`http://mlbb:3001${path}`, {
          method: "POST",
          headers: signedHeaders(SECRET, "POST", path, body, Date.now() - 50_000 + 1_000 * second++),
          body,
        }),
        { params: Promise.resolve({ id }) },
      );
    };

    expect(await read()).toEqual({ roleIds: [], botRoleIds: [], failing: false, failReason: null, configuredBy: null });
    // Off: nothing to fail.
    expect(await (await fail()).json()).toEqual({ ok: true, marked: 0 });

    await db().guildSettings.update({
      where: { guildId: id },
      data: { autoRoleIds: [g(501), g(502), g(503)], botAutoRoleIds: [g(504)], autoRolesConfiguredBy: g(600) },
    });
    expect(await read()).toEqual({ roleIds: [g(501), g(502), g(503)], botRoleIds: [g(504)], failing: false, failReason: null, configuredBy: g(600) });
    expect(await (await fail()).json()).toEqual({ ok: true, marked: 1 });
    expect((await fail(JSON.stringify({ roleId: g(501) }))).status).toBe(400);
    expect(await read()).toMatchObject({ failing: true, failReason: "bot" });
    // The manager who chose them left or lost the permission: said as such.
    expect(await (await fail(JSON.stringify({ reason: "granter" }))).json()).toEqual({ ok: true, marked: 1 });
    expect(await read()).toMatchObject({ failing: true, failReason: "granter", configuredBy: g(600) });
    expect((await fail(JSON.stringify({ reason: "admin" }))).status).toBe(400);

    // Bots' roles alone still count as configured.
    await db().guildSettings.update({ where: { guildId: id }, data: { autoRoleIds: [], autoRoleFailing: false } });
    expect(await (await fail()).json()).toEqual({ ok: true, marked: 1 });
  });

  it("computes the admin figures in the database, p95 by nearest rank", async () => {
    const now = new Date();
    const durations = Array.from({ length: 237 }, (_, i) => (i * 37) % 1_000);
    await db().commandLog.createMany({
      data: durations.map((ms, i) => ({ command: i % 3 ? "hero" : "build", guildId: null, locale: "en", durationMs: ms, ok: i % 10 !== 0 })),
    });
    const stats = await adminStats("24h", now);
    expect(stats.commands.total).toBe(237);
    expect(stats.commands.p95).toBe(percentile(durations, 95));
    expect(stats.commands.errorRate).toBeCloseTo(24 / 237);
    const hero = durations.filter((_, i) => i % 3);
    const heroErrors = durations.filter((_, i) => i % 3 && i % 10 === 0).length;
    expect(stats.commands.top[0]).toEqual({ command: "hero", count: hero.length, errors: heroErrors, p95: percentile(hero, 95) });
    expect(stats.commands.perDay.at(-1)?.value).toBe(237);
    expect(stats.servers.joins.at(-1)?.value).toBe(await db().guild.count());
    // Distinct players per puzzle day, inside the 30-day window.
    const today = now.toISOString().slice(0, 10);
    await db().dailyResult.createMany({
      data: [g(1), g(2)].flatMap((guildId) =>
        ["quiz", "mlbbdle-skill"].map((game) => ({ guildId, day: today, game, discordUserId: g(7_000), discordUserName: "x", score: 1 })),
      ),
    });
    await db().dailyResult.create({ data: { guildId: g(1), day: today, game: "quiz", discordUserId: g(7_001), discordUserName: "y", score: 1 } });
    expect((await adminStats("24h", now)).daily.playersPerDay.at(-1)).toEqual({ day: today, value: 2 });
  });
});
