import { NextResponse } from "next/server";
import { z } from "zod";
import { botConfig } from "@/lib/bot/config";
import { isSameOrigin } from "@/lib/bot/dashboard-guard";
import { accountId, currentPlayer, type Player } from "@/lib/community-builds-server";
import { answer, currentDiscordLogin, readJsonBody, refused, storageFailed } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { profileDiscordKey } from "@/lib/discord-profile/access";
import { readCardFigures } from "@/lib/discord-profile/read";
import { forgetCard } from "@/lib/discord-profile/render-cache";
import { cardByAccount, deleteCard, linkCard, refreshCard, setCardOptions } from "@/lib/discord-profile/store";
import { addressOf, limitByMinute } from "@/lib/push-server";
import { tokenCurrent } from "@/lib/session";

/**
 * The player's Discord profile card, from their account page.
 *
 * - POST `{ action: "link" }`: signed in with the game account and with
 *   Discord on this request, which proves both: links them and saves the
 *   figures read now from the game's services.
 * - POST `{ action: "refresh" }`: new figures for the card (game login).
 * - PATCH `{ public?, showId? }`: the card's two options (game login).
 * - DELETE: unlinks and deletes the card (game login: the game account's
 *   owner can always take it down, whichever Discord account it went to).
 *
 * Same origin required, rate limited per address and per account. Answers
 * `{ ok: true }`; 401 `sign in required` / `expired`, 409 `notLinked`,
 * 503 `unavailable` (the game's services) or `storage unavailable`.
 */
export const dynamic = "force-dynamic";

const byAddress = limitByMinute(20);
const byAccount = limitByMinute(6);

const postBody = z.object({ action: z.enum(["link", "refresh"]) });
const patchBody = z.object({ public: z.boolean().optional(), showId: z.boolean().optional() }).refine((b) => b.public !== undefined || b.showId !== undefined);

function gate(request: Request): NextResponse | null {
  if (!databaseConfigured() || !botConfig()) return refused(404, "not found");
  if (!isSameOrigin(request)) return refused(403, "origin refused");
  if (!byAddress(addressOf(request))) return refused(429, "too many requests");
  return null;
}

/** The signed-in game account's id, or the refusal. */
async function player(): Promise<string | NextResponse> {
  const p: Player = await currentPlayer().catch((): Player => ({ status: "unavailable" }));
  if (p.status === "none") return refused(401, "sign in required");
  if (p.status !== "ok") return refused(503, "unavailable");
  if (!byAccount(p.id)) return refused(429, "too many requests");
  return p.id;
}

export async function POST(request: Request) {
  const refusal = gate(request);
  if (refusal) return refusal;
  const body = await readJsonBody(request, postBody);
  if (body instanceof NextResponse) return body;
  const token = await tokenCurrent();
  if (!token) return refused(401, "sign in required");
  const discord = body.data.action === "link" ? await currentDiscordLogin() : null;
  if (body.data.action === "link" && !discord) return refused(401, "sign in required");

  const figures = await readCardFigures(token);
  if (figures.status === "expired") return refused(401, "expired");
  if (figures.status !== "ok") return refused(503, "unavailable");
  const account = accountId(figures.data.roleId, figures.data.zoneId);
  if (!byAccount(account)) return refused(429, "too many requests");

  try {
    if (discord) {
      const discordKey = profileDiscordKey(discord.id);
      await linkCard({ discordKey, accountId: account, snapshot: figures.data });
      forgetCard(discordKey);
      return answer({ ok: true });
    }
    return (await refreshCard(account, figures.data)) ? answer({ ok: true }) : refused(409, "notLinked");
  } catch (error) {
    return storageFailed("profile card save", error);
  }
}

export async function PATCH(request: Request) {
  const refusal = gate(request);
  if (refusal) return refusal;
  const id = await player();
  if (id instanceof NextResponse) return id;
  const body = await readJsonBody(request, patchBody);
  if (body instanceof NextResponse) return body;
  try {
    return (await setCardOptions(id, body.data)) ? answer({ ok: true }) : refused(409, "notLinked");
  } catch (error) {
    return storageFailed("profile card options", error);
  }
}

export async function DELETE(request: Request) {
  const refusal = gate(request);
  if (refusal) return refusal;
  const id = await player();
  if (id instanceof NextResponse) return id;
  try {
    const card = await cardByAccount(id);
    if (!card || !(await deleteCard(id))) return refused(409, "notLinked");
    forgetCard(card.discordKey);
    return answer({ ok: true });
  } catch (error) {
    return storageFailed("profile card delete", error);
  }
}
