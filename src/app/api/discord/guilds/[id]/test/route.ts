import { z } from "zod";
import { BotUnavailable, canManage, guildChannels, testPost } from "@/lib/bot/client";
import { answer, guardDashboard, refused } from "@/lib/bot/dashboard-guard";
import { isSnowflake } from "@/lib/bot/public";
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
  if (!isSnowflake(id)) return refused(400, "invalid server id");
  if (!perUser(gate.user.id)) return refused(429, "too many requests");
  try {
    if (!(await canManage(gate.config, id, gate.user.id))) return refused(403, "not allowed");
    const { channels } = await guildChannels(gate.config, id);
    if (!channels.some((c) => c.id === gate.body.channelId)) return refused(400, "unknown channel");
    const result = await testPost(gate.config, id, gate.body.channelId, gate.body.locale);
    return answer({ ok: result.ok });
  } catch (error) {
    if (error instanceof BotUnavailable) return refused(503, "bot unavailable");
    throw error;
  }
}
