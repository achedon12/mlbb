import { db } from "@/lib/db";

/**
 * Super admin figures, aggregated by the database: counts per bucket, per
 * command, per status, distinct players and percentiles come back as a few
 * hundred rows at most, never as the rows they summarize (a month of
 * command logs is hundreds of thousands). Where Prisma's builder has no
 * form for it (buckets, percentiles, distinct counts, filtered counts),
 * tagged `$queryRaw` templates: every value is a bound parameter, no SQL is
 * built from strings. Every query reads an indexed time column
 * (`CommandLog.createdAt`, `Delivery.sentAt`, `DailyResult.day`,
 * `Guild.joinedAt`/`leftAt`, `Vote.createdAt`) or the small `Guild` table.
 *
 * A window is whole buckets ending now: the last 24 hours by hour, or the
 * last 7 or 30 UTC days by day, today included. Each figure also comes for
 * the window just before, of the same length, for the deltas.
 *
 * The pure helpers are tested on their own; `percentile` is the reference
 * `percentile_disc` is checked against (nearest rank).
 */

export const WINDOWS = { "24h": 1, "7d": 7, "30d": 30 } as const;
export type StatsWindow = keyof typeof WINDOWS;
/** Own keys only: `in` also accepts "constructor" or "toString", a function, which turned every date into NaN. */
export const isWindow = (w: string | undefined): w is StatsWindow => !!w && Object.hasOwn(WINDOWS, w);

/** Commands drawn as their own series in the per-bucket chart; the rest is "other". */
export const STACKED_COMMANDS = 5;
export const OTHER = "other";

/** Nearest-rank percentile of durations; 0 for an empty list. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** UTC days from `from` to `to` included, YYYY-MM-DD. */
export function daysBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  for (let t = start; t <= to.getTime(); t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Counts per UTC day, every day of the range present (zero when nothing happened). */
export function fillDays(counts: { day: string; value: number }[], days: string[]): { day: string; value: number }[] {
  const byDay = new Map(counts.map((c) => [c.day, Number(c.value)]));
  return days.map((day) => ({ day, value: byDay.get(day) ?? 0 }));
}

export type Bucket = "hour" | "day";

export interface Period {
  bucket: Bucket;
  /** Start of the window (start of its first bucket). */
  since: Date;
  /** Start of the window before, of the same length. */
  previousSince: Date;
  /** One key per bucket, oldest first: `YYYY-MM-DDTHH` by hour, `YYYY-MM-DD` by day. */
  keys: string[];
  /** The Postgres `to_char` pattern giving the same keys. */
  pattern: string;
}

export function periodOf(window: StatsWindow, now: Date): Period {
  if (window === "24h") {
    const hour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
    const since = hour - 23 * HOUR_MS;
    const keys = Array.from({ length: 24 }, (_, i) => new Date(since + i * HOUR_MS).toISOString().slice(0, 13));
    return { bucket: "hour", since: new Date(since), previousSince: new Date(since - DAY_MS), keys, pattern: 'YYYY-MM-DD"T"HH24' };
  }
  const days = WINDOWS[window];
  const today = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
  const since = today - (days - 1) * DAY_MS;
  const keys = Array.from({ length: days }, (_, i) => new Date(since + i * DAY_MS).toISOString().slice(0, 10));
  return { bucket: "day", since: new Date(since), previousSince: new Date(since - days * DAY_MS), keys, pattern: "YYYY-MM-DD" };
}

export interface Change {
  current: number;
  previous: number;
}

/** Relative change, null when there is nothing to compare with. */
export function relativeChange({ current, previous }: Change): number | null {
  if (!previous) return null;
  return (current - previous) / previous;
}

/**
 * Per-bucket counts by command folded into the `top` commands and "other",
 * every bucket present: the stacked chart's rows.
 */
export function stackCommands(
  rows: { key: string; command: string; count: number; errors: number }[],
  keys: string[],
  top: string[],
): { key: string; values: Record<string, number>; total: number; errors: number }[] {
  const series = new Set(top);
  const byKey = new Map(keys.map((key) => [key, { key, values: {} as Record<string, number>, total: 0, errors: 0 }]));
  for (const row of rows) {
    const bucket = byKey.get(row.key);
    if (!bucket) continue;
    const name = series.has(row.command) ? row.command : OTHER;
    bucket.values[name] = (bucket.values[name] ?? 0) + Number(row.count);
    bucket.total += Number(row.count);
    bucket.errors += Number(row.errors);
  }
  return [...byKey.values()];
}

/** Rows keyed by (key, name) into one row per key, every key present. */
export function pivot(rows: { key: string; name: string; value: number }[], keys: string[]): { key: string; values: Record<string, number> }[] {
  const byKey = new Map(keys.map((key) => [key, {} as Record<string, number>]));
  for (const row of rows) {
    const values = byKey.get(row.key);
    if (values) values[row.name] = (values[row.name] ?? 0) + Number(row.value);
  }
  return keys.map((key) => ({ key, values: byKey.get(key)! }));
}

/**
 * Runs the queries a few at a time: the site's pool has five connections,
 * which a request waits five seconds for. A panel firing twenty at once
 * would hold the pool from the bot's own calls.
 */
async function limited<T extends readonly (() => Promise<unknown>)[]>(
  tasks: T,
  concurrency = 3,
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const out: unknown[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]();
      }
    }),
  );
  return out as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
}

