/**
 * Server startup.
 *
 * Next calls `register()` once per startup. It announces the latest
 * patch to notification subscribers, if that has not been done yet: a
 * data sync arrives through a commit followed by a redeployment,
 * so a new patch always coincides with a startup. With the Discord bot
 * configured, it also records the announcements found in the data and
 * starts the bot's periodic chores (`src/lib/bot/startup.ts`), and schedules
 * the daily backup of its database (`src/lib/db-backup.ts`).
 *
 * Only the Node runtime is concerned (not the edge), never the build, and nothing
 * is loaded while the VAPID keys (or the bot variables) are missing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.BOT_API_SECRET && process.env.DATABASE_URL) {
    const { startBotChores } = await import("@/lib/bot/startup");
    startBotChores();
  }
  // Daily database backups (src/lib/db-backup.ts): in production, or in
  // development when a folder is named for them.
  if (process.env.DATABASE_URL && (process.env.NODE_ENV === "production" || process.env.BACKUP_DIR)) {
    const { startBackups } = await import("@/lib/db-backup");
    void startBackups().catch(() => undefined);
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const [{ notifyOnStartup }, { recentPatches }] = await Promise.all([
    import("@/lib/push-server"),
    import("@/lib/patch-tracking"),
  ]);
  // Without waiting: the server answers during the send, which never throws.
  void notifyOnStartup(recentPatches[0]);
}
