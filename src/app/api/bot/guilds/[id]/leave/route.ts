import { z } from "zod";
import { leaveGuild } from "@/lib/bot/guild-store";
import { ok, readSigned, refusal, withDatabase } from "@/lib/bot/internal";
import { isSnowflake } from "@/lib/bot/public";

/** The bot left a server: kept 30 days, then deleted (see `purgeExpired`). */
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await readSigned(request, z.object({}).passthrough());
  if (gate instanceof Response) return gate;
  const { id } = await params;
  if (!isSnowflake(id)) return refusal(400, "invalid server id");
  return withDatabase("guild leave", async () => {
    await leaveGuild(id);
    return ok({ ok: true });
  });
}
