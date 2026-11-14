import { z } from "zod";
import { db } from "@/lib/db";
import { botConfig } from "@/lib/bot/config";
import { ok, refusal, withDatabase } from "@/lib/bot/internal";
import { addressOf, limitByMinute, sameSecret } from "@/lib/push-server";

/**
 * Vote webhooks of the bot lists (`/api/bot/votes/topgg`, `/api/bot/votes/dbl`).
 * Both lists send the secret typed in their settings as the `Authorization`
 * header, compared in constant time. A vote only counts for the admin
 * statistics: the bot is free, there is nothing to unlock.
 *
 * Without the bot, or without that list's secret, the route does not exist.
 */
export const dynamic = "force-dynamic";

const LISTS = {
  topgg: {
    secret: () => process.env.TOPGG_WEBHOOK_SECRET?.trim() ?? "",
    // { bot, user, type: "upvote" | "test", isWeekend, query }
    voter: z.object({ user: z.string().regex(/^\d{17,20}$/), type: z.string().max(16) }).transform((v) => (v.type === "test" ? null : v.user)),
  },
  dbl: {
    secret: () => process.env.DBL_WEBHOOK_SECRET?.trim() ?? "",
    // { id, username, avatar, admin }
    voter: z.object({ id: z.string().regex(/^\d{17,20}$/) }).transform((v) => v.id),
  },
} as const;

const allowed = limitByMinute(60);
const MAX_BODY = 4 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ list: string }> }) {
  const { list } = await params;
  const entry = LISTS[list as keyof typeof LISTS];
  const secret = entry?.secret() ?? "";
  if (!entry || !botConfig() || secret.length < 16) return refusal(404, "not found");
  if (!allowed(addressOf(request))) return refusal(429, "too many requests");
  if (!sameSecret(request.headers.get("authorization") ?? "", secret)) return refusal(401, "unauthorized");
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY) return refusal(413, "body too large");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return refusal(400, "invalid JSON");
  }
  const parsed = entry.voter.safeParse(json);
  if (!parsed.success) return refusal(400, "invalid vote");
  const user = parsed.data;
  // A test vote from the list's settings page: acknowledged, not counted.
  if (!user) return ok({ ok: true });
  return withDatabase("vote", async () => {
    await db().vote.create({ data: { list, discordUserId: user } });
    return ok({ ok: true });
  });
}
