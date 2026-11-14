import { db } from "@/lib/db";

/**
 * Super admin figures, aggregated by the database: counts per day, per
 * command, per status, distinct players and percentiles come back as a few
 * dozen rows, never as the rows they summarize (a month of command logs is
 * hundreds of thousands). Where Prisma's builder has no form for it
 * (per-day buckets, percentiles, distinct counts), tagged `$queryRaw`
 * templates: every value is a bound parameter, no SQL is built from strings.
 *
 * The pure helpers are tested on their own; `percentile` is the reference
 * `percentile_disc` is checked against (nearest rank).
 */

export const WINDOWS = { "24h": 1, "7d": 7, "30d": 30 } as const;
export type StatsWindow = keyof typeof WINDOWS;
/** Own keys only: `in` also accepts "constructor" or "toString", a function, which turned every date into NaN. */
export const isWindow = (w: string | undefined): w is StatsWindow => !!w && Object.hasOwn(WINDOWS, w);

/** Nearest-rank percentile of durations; 0 for an empty list. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

/** UTC days from `from` to `to` included, YYYY-MM-DD. */
export function daysBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  for (let t = start; t <= to.getTime(); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export interface CommandFigures {
  command: string;
  count: number;
  errors: number;
  p95: number;
}

/** Counts per UTC day, every day of the range present (zero when nothing happened). */
export function fillDays(counts: { day: string; value: number }[], days: string[]): { day: string; value: number }[] {
  const byDay = new Map(counts.map((c) => [c.day, Number(c.value)]));
  return days.map((day) => ({ day, value: byDay.get(day) ?? 0 }));
}

type DayCount = { day: string; value: number };

export async function adminStats(window: StatsWindow, now = new Date()) {
  const since = new Date(now.getTime() - WINDOWS[window] * 86_400_000);
  const month = new Date(now.getTime() - 30 * 86_400_000);
  const days = daysBetween(month, now);
  const windowDays = daysBetween(since, now);

  const [active, left, biggest, locales, joins, leaves, byCommand, overall, commandsPerDay, deliveries, players, votes] = await Promise.all([
    db().guild.count({ where: { leftAt: null } }),
    db().guild.count({ where: { leftAt: { not: null } } }),
    db().guild.findMany({
      where: { leftAt: null },
      orderBy: { memberCount: "desc" },
      take: 10,
      select: { id: true, name: true, icon: true, memberCount: true, locale: true },
    }),
    db().guild.groupBy({ by: ["locale"], where: { leftAt: null }, _count: { _all: true } }),
    db().$queryRaw<DayCount[]>`
      SELECT to_char("joinedAt", 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "value"
      FROM "Guild" WHERE "joinedAt" >= ${month} GROUP BY 1`,
    db().$queryRaw<DayCount[]>`
      SELECT to_char("leftAt", 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "value"
      FROM "Guild" WHERE "leftAt" >= ${month} GROUP BY 1`,
    db().$queryRaw<CommandFigures[]>`
      SELECT "command", COUNT(*)::int AS "count", (COUNT(*) FILTER (WHERE NOT "ok"))::int AS "errors",
             COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY "durationMs"), 0)::int AS "p95"
      FROM "CommandLog" WHERE "createdAt" >= ${since}
      GROUP BY "command" ORDER BY "count" DESC, "command" ASC LIMIT 15`,
    db().$queryRaw<{ total: number; errors: number; p95: number }[]>`
      SELECT COUNT(*)::int AS "total", (COUNT(*) FILTER (WHERE NOT "ok"))::int AS "errors",
             COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY "durationMs"), 0)::int AS "p95"
      FROM "CommandLog" WHERE "createdAt" >= ${since}`,
    db().$queryRaw<DayCount[]>`
      SELECT to_char("createdAt", 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "value"
      FROM "CommandLog" WHERE "createdAt" >= ${since} GROUP BY 1`,
    db().delivery.groupBy({ by: ["status"], where: { sentAt: { gte: since } }, _count: { _all: true } }),
    // By the puzzle's day (indexed), like the site's own daily games.
    db().$queryRaw<DayCount[]>`
      SELECT "day", COUNT(DISTINCT "discordUserId")::int AS "value"
      FROM "DailyResult" WHERE "day" >= ${days[0]}
      GROUP BY "day"`,
    db().vote.count({ where: { createdAt: { gte: since } } }),
  ]);

  const { total, errors, p95 } = overall[0] ?? { total: 0, errors: 0, p95: 0 };
  const status = Object.fromEntries(deliveries.map((d) => [d.status, d._count._all])) as Record<string, number>;

  return {
    window,
    servers: {
      active,
      left,
      biggest,
      locales: locales.map((l) => ({ locale: l.locale, count: l._count._all })).sort((a, b) => b.count - a.count),
      joins: fillDays(joins, days),
      leaves: fillDays(leaves, days),
    },
    commands: {
      total,
      errorRate: total ? errors / total : 0,
      p95,
      top: byCommand,
      perDay: fillDays(commandsPerDay, windowDays),
    },
    announcements: { sent: status.sent ?? 0, failed: (status.failed ?? 0) + (status.forbidden ?? 0) },
    daily: { playersPerDay: fillDays(players, days) },
    votes,
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
