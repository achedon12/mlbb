/**
 * Server startup.
 *
 * Next calls `register()` once per startup. It announces the latest
 * patch to notification subscribers, if that has not been done yet: a
 * data sync arrives through a commit followed by a redeployment,
 * so a new patch always coincides with a startup.
 *
 * Only the Node runtime is concerned (not the edge), never the build, and nothing
 * is loaded while the VAPID keys are missing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const [{ notifyOnStartup }, { recentPatches }] = await Promise.all([
    import("@/lib/push-server"),
    import("@/lib/patch-tracking"),
  ]);
  // Without waiting: the server answers during the send, which never throws.
  void notifyOnStartup(recentPatches[0]);
}
