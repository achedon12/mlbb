import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { databaseConfigured } from "@/lib/db";
import { ok, readSigned, refusal, withDatabase, NO_STORE } from "@/lib/bot/internal";
import { cardAccess, isDiscordId, profileDiscordKey } from "@/lib/discord-profile/access";
import { cardPng } from "@/lib/discord-profile/render-cache";
import { cardByDiscord } from "@/lib/discord-profile/store";
import { logError } from "@/lib/log";
import { limitByMinute } from "@/lib/push-server";

/**
 * The /profile card of a Discord member, for the bot:
 * `?user=<discord id>&viewer=<discord id>&locale=<site language>`, signed.
 * `user` is whose card, `viewer` who typed the command (see `cardAccess`).
 *
 * Answers the PNG itself (`image/png`), or `{ reason }` in JSON when there
 * is no card to show: `notLinked` and `stale` (to the owner), `unavailable`
 * (someone else's card, linked or not, which is not told), `rateLimited`.
 * The ids are hashed before the lookup and never stored by this route.
 */
export const dynamic = "force-dynamic";

/** Per member typing the command: enough to post it, not to spam it. */
const perViewer = limitByMinute(4);

export async function GET(request: Request) {
  const gate = await readSigned(request, null);
  if (gate instanceof Response) return gate;
  if (!databaseConfigured()) return refusal(404, "not found");
  const q = gate.url.searchParams;
  const user = q.get("user");
  const viewer = q.get("viewer");
  const locale = q.get("locale") ?? "en";
  if (!isDiscordId(user) || !isDiscordId(viewer) || !isLocale(locale)) return refusal(400, "invalid request");
  if (!perViewer(viewer)) return ok({ reason: "rateLimited" });

  return withDatabase("profile card", async () => {
    const card = await cardByDiscord(profileDiscordKey(user));
    const access = cardAccess({ viewer, target: user, row: card, now: Date.now() });
    if (!access.ok) return ok({ reason: access.reason });
    if (!card?.snapshot) return ok({ reason: access.own ? "stale" : "unavailable" });
    let png: Buffer;
    try {
      png = await cardPng(card, locale);
    } catch (error) {
      await logError("discord bot: profile card drawing failed", error);
      return refusal(503, "drawing failed");
    }
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: { ...NO_STORE, "Content-Type": "image/png", "Content-Length": String(png.length) },
    });
  });
}
