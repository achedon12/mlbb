import { guildInfo, upsertGuild } from "@/lib/bot/guild-store";
import { ok, readSigned, refusal, withDatabase } from "@/lib/bot/internal";
import { isSnowflake } from "@/lib/bot/public";

/** The bot was added to a server (or came back to it: its settings are still there). */
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await readSigned(request, guildInfo);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  if (!isSnowflake(id)) return refusal(400, "invalid server id");
  return withDatabase("guild join", async () => {
    await upsertGuild(id, gate.body);
    return ok({ ok: true });
  });
}
