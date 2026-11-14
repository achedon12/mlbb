import { z } from "zod";
import { db } from "@/lib/db";
import { ok, readSigned, withDatabase } from "@/lib/bot/internal";
import { ANNOUNCEMENT_TYPES, snowflake, type AnnouncementType } from "@/lib/bot/settings";

/**
 * Delivery outcomes, after the bot's own retries. A recorded delivery is
 * never offered again. `forbidden` (the bot lost the right to post in that
 * channel) also marks the server's setting for that type as failing: the
 * dashboard shows it, and nothing is attempted there until the settings
 * are saved again.
 */
export const dynamic = "force-dynamic";

const body = z
  .array(
    z.object({
      announcementId: z.number().int().positive(),
      guildId: snowflake,
      status: z.enum(["sent", "failed", "forbidden"]),
      messageId: snowflake.optional(),
      error: z.string().max(1_000).optional(),
    }),
  )
  .max(500);

export async function POST(request: Request) {
  const gate = await readSigned(request, body);
  if (gate instanceof Response) return gate;
  const reports = gate.body;
  return withDatabase("deliveries", async () => {
    if (!reports.length) return ok({ stored: 0 });
    // Only known announcements and servers: a stale report is dropped, not a foreign key error.
    const [announcements, guilds] = await Promise.all([
      db().announcement.findMany({ where: { id: { in: reports.map((r) => r.announcementId) } }, select: { id: true, type: true } }),
      db().guild.findMany({ where: { id: { in: reports.map((r) => r.guildId) } }, select: { id: true } }),
    ]);
    const types = new Map(announcements.map((a) => [a.id, a.type]));
    const known = new Set(guilds.map((g) => g.id));
    let stored = 0;
    for (const r of reports) {
      const type = types.get(r.announcementId);
      if (!type || !known.has(r.guildId)) continue;
      const data = { status: r.status, messageId: r.messageId ?? null, error: r.error?.slice(0, 300) ?? null, sentAt: new Date() };
      await db().delivery.upsert({
        where: { announcementId_guildId: { announcementId: r.announcementId, guildId: r.guildId } },
        create: { announcementId: r.announcementId, guildId: r.guildId, ...data },
        update: data,
      });
      if (r.status === "forbidden" && (ANNOUNCEMENT_TYPES as readonly string[]).includes(type)) {
        await db().guildSettings.updateMany({
          where: { guildId: r.guildId },
          data: { [`${type as AnnouncementType}Failing`]: true },
        });
      }
      stored += 1;
    }
    return ok({ stored });
  });
}
