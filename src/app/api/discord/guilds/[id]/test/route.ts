import { z } from "zod";
import { db } from "@/lib/db";
import { BotUnavailable, testPost } from "@/lib/bot/client";
import { answer, authorizeGuild, guardDashboard, refused } from "@/lib/bot/dashboard-guard";
import { logError } from "@/lib/log";
import { GREETING_KINDS, greetingText, snowflake } from "@/lib/bot/settings";
import { LOCALES } from "@/i18n/config";
import { limitByMinute } from "@/lib/push-server";

/**
 * "Send a test" button: the bot posts a sample message in the chosen
 * channel, if this user may manage the server and the channel is one the
 * bot reported. A few per minute per user: a test, not a spam tool.
 *
 * With a `kind`, the welcome or goodbye message instead, with the text
 * being edited (validated like a save): the dashboard user stands in for
 * the member, the server's name and size come from the database.
 */
export const dynamic = "force-dynamic";

const target = { channelId: snowflake, locale: z.enum(LOCALES) };
const body = z.union([
  z.object(target).strict(),
  z.object({ ...target, kind: z.enum(GREETING_KINDS), message: greetingText }).strict(),
]);
/** Discord avatar hash, as the bot checks it. */
const AVATAR = /^(a_)?[0-9a-f]{32}$/;
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
    let greeting: Parameters<typeof testPost>[4];
    if ("kind" in gate.body) {
      const guild = await db().guild.findUnique({ where: { id }, select: { name: true, memberCount: true, leftAt: true } });
      if (!guild || guild.leftAt) return refused(404, "unknown server");
      const { id: userId, name, avatar } = gate.user;
      greeting = {
        kind: gate.body.kind,
        message: gate.body.message,
        member: { id: userId, username: name, avatar: avatar && AVATAR.test(avatar) ? avatar : null },
        guildName: guild.name,
        memberCount: guild.memberCount,
      };
    }
    const result = await testPost(gate.config, id, gate.body.channelId, gate.body.locale, greeting);
    return answer({ ok: result.ok });
  } catch (error) {
    if (error instanceof BotUnavailable) return refused(503, "bot unavailable");
    await logError("discord dashboard: test post failed", error, { guild: id });
    return refused(503, "unavailable");
  }
}
