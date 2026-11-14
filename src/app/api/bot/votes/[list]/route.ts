import { db } from "@/lib/db";
import { botConfig } from "@/lib/bot/config";
import { ok, refusal } from "@/lib/bot/internal";
import { ReplayGuard } from "@/lib/bot/signature";
import {
  authorizationMatches,
  dblVote,
  MIN_WEBHOOK_SECRET,
  TOPGG_SIGNATURE_HEADER,
  topggVote,
  verifyTopggSignature,
} from "@/lib/bot/votes";
import { logError } from "@/lib/log";
import { addressOf, limitByMinute } from "@/lib/push-server";
import { readCapped } from "@/lib/read-body";

/**
 * Vote webhooks of the bot lists (`/api/bot/votes/topgg`, `/api/bot/votes/dbl`),
 * verified as each list documents it (`src/lib/bot/votes.ts`): top.gg's v1
 * HMAC signature when the request carries one, otherwise the secret in
 * `Authorization` (top.gg legacy, discordbotlist.com). Nothing is parsed
 * before the request is authenticated. A vote only counts for the admin
 * statistics: the bot is free, there is nothing to unlock.
 *
 * Without the bot, or without that list's secret, the route does not exist.
 * Every authentication failure answers the same 401.
 */
export const dynamic = "force-dynamic";

const LISTS = {
  topgg: { secret: () => process.env.TOPGG_WEBHOOK_SECRET?.trim() ?? "", voter: topggVote },
  dbl: { secret: () => process.env.DBL_WEBHOOK_SECRET?.trim() ?? "", voter: dblVote },
} as const;

const allowed = limitByMinute(60);
const replays = new ReplayGuard();
const MAX_BODY = 4 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ list: string }> }) {
  const { list } = await params;
  const entry = Object.hasOwn(LISTS, list) ? LISTS[list as keyof typeof LISTS] : null;
  const secret = entry?.secret() ?? "";
  if (!entry || !botConfig() || secret.length < MIN_WEBHOOK_SECRET) return refusal(404, "not found");
  if (!allowed(addressOf(request))) return refusal(429, "too many requests");

  const signed = list === "topgg" ? request.headers.get(TOPGG_SIGNATURE_HEADER) : null;
  // The shared-secret header can be checked before reading anything.
  if (!signed && !authorizationMatches(request.headers.get("authorization"), secret)) return refusal(401, "unauthorized");
  const raw = await readCapped(request, MAX_BODY);
  if (raw === null) return refusal(413, "body too large");

  let replayKey: string | null = null;
  if (signed) {
    const verdict = verifyTopggSignature(signed, raw, secret);
    if (!verdict.ok || !replays.accept(verdict.signature, Math.floor(Date.now() / 1000))) return refusal(401, "unauthorized");
    replayKey = verdict.signature;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return refusal(400, "invalid vote");
  }
  const parsed = entry.voter.safeParse(json);
  if (!parsed.success) return refusal(400, "invalid vote");
  const user = parsed.data;
  // A test event from the list's settings page: acknowledged, not counted.
  if (!user) return ok({ ok: true });
  try {
    await db().vote.create({ data: { list, discordUserId: user } });
    return ok({ ok: true });
  } catch (error) {
    // Not stored: the list retries with the same signature, let it through then.
    if (replayKey) replays.forget(replayKey);
    await logError("discord bot: vote failed", error);
    return refusal(503, "storage unavailable");
  }
}
