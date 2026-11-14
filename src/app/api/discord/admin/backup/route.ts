import { isSuperAdmin } from "@/lib/bot/config";
import { answer, guardDashboard, refused } from "@/lib/bot/dashboard-guard";
import { runBackup } from "@/lib/db-backup";
import { log } from "@/lib/log";

/**
 * Super admin "back up now": the same dump and rotation as the daily one,
 * answered once written (a few seconds for this database). Same gate as the
 * flush: Origin and Sec-Fetch-Site, session, rate limit, then the admin
 * list, checked on this request.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await guardDashboard(request, null);
  if (gate instanceof Response) return gate;
  if (!isSuperAdmin(gate.config, gate.user.id)) return refused(404, "not found");
  await log("info", "database backup asked by an admin", { admin: gate.user.id });
  const result = await runBackup({ trigger: "admin" });
  if (result.ok) return answer({ ok: true, file: result.file, removed: result.removed });
  if (result.error === "already_running") return refused(409, "already running");
  // The reason is in the log; the page only needs to know it failed.
  return refused(500, "backup failed");
}
