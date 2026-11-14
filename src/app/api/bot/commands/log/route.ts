import { z } from "zod";
import { db } from "@/lib/db";
import { ok, readSigned, withDatabase } from "@/lib/bot/internal";
import { snowflake } from "@/lib/bot/settings";

/**
 * Command counts, buffered by the bot and flushed every 30 seconds. No user
 * id: which command, in which server, how long, whether it worked.
 */
export const dynamic = "force-dynamic";

const body = z
  .array(
    z.object({
      command: z.string().regex(/^[a-z0-9_-]{1,32}$/),
      guildId: snowflake.nullable(),
      locale: z.string().max(8),
      durationMs: z.number().int().min(0).max(600_000),
      ok: z.boolean(),
    }),
  )
  .max(500);

export async function POST(request: Request) {
  const gate = await readSigned(request, body);
  if (gate instanceof Response) return gate;
  return withDatabase("command log", async () => {
    const { count } = await db().commandLog.createMany({ data: gate.body });
    return ok({ stored: count });
  });
}
