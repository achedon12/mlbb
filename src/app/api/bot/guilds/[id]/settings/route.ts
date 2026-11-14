import { db } from "@/lib/db";
import { ok, readSigned, refusal, withDatabase } from "@/lib/bot/internal";
import { isSnowflake } from "@/lib/bot/public";
import { settingsView } from "@/lib/bot/settings";

/** A server's settings, the defaults when it never saved any. Unknown server: 404. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await readSigned(request, null);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  if (!isSnowflake(id)) return refusal(400, "invalid server id");
  return withDatabase("settings read", async () => {
    const guild = await db().guild.findUnique({ where: { id }, include: { settings: true } });
    if (!guild) return refusal(404, "unknown server");
    return ok(settingsView(guild.id, guild.locale, guild.settings));
  });
}
