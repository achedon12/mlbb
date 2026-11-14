import { z } from "zod";
import { db } from "@/lib/db";
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

/** A rejoin within the retention keeps the settings: the join date is that of the first arrival. */
export async function syncGuilds(full: boolean, guilds: GuildEntry[]): Promise<{ synced: number; left: number }> {
  for (const g of guilds) await upsertGuild(g.id, g);
  let left = 0;
  if (full) {
    const result = await db().guild.updateMany({
      where: { leftAt: null, id: { notIn: guilds.map((g) => g.id) } },
      data: { leftAt: new Date() },
    });
    left = result.count;
  }
  return { synced: guilds.length, left };
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
