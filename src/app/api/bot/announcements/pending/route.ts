import { pendingAnnouncements } from "@/lib/bot/announcement-store";
import { ok, readSigned, withDatabase } from "@/lib/bot/internal";

/**
 * What the bot still has to post: each recent announcement with the servers
 * and channels that have not received it. At most 500 targets per answer:
 * the bot asks again once they are delivered.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await readSigned(request, null);
  if (gate instanceof Response) return gate;
  return withDatabase("pending announcements", async () => ok({ announcements: await pendingAnnouncements() }));
}
