import { recordAnnouncements } from "@/lib/bot/announcement-store";
import { BotUnavailable, flushAnnouncements } from "@/lib/bot/client";
import { isSuperAdmin } from "@/lib/bot/config";
import { answer, guardDashboard, refused } from "@/lib/bot/dashboard-guard";
import { log, logError } from "@/lib/log";

/**
 * Super admin "flush announcements": detect again, then ask the bot to post
 * whatever is pending now. The admin list is checked on this request, not
 * remembered from the page that showed the button.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await guardDashboard(request, null);
  if (gate instanceof Response) return gate;
  // Same answer as for a missing route: the panel's existence is not advertised.
  if (!isSuperAdmin(gate.config, gate.user.id)) return refused(404, "not found");
  try {
    const created = await recordAnnouncements();
    await flushAnnouncements(gate.config);
    await log("info", "discord bot: announcements flushed by an admin", { admin: gate.user.id, created });
    return answer({ ok: true, created });
  } catch (error) {
    if (error instanceof BotUnavailable) return refused(503, "bot unavailable");
    await logError("discord bot: admin flush failed", error);
    return refused(503, "storage unavailable");
  }
}
