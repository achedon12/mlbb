import { isLocale } from "@/i18n/config";
import { botConfig } from "@/lib/bot/config";
import { currentPlayer, type Player } from "@/lib/community-builds-server";
import { refused } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { cardAccess } from "@/lib/discord-profile/access";
import { cardPng } from "@/lib/discord-profile/render-cache";
import { cardByAccount } from "@/lib/discord-profile/store";
import { logError } from "@/lib/log";
import { addressOf, limitByMinute } from "@/lib/push-server";

/**
 * The signed-in player's own card, as the bot would post it: the preview of
 * the account page. `?locale=` picks the card's language. Only ever the
 * game account of this request's session; never cached by the browser
 * beyond the request (`?v=` in the page changes with the figures).
 */
export const dynamic = "force-dynamic";

const byAddress = limitByMinute(12);

export async function GET(request: Request) {
  if (!databaseConfigured() || !botConfig()) return refused(404, "not found");
  if (!byAddress(addressOf(request))) return refused(429, "too many requests");
  const locale = new URL(request.url).searchParams.get("locale") ?? "en";
  if (!isLocale(locale)) return refused(400, "invalid locale");
  const player: Player = await currentPlayer().catch((): Player => ({ status: "unavailable" }));
  if (player.status === "none") return refused(401, "sign in required");
  if (player.status !== "ok") return refused(503, "unavailable");

  try {
    const card = await cardByAccount(player.id);
    // The owner's own view: the same rules as /profile typed by its owner.
    if (!card?.snapshot || !cardAccess({ viewer: "self", target: "self", row: card, now: Date.now() }).ok) return refused(404, "no card");
    const png = await cardPng(card, locale);
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    await logError("profile card preview failed", error);
    return refused(503, "unavailable");
  }
}
