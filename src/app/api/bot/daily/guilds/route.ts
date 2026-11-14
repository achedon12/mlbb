import { dailyGuilds } from "@/lib/bot/guild-store";
import { ok, readSigned, refusal, withDatabase } from "@/lib/bot/internal";
import { isSnowflake } from "@/lib/bot/public";

/**
 * Servers to post the daily games in at one UTC hour:
 * `?hour=0..23[&after=<last guild id of the previous page>]`, a thousand
 * per page, with their language and daily channels. The bot's hourly round
 * reads this instead of every server's settings.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await readSigned(request, null);
  if (gate instanceof Response) return gate;
  const hour = gate.url.searchParams.get("hour") ?? "";
  const after = gate.url.searchParams.get("after");
  if (!/^\d{1,2}$/.test(hour) || Number(hour) > 23) return refusal(400, "invalid hour");
  if (after !== null && !isSnowflake(after)) return refusal(400, "invalid cursor");
  return withDatabase("daily guilds", async () => ok(await dailyGuilds(Number(hour), after)));
}
