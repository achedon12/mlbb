import { isLocale } from "@/i18n/config";
import { dailyDayAllowed, dailyPayload } from "@/lib/bot/daily";
import { ok, readSigned, refusal } from "@/lib/bot/internal";
import { dayUtc } from "@/lib/quiz";

/**
 * Today's games for Discord (`?day=YYYY-MM-DD&locale=fr`): the site's own
 * MLBBdle secrets and quiz rounds for that UTC day, with the rosters the bot
 * needs to check and offer answers. Same day range as the site's day files.
 * Only the bot may ask: it holds the answers.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await readSigned(request, null);
  if (gate instanceof Response) return gate;
  const day = gate.url.searchParams.get("day") ?? dayUtc(new Date());
  const locale = gate.url.searchParams.get("locale") ?? "en";
  if (!isLocale(locale) || !dailyDayAllowed(day)) return refusal(400, "invalid day or locale");
  const payload = dailyPayload(locale, day);
  return payload ? ok(payload) : refusal(404, "no puzzle that day");
}
