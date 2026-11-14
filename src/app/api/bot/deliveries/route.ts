import { z } from "zod";
import { recordDeliveries } from "@/lib/bot/delivery-store";
import { ok, readSigned, withDatabase } from "@/lib/bot/internal";
import { snowflake } from "@/lib/bot/settings";

/**
 * Delivery outcomes, after the bot's own retries. A recorded delivery is
 * never offered again. `forbidden` (the bot lost the right to post in that
 * channel) also marks the server's setting for that type as failing: the
 * dashboard shows it, and nothing is attempted there until the settings
 * are saved again.
 */
export const dynamic = "force-dynamic";

export const deliveriesBody = z
  .array(
    z.object({
      // The bot carries announcement ids as strings (its schema accepts
      // either form): both are read as the integer they are.
      announcementId: z.union([z.number().int().positive(), z.string().regex(/^[1-9]\d{0,9}$/).transform(Number)]),
      guildId: snowflake,
      status: z.enum(["sent", "failed", "forbidden"]),
      messageId: snowflake.optional(),
      error: z.string().max(1_000).optional(),
    }),
  )
  .max(500);

export async function POST(request: Request) {
  const gate = await readSigned(request, deliveriesBody);
  if (gate instanceof Response) return gate;
  return withDatabase("deliveries", async () => ok({ stored: await recordDeliveries(gate.body) }));
}
