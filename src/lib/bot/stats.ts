import { db } from "@/lib/db";

/**
 * Super admin figures. The aggregation helpers are pure (tested); the
 * queries read with Prisma's query builder only, no SQL built from strings.
 *
 * Commands are counted over a window (24 h, 7 d, 30 d): a month of command
 * logs is at most a few hundred thousand small rows, read with the columns
 * needed and aggregated here.
 */

export const WINDOWS = { "24h": 1, "7d": 7, "30d": 30 } as const;
export type StatsWindow = keyof typeof WINDOWS;
export const isWindow = (w: string | undefined): w is StatsWindow => !!w && w in WINDOWS;

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

/** Count per UTC day, every day of the range present (zero when nothing happened). */
export function perDay(dates: Date[], days: string[]): { day: string; value: number }[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const date of dates) {
    const key = date.toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return days.map((day) => ({ day, value: counts.get(day)! }));
}

export interface CommandFigures {
  command: string;
  count: number;
  errors: number;
  p95: number;
}

export function commandFigures(rows: { command: string; ok: boolean; durationMs: number }[]): CommandFigures[] {
  const groups = new Map<string, { count: number; errors: number; durations: number[] }>();
  for (const r of rows) {
    const g = groups.get(r.command) ?? { count: 0, errors: 0, durations: [] };
    g.count += 1;
    if (!r.ok) g.errors += 1;
    g.durations.push(r.durationMs);
    groups.set(r.command, g);
  }
  return [...groups]
    .map(([command, g]) => ({ command, count: g.count, errors: g.errors, p95: percentile(g.durations, 95) }))
    .sort((a, b) => b.count - a.count || a.command.localeCompare(b.command));
}

export async function adminStats(window: StatsWindow, now = new Date()) {
  const since = new Date(now.getTime() - WINDOWS[window] * 86_400_000);
  const month = new Date(now.getTime() - 30 * 86_400_000);
  const days = daysBetween(month, now);
  const windowDays = daysBetween(since, now);

  const [active, left, biggest, locales, joins, leaves, commands, deliveries, players, votes] = await Promise.all([
    db().guild.count({ where: { leftAt: null } }),
    db().guild.count({ where: { leftAt: { not: null } } }),
    db().guild.findMany({
      where: { leftAt: null },
      orderBy: { memberCount: "desc" },
      take: 10,
      select: { id: true, name: true, icon: true, memberCount: true, locale: true },
    }),
    db().guild.groupBy({ by: ["locale"], where: { leftAt: null }, _count: { _all: true } }),
    db().guild.findMany({ where: { joinedAt: { gte: month } }, select: { joinedAt: true } }),
    db().guild.findMany({ where: { leftAt: { gte: month } }, select: { leftAt: true } }),
    db().commandLog.findMany({ where: { createdAt: { gte: since } }, select: { command: true, ok: true, durationMs: true, createdAt: true } }),
    db().delivery.groupBy({ by: ["status"], where: { sentAt: { gte: since } }, _count: { _all: true } }),
    db().dailyResult.findMany({ where: { createdAt: { gte: month } }, select: { day: true, discordUserId: true } }),
    db().vote.count({ where: { createdAt: { gte: since } } }),
  ]);

  const byCommand = commandFigures(commands);
  const total = commands.length;
  const errors = commands.filter((c) => !c.ok).length;
  const playersPerDay = days.map((day) => ({
    day,
    value: new Set(players.filter((p) => p.day === day).map((p) => p.discordUserId)).size,
  }));
  const status = Object.fromEntries(deliveries.map((d) => [d.status, d._count._all])) as Record<string, number>;

  return {
    window,
    servers: {
      active,
      left,
      biggest,
      locales: locales.map((l) => ({ locale: l.locale, count: l._count._all })).sort((a, b) => b.count - a.count),
      joins: perDay(joins.map((j) => j.joinedAt), days),
      leaves: perDay(leaves.flatMap((l) => (l.leftAt ? [l.leftAt] : [])), days),
    },
    commands: {
      total,
      errorRate: total ? errors / total : 0,
      p95: percentile(commands.map((c) => c.durationMs), 95),
      top: byCommand.slice(0, 15),
      perDay: perDay(commands.map((c) => c.createdAt), windowDays),
    },
    announcements: { sent: status.sent ?? 0, failed: (status.failed ?? 0) + (status.forbidden ?? 0) },
    daily: { playersPerDay },
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
