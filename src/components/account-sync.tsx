"use client";

import { useEffect } from "react";

/**
 * Keeps the player's progress in step with the account, from the layout:
 * one read when a page loads, then a save after each change. Renders
 * nothing; signed out, the one read answers "signed out" and nothing else
 * happens. The sync code is loaded after the page, never in its way.
 */
export function AccountSync() {
  useEffect(() => {
    let stop: (() => void) | null = null;
    let live = true;
    import("@/lib/account-sync-client").then(
      (m) => {
        if (live) stop = m.startAccountSync();
      },
      () => {
        /* offline, or a new deployment: the next page tries again */
      },
    );
    return () => {
      live = false;
      stop?.();
    };
  }, []);
  return null;
}
