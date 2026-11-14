import { z } from "zod";
import { guildEntry, syncGuilds } from "@/lib/bot/guild-store";
import { ok, readSigned, withDatabase } from "@/lib/bot/internal";

/**
 * The servers the bot is in. `full`: the complete list across every shard,
 * sent when the bot is ready; every server missing from it is marked as
 * left, so a full sync must never be one shard's share. Otherwise an update
 * of the servers listed. Up to 20,000 servers in one call (about 2 MB).
 */
export const dynamic = "force-dynamic";

const MAX_GUILDS = 20_000;
const body = z.object({ full: z.boolean(), guilds: z.array(guildEntry).max(MAX_GUILDS) });

export async function POST(request: Request) {
  const gate = await readSigned(request, body, 2 * 1024 * 1024);
  if (gate instanceof Response) return gate;
  return withDatabase("guild sync", async () => ok(await syncGuilds(gate.body.full, gate.body.guilds)));
}
