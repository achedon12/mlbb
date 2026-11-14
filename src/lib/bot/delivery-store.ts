import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ANNOUNCEMENT_TYPES, type AnnouncementType } from "./settings";

export interface DeliveryReport {
  announcementId: number;
  guildId: string;
  status: "sent" | "failed" | "forbidden";
  messageId?: string;
  error?: string;
}

/**
 * Records a batch of delivery outcomes in a fixed number of statements,
 * whatever its size (up to 500 reports): two reads to drop the reports of
 * unknown announcements or servers (stale, not a foreign key error), one
 * `INSERT … ON CONFLICT DO UPDATE` for every delivery, and one update per
 * announcement type marking the servers whose channel became forbidden as
 * failing. All the writes in one transaction.
 *
 * A pair reported twice in one batch keeps its last report: one statement
 * may not touch a row twice. Returns how many deliveries were stored.
 */
export async function recordDeliveries(reports: DeliveryReport[]): Promise<number> {
  if (!reports.length) return 0;
  const [announcements, guilds] = await Promise.all([
    db().announcement.findMany({ where: { id: { in: [...new Set(reports.map((r) => r.announcementId))] } }, select: { id: true, type: true } }),
    db().guild.findMany({ where: { id: { in: [...new Set(reports.map((r) => r.guildId))] } }, select: { id: true } }),
  ]);
  const types = new Map(announcements.map((a) => [a.id, a.type]));
  const known = new Set(guilds.map((g) => g.id));
  const rows = [
    ...new Map(
      reports.filter((r) => types.has(r.announcementId) && known.has(r.guildId)).map((r) => [`${r.announcementId}|${r.guildId}`, r]),
    ).values(),
  ];
  if (!rows.length) return 0;

  const failing = new Map<AnnouncementType, Set<string>>();
  for (const r of rows) {
    const type = types.get(r.announcementId);
    if (r.status !== "forbidden" || !(ANNOUNCEMENT_TYPES as readonly string[]).includes(type ?? "")) continue;
    const set = failing.get(type as AnnouncementType) ?? new Set<string>();
    set.add(r.guildId);
    failing.set(type as AnnouncementType, set);
  }

  await db().$transaction([
    db().$executeRaw`
      INSERT INTO "Delivery" ("announcementId", "guildId", "status", "messageId", "error", "sentAt")
      VALUES ${Prisma.join(
        rows.map((r) => Prisma.sql`(${r.announcementId}, ${r.guildId}, ${r.status}, ${r.messageId ?? null}, ${r.error?.slice(0, 300) ?? null}, now())`),
      )}
      ON CONFLICT ("announcementId", "guildId") DO UPDATE SET
        "status" = EXCLUDED."status",
        "messageId" = EXCLUDED."messageId",
        "error" = EXCLUDED."error",
        "sentAt" = EXCLUDED."sentAt"`,
    ...[...failing].map(([type, ids]) =>
      db().guildSettings.updateMany({ where: { guildId: { in: [...ids] } }, data: { [`${type}Failing`]: true } }),
    ),
  ]);
  return rows.length;
}
