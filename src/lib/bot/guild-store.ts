import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { asLocale, snowflake } from "./settings";

/**
 * Servers the bot is in, as it reports them: full sync when it connects,
 * join and leave as they happen. A server the bot left keeps its rows for
 * 30 days (a re-invite finds its settings again), then everything about it
 * is deleted.
 */

export const RETENTION_DAYS = 30;
/** Command logs older than this are dropped: the admin panel reads 30 days at most. */
export const COMMAND_LOG_DAYS = 90;

export const guildInfo = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(64).nullable().optional(),
  memberCount: z.number().int().min(0).max(100_000_000),
  // Discord's preferred locale ("fr", "es-ES", "pt-BR"): mapped to a site language.
  locale: z.string().max(10),
});
export const guildEntry = guildInfo.extend({ id: snowflake });
export type GuildEntry = z.infer<typeof guildEntry>;

/** "es-ES" -> "es", "id" -> "id", "pt-BR" -> "en". */
export const siteLocaleOf = (discordLocale: string) => asLocale(discordLocale.slice(0, 2).toLowerCase());

/**
 * Creating a server keeps the locale Discord gives; updating it later never
 * touches the locale: it belongs to the dashboard from then on.
 */
export async function upsertGuild(id: string, info: z.infer<typeof guildInfo>): Promise<void> {
  await db().guild.upsert({
    where: { id },
    create: { id, name: info.name, icon: info.icon ?? null, memberCount: info.memberCount, locale: siteLocaleOf(info.locale) },
    update: { name: info.name, icon: info.icon ?? null, memberCount: info.memberCount, leftAt: null },
  });
}

/** Rows per statement: 5 parameters each, far below Postgres' 65,535. */
export const SYNC_CHUNK = 1_000;

export function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * The bot's list, in a few statements whatever its size: one
 * `INSERT … ON CONFLICT DO UPDATE` per thousand servers (a server listed
 * twice keeps its last entry: one statement may not touch a row twice),
 * and, for a full sync, one update marking every other server as left.
 * A row whose values did not change is not rewritten.
 *
 * Same rules as `upsertGuild`: a new server takes Discord's locale, a known
 * one keeps the dashboard's; a rejoin within the retention keeps its
 * settings and its first join date. Every value is a bound parameter.
 */
export async function syncGuilds(full: boolean, guilds: GuildEntry[]): Promise<{ synced: number; left: number }> {
  const unique = [...new Map(guilds.map((g) => [g.id, g])).values()];
  const statements = chunks(unique, SYNC_CHUNK).map(
    (part) => db().$executeRaw`
      INSERT INTO "Guild" ("id", "name", "icon", "memberCount", "locale", "updatedAt")
      VALUES ${Prisma.join(part.map((g) => Prisma.sql`(${g.id}, ${g.name}, ${g.icon ?? null}, ${g.memberCount}, ${siteLocaleOf(g.locale)}, now())`))}
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "icon" = EXCLUDED."icon",
        "memberCount" = EXCLUDED."memberCount",
        "leftAt" = NULL,
        "updatedAt" = now()
      WHERE "Guild"."name" IS DISTINCT FROM EXCLUDED."name"
         OR "Guild"."icon" IS DISTINCT FROM EXCLUDED."icon"
         OR "Guild"."memberCount" IS DISTINCT FROM EXCLUDED."memberCount"
         OR "Guild"."leftAt" IS NOT NULL`,
  );
  const ids = unique.map((g) => g.id);
  // One array parameter rather than one parameter per server.
  const leaving = full
    ? [db().$executeRaw`UPDATE "Guild" SET "leftAt" = now(), "updatedAt" = now() WHERE "leftAt" IS NULL AND NOT ("id" = ANY(${ids}::text[]))`]
    : [];
  const results = await db().$transaction([...statements, ...leaving]);
  return { synced: unique.length, left: full ? results[results.length - 1] : 0 };
}

export async function leaveGuild(id: string): Promise<void> {
  await db().guild.updateMany({ where: { id, leftAt: null }, data: { leftAt: new Date() } });
}

/** Retention: servers gone for 30 days (cascades to settings and deliveries), old command logs. */
export async function purgeExpired(now = new Date()): Promise<{ guilds: number; logs: number }> {
  const gone = await db().guild.findMany({
    where: { leftAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 86_400_000) } },
    select: { id: true },
    take: 1_000,
  });
  const ids = gone.map((g) => g.id);
  // Daily results have no foreign key to the server (a result may arrive
  // before the server's first sync): removed with it, explicitly.
  const [, guilds, logs] = await db().$transaction([
    db().dailyResult.deleteMany({ where: { guildId: { in: ids } } }),
    db().guild.deleteMany({ where: { id: { in: ids } } }),
    db().commandLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - COMMAND_LOG_DAYS * 86_400_000) } } }),
  ]);
  return { guilds: guilds.count, logs: logs.count };
}

/** Servers per page of the daily-post list. */
export const DAILY_PAGE = 1_000;

/**
 * Servers whose daily games post goes out at `hour` (UTC): present, with at
 * least one daily channel set. Ordered by id and paged with `after` (the
 * last id of the previous page), so the bot reads one hour's servers in a
 * few calls instead of every server's settings every hour.
 */
export async function dailyGuilds(hour: number, after: string | null) {
  const rows = await db().guildSettings.findMany({
    where: {
      dailyHourUtc: hour,
      guild: { leftAt: null },
      OR: [{ dailyMlbbdleChannelId: { not: null } }, { dailyQuizChannelId: { not: null } }],
      ...(after ? { guildId: { gt: after } } : {}),
    },
    orderBy: { guildId: "asc" },
    take: DAILY_PAGE + 1,
    select: { guildId: true, dailyMlbbdleChannelId: true, dailyQuizChannelId: true, guild: { select: { locale: true } } },
  });
  const page = rows.slice(0, DAILY_PAGE);
  return {
    hour,
    guilds: page.map((r) => ({
      guildId: r.guildId,
      locale: asLocale(r.guild.locale),
      dailyMlbbdleChannelId: r.dailyMlbbdleChannelId,
      dailyQuizChannelId: r.dailyQuizChannelId,
    })),
    next: rows.length > DAILY_PAGE ? page[page.length - 1].guildId : null,
  };
}
