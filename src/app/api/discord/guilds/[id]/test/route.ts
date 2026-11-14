import { z } from "zod";
import { BotUnavailable, testPost } from "@/lib/bot/client";
import { answer, authorizeGuild, guardDashboard, refused } from "@/lib/bot/dashboard-guard";
import { logError } from "@/lib/log";
import { snowflake } from "@/lib/bot/settings";
import { LOCALES } from "@/i18n/config";
import { limitByMinute } from "@/lib/push-server";

/**
 * "Send a test" button: the bot posts a sample message in the chosen
 * channel, if this user may manage the server and the channel is one the
 * bot reported. A few per minute per user: a test, not a spam tool.
 */
export const dynamic = "force-dynamic";

const body = z.object({ channelId: snowflake, locale: z.enum(LOCALES) }).strict();
const perUser = limitByMinute(5);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardDashboard(request, body);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  if (!perUser(gate.user.id)) return refused(429, "too many requests");
  try {
    const lists = await authorizeGuild(gate.config, id, gate.user.id);
    if (lists instanceof Response) return lists;
    if (!lists.channels.some((c) => c.id === gate.body.channelId)) return refused(400, "unknown channel");
    const result = await testPost(gate.config, id, gate.body.channelId, gate.body.locale);
    return answer({ ok: result.ok });
  } catch (error) {
    if (error instanceof BotUnavailable) return refused(503, "bot unavailable");
    await logError("discord dashboard: test post failed", error, { guild: id });
    return refused(503, "unavailable");
  }
}