export interface CommandFigures {
  command: string;
  count: number;
  errors: number;
  p95: number;
}

type GuildTotals = {
  active: number;
  left: number;
  activeBefore: number;
  members: number;
  membersBefore: number;
  joins: number;
  joinsBefore: number;
  leaves: number;
  leavesBefore: number;
};
type KindRow = { kind: "join" | "leave"; key: string; value: number };
type CurrentRow<T> = T & { current: boolean };
type CommandTotals = { total: number; errors: number; p95: number; guilds: number };

const GUILD_FAILING = [
  "patchesFailing",
  "skinsFailing",
  "eventsFailing",
  "advanceServerFailing",
  "esportsFailing",
  "welcomeFailing",
  "goodbyeFailing",
] as const;

export async function adminStats(window: StatsWindow, now = new Date()) {
  const p = periodOf(window, now);
  const { since, previousSince: before, pattern } = p;
  // Daily games are per puzzle day: the window's days, and a week at least
  // for the chart (two bars for "24 h" say nothing).
  const days = daysBetween(since, now);
  const previousDays = daysBetween(before, new Date(since.getTime() - 1));
  const chartDays = days.length >= 7 ? days : daysBetween(new Date(now.getTime() - 6 * DAY_MS), now);

  const [
    guildTotals,
    flowRows,
    biggest,
    locales,
    commandTotals,
    byCommand,
    commandRows,
    p95Rows,
    topGuilds,
    commandLocales,
    deliveryRows,
    recentFailures,
    failing,
    playerRows,
    playerTotals,
    voteRows,
  ] = await limited([
    () => db().$queryRaw<GuildTotals[]>`
      SELECT
        (COUNT(*) FILTER (WHERE "leftAt" IS NULL))::int AS "active",
        (COUNT(*) FILTER (WHERE "leftAt" IS NOT NULL))::int AS "left",
        (COUNT(*) FILTER (WHERE "joinedAt" < ${since} AND ("leftAt" IS NULL OR "leftAt" >= ${since})))::int AS "activeBefore",
        COALESCE(SUM("memberCount") FILTER (WHERE "leftAt" IS NULL), 0)::float8 AS "members",
        COALESCE(SUM("memberCount") FILTER (WHERE "joinedAt" < ${since} AND ("leftAt" IS NULL OR "leftAt" >= ${since})), 0)::float8 AS "membersBefore",
        (COUNT(*) FILTER (WHERE "joinedAt" >= ${since}))::int AS "joins",
        (COUNT(*) FILTER (WHERE "joinedAt" >= ${before} AND "joinedAt" < ${since}))::int AS "joinsBefore",
        (COUNT(*) FILTER (WHERE "leftAt" >= ${since}))::int AS "leaves",
        (COUNT(*) FILTER (WHERE "leftAt" >= ${before} AND "leftAt" < ${since}))::int AS "leavesBefore"
      FROM "Guild"`,
    () => db().$queryRaw<KindRow[]>`
      SELECT 'join' AS "kind", to_char("joinedAt", ${pattern}) AS "key", COUNT(*)::int AS "value"
      FROM "Guild" WHERE "joinedAt" >= ${since} GROUP BY 2
      UNION ALL
      SELECT 'leave' AS "kind", to_char("leftAt", ${pattern}) AS "key", COUNT(*)::int AS "value"
      FROM "Guild" WHERE "leftAt" >= ${since} GROUP BY 2`,
    () =>
      db().guild.findMany({
        where: { leftAt: null },
        orderBy: { memberCount: "desc" },
        take: 8,
        select: { id: true, name: true, icon: true, memberCount: true, locale: true },
      }),
    () => db().guild.groupBy({ by: ["locale"], where: { leftAt: null }, _count: { _all: true } }),
    () => db().$queryRaw<CurrentRow<CommandTotals>[]>`
      SELECT ("createdAt" >= ${since}) AS "current", COUNT(*)::int AS "total",
             (COUNT(*) FILTER (WHERE NOT "ok"))::int AS "errors",
             COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY "durationMs"), 0)::int AS "p95",
             COUNT(DISTINCT "guildId")::int AS "guilds"
      FROM "CommandLog" WHERE "createdAt" >= ${before} GROUP BY 1`,
    () => db().$queryRaw<CommandFigures[]>`
      SELECT "command", COUNT(*)::int AS "count", (COUNT(*) FILTER (WHERE NOT "ok"))::int AS "errors",
             COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY "durationMs"), 0)::int AS "p95"
      FROM "CommandLog" WHERE "createdAt" >= ${since}
      GROUP BY "command" ORDER BY "count" DESC, "command" ASC LIMIT 12`,
    () => db().$queryRaw<{ key: string; command: string; count: number; errors: number }[]>`
      SELECT to_char("createdAt", ${pattern}) AS "key", "command", COUNT(*)::int AS "count",
             (COUNT(*) FILTER (WHERE NOT "ok"))::int AS "errors"
      FROM "CommandLog" WHERE "createdAt" >= ${since} GROUP BY 1, 2`,
    () => db().$queryRaw<{ key: string; value: number }[]>`
      SELECT to_char("createdAt", ${pattern}) AS "key",
             COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY "durationMs"), 0)::int AS "value"
      FROM "CommandLog" WHERE "createdAt" >= ${since} GROUP BY 1`,
    () => db().$queryRaw<{ id: string; name: string | null; icon: string | null; memberCount: number | null; count: number }[]>`
      SELECT c."guildId" AS "id", g."name", g."icon", g."memberCount", COUNT(*)::int AS "count"
      FROM "CommandLog" c LEFT JOIN "Guild" g ON g."id" = c."guildId"
      WHERE c."createdAt" >= ${since} AND c."guildId" IS NOT NULL
      GROUP BY 1, 2, 3, 4 ORDER BY "count" DESC, 1 ASC LIMIT 8`,
    () =>
      db().commandLog.groupBy({
        by: ["locale"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { locale: "desc" } },
        take: 8,
      }),
    () => db().$queryRaw<CurrentRow<{ type: string; status: string; count: number }>[]>`
      SELECT (d."sentAt" >= ${since}) AS "current", a."type", d."status", COUNT(*)::int AS "count"
      FROM "Delivery" d JOIN "Announcement" a ON a."id" = d."announcementId"
      WHERE d."sentAt" >= ${before} GROUP BY 1, 2, 3`,
    () =>
      db().delivery.findMany({
        where: { status: { not: "sent" }, sentAt: { gte: since } },
        orderBy: { sentAt: "desc" },
        take: 8,
        select: {
          status: true,
          error: true,
          sentAt: true,
          guild: { select: { id: true, name: true } },
          announcement: { select: { type: true, key: true } },
        },
      }),
    () => db().guildSettings.count({ where: { OR: GUILD_FAILING.map((f) => ({ [f]: true })), guild: { leftAt: null } } }),
    () => db().$queryRaw<{ key: string; name: string; value: number }[]>`
      SELECT "day" AS "key", "game" AS "name", COUNT(DISTINCT "discordUserId")::int AS "value"
      FROM "DailyResult" WHERE "day" >= ${chartDays[0]} GROUP BY 1, 2`,
    () => db().$queryRaw<CurrentRow<{ players: number; results: number }>[]>`
      SELECT ("day" >= ${days[0]}) AS "current", COUNT(DISTINCT "discordUserId")::int AS "players", COUNT(*)::int AS "results"
      FROM "DailyResult" WHERE "day" >= ${previousDays[0] ?? days[0]} GROUP BY 1`,
    () => db().$queryRaw<CurrentRow<{ list: string; count: number }>[]>`
      SELECT ("createdAt" >= ${since}) AS "current", "list", COUNT(*)::int AS "count"
      FROM "Vote" WHERE "createdAt" >= ${before} GROUP BY 1, 2`,
  ] as const);

  const g = guildTotals[0];
  const totalsOf = (current: boolean): CommandTotals =>
    commandTotals.find((r) => r.current === current) ?? { total: 0, errors: 0, p95: 0, guilds: 0 };
  const cmd = totalsOf(true);
  const cmdBefore = totalsOf(false);
  const playersOf = (current: boolean) => playerTotals.find((r) => r.current === current) ?? { players: 0, results: 0 };

  const flow = pivot(
    flowRows.map((r) => ({ key: r.key, name: r.kind, value: r.value })),
    p.keys,
  ).map((r) => ({ key: r.key, joins: r.values.join ?? 0, leaves: r.values.leave ?? 0 }));

  const series = byCommand.slice(0, STACKED_COMMANDS).map((c) => c.command);
  const p95ByKey = new Map(p95Rows.map((r) => [r.key, Number(r.value)]));
  const perBucket = stackCommands(commandRows, p.keys, series).map((b) => ({ ...b, p95: p95ByKey.get(b.key) ?? 0 }));
  const hasOther = perBucket.some((b) => (b.values[OTHER] ?? 0) > 0);

  const types = new Map<string, { type: string; sent: number; failed: number; forbidden: number }>();
  let sentBefore = 0;
  let failedBefore = 0;
  for (const row of deliveryRows) {
    const failedish = row.status === "failed" || row.status === "forbidden";
    if (!row.current) {
      if (row.status === "sent") sentBefore += row.count;
      else if (failedish) failedBefore += row.count;
      continue;
    }
    const entry = types.get(row.type) ?? { type: row.type, sent: 0, failed: 0, forbidden: 0 };
    if (row.status === "sent" || row.status === "failed" || row.status === "forbidden") entry[row.status] += row.count;
    types.set(row.type, entry);
  }
  const byType = [...types.values()].sort((a, b) => b.sent + b.failed + b.forbidden - (a.sent + a.failed + a.forbidden));
  const sent = byType.reduce((n, t) => n + t.sent, 0);
  const failed = byType.reduce((n, t) => n + t.failed + t.forbidden, 0);

  const games = [...new Set(playerRows.map((r) => r.name))].sort();
  const votesOf = (current: boolean) => voteRows.filter((r) => r.current === current).reduce((n, r) => n + r.count, 0);

  return {
    window,
    bucket: p.bucket,
    keys: p.keys,
    since: since.toISOString(),
    kpis: {
      servers: { current: g.active, previous: g.activeBefore },
      members: { current: g.members, previous: g.membersBefore },
      commands: { current: cmd.total, previous: cmdBefore.total },
      players: { current: playersOf(true).players, previous: playersOf(false).players },
      errorRate: { current: cmd.total ? cmd.errors / cmd.total : 0, previous: cmdBefore.total ? cmdBefore.errors / cmdBefore.total : 0 },
      p95: { current: cmd.p95, previous: cmdBefore.p95 },
    },
    servers: {
      active: g.active,
      left: g.left,
      failing,
      joins: { current: g.joins, previous: g.joinsBefore },
      leaves: { current: g.leaves, previous: g.leavesBefore },
      flow,
      biggest,
      locales: locales.map((l) => ({ locale: l.locale, count: l._count._all })).sort((a, b) => b.count - a.count),
    },
    commands: {
      total: cmd.total,
      errors: cmd.errors,
      errorRate: cmd.total ? cmd.errors / cmd.total : 0,
      p95: cmd.p95,
      activeGuilds: { current: cmd.guilds, previous: cmdBefore.guilds },
      top: byCommand,
      series: hasOther ? [...series, OTHER] : series,
      perBucket,
      locales: commandLocales.map((l) => ({ locale: l.locale, count: l._count._all })),
      topGuilds: topGuilds.map((t) => ({ ...t, name: t.name ?? t.id })),
    },
    announcements: {
      sent,
      failed,
      previous: { sent: sentBefore, failed: failedBefore },
      byType,
      recentFailures: recentFailures.map((f) => ({
        status: f.status,
        error: f.error,
        sentAt: f.sentAt.toISOString(),
        guild: f.guild.name,
        type: f.announcement.type,
        key: f.announcement.key,
      })),
    },
    daily: {
      games,
      perDay: pivot(playerRows, chartDays).map((r) => ({ day: r.key, values: r.values })),
      players: playersOf(true).players,
      results: { current: playersOf(true).results, previous: playersOf(false).results },
    },
    votes: {
      current: votesOf(true),
      previous: votesOf(false),
      byList: voteRows.filter((r) => r.current).map((r) => ({ list: r.list, count: r.count })),
    },
  };
}

export type AdminStats = Awaited<ReturnType<typeof adminStats>>;

/** Last deliveries of one server and its failing settings, for its dashboard. */
export async function deliveryHealth(guildId: string) {
  const rows = await db().delivery.findMany({
    where: { guildId },
    orderBy: { sentAt: "desc" },
    take: 10,
    select: { status: true, error: true, sentAt: true, announcement: { select: { type: true, key: true } } },
  });
  return rows.map((r) => ({
    status: r.status,
    error: r.error,
    sentAt: r.sentAt.toISOString(),
    type: r.announcement.type,
    key: r.announcement.key,
  }));
}
