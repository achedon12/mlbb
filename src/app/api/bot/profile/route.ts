import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { databaseConfigured } from "@/lib/db";
import { ok, readSigned, refusal, withDatabase, NO_STORE } from "@/lib/bot/internal";
import { cardAccess, isDiscordId, profileDiscordKey } from "@/lib/discord-profile/access";
import { cardPng } from "@/lib/discord-profile/render-cache";
import { accountId } from "@/lib/community-builds-server";
import { readCardFigures } from "@/lib/discord-profile/read";
import { cardByDiscord, cardToken, refreshCard, setCardToken, type StoredCard } from "@/lib/discord-profile/store";
import { openGameToken } from "@/lib/discord-profile/token";
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
 * The ids are hashed before the lookup and never stored by this route. The
 * figures are read again from the game first when over a minute old (`freshCard`).
 */
export const dynamic = "force-dynamic";

/** Figures younger than this are drawn as they are, without asking the game again. */
const FRESH_MS = 60_000;
/** The bot waits 20 s for the card: the game's services get a part of it. */
const READ_TIMEOUT_MS = 10_000;

/**
 * The card with figures read again from the game's services, with the token
 * kept with it, when they are over a minute old. The token expired (or
 * refused): it is forgotten, and the last figures are drawn. The services
 * down or too slow: the last figures too.
 */
async function freshCard(card: StoredCard): Promise<StoredCard> {
  if (!card.snapshot || Date.now() - card.snapshotAt.getTime() < FRESH_MS) return card;
  const token = openGameToken(await cardToken(card.discordKey));
  if (!token) return card;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), READ_TIMEOUT_MS);
  });
  const read = await Promise.race([readCardFigures(token, card.snapshot), late]).finally(() => clearTimeout(timer));
  if (read === null) return card;
  if (read.status === "expired") {
    await setCardToken(card.accountId, null);
    return card;
  }
  if (read.status !== "ok" || accountId(read.data.roleId, read.data.zoneId) !== card.accountId) return card;
  const now = new Date();
  await refreshCard(card.accountId, read.data, now);
  return { ...card, snapshot: read.data, snapshotAt: now };
}

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
    const key = profileDiscordKey(user);
    let card = await cardByDiscord(key);
    const access = cardAccess({ viewer, target: user, row: card, now: Date.now() });
    if (!access.ok) return ok({ reason: access.reason });
    if (card) card = await freshCard(card);
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
