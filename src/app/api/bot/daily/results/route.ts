import { z } from "zod";
import { db } from "@/lib/db";
import { dailyDayAllowed } from "@/lib/bot/daily";
import { ok, readSigned, withDatabase } from "@/lib/bot/internal";
import { DAILY_GAMES, snowflake } from "@/lib/bot/settings";

/**
 * Daily game results in a server, for its leaderboards: one result or a
 * batch. `guesses` for MLBBdle, `points` for the quiz. The first result of a
 * player for a (server, day, game) is the one kept: playing again changes
 * nothing, as on the site.
 */
export const dynamic = "force-dynamic";

const result = z
  .object({
    guildId: snowflake,
    day: z.string().refine((d) => dailyDayAllowed(d)),
    game: z.enum(DAILY_GAMES),
    discordUserId: snowflake,
    discordUserName: z.string().min(1).max(64),
    guesses: z.number().int().min(1).max(500).optional(),
    points: z.number().int().min(0).max(100).optional(),
  })
  .refine((r) => (r.game === "quiz" ? r.points !== undefined : r.guesses !== undefined));

const body = z.union([result, z.array(result).max(100)]);

export async function POST(request: Request) {
  const gate = await readSigned(request, body);
  if (gate instanceof Response) return gate;
  const results = Array.isArray(gate.body) ? gate.body : [gate.body];
  return withDatabase("daily results", async () => {
    const { count } = await db().dailyResult.createMany({
      data: results.map((r) => ({
        guildId: r.guildId,
        day: r.day,
        game: r.game,
        discordUserId: r.discordUserId,
        discordUserName: r.discordUserName,
        score: (r.game === "quiz" ? r.points : r.guesses) ?? 0,
      })),
      skipDuplicates: true,
    });
    return ok({ stored: count });
  });
}
