import { db } from "@/lib/db";
import { ok, readSigned, refusal, withDatabase } from "@/lib/bot/internal";
import { PERIODS, periodStart, rank, type Period } from "@/lib/bot/leaderboard";
import { isSnowflake } from "@/lib/bot/public";
import { DAILY_GAMES, type DailyGame } from "@/lib/bot/settings";
import { dayUtc, isValidDay } from "@/lib/quiz";

/** A server's leaderboard: `?guild=&game=&period=day|week|all[&day=YYYY-MM-DD]`. Top ten. */
export const dynamic = "force-dynamic";

/** All time is read as the last year: enough for a leaderboard, bounded for the database. */
const ALL_TIME_DAYS = 366;

export async function GET(request: Request) {
  const gate = await readSigned(request, null);
  if (gate instanceof Response) return gate;
  const q = gate.url.searchParams;
  const guild = q.get("guild") ?? "";
  const game = q.get("game") ?? "";
  const period = q.get("period") ?? "day";
  const day = q.get("day") ?? dayUtc(new Date());
  if (!isSnowflake(guild) || !(DAILY_GAMES as readonly string[]).includes(game)) return refusal(400, "invalid server or game");
  if (!(PERIODS as readonly string[]).includes(period) || !isValidDay(day)) return refusal(400, "invalid period or day");

  return withDatabase("leaderboard", async () => {
    const start = periodStart(period as Period, day) ?? new Date(Date.parse(`${day}T00:00:00Z`) - ALL_TIME_DAYS * 86_400_000).toISOString().slice(0, 10);
    const rows = await db().dailyResult.findMany({
      where: { guildId: guild, game, day: { gte: start, lte: day } },
      select: { discordUserId: true, discordUserName: true, day: true, score: true },
      take: 50_000,
    });
    return ok({ game, period, day, entries: rank(game as DailyGame, rows) });
  });
}
