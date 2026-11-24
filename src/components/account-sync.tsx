"use client";

import { useEffect } from "react";
import { readSession, signedIn } from "@/lib/session-client";

/**
 * Keeps the player's progress in step with the account, from the layout:
 * one read when a page loads, then a save after each change. Renders
 * nothing. Signed out (most visitors), it stops at the session the header
 * reads anyway: no sync request, only the "signed out" state the sign-in
 * prompts wait for. The sync code is
 * loaded after the page, never in its way.
 */
export function AccountSync() {
  useEffect(() => {
    let stop: (() => void) | null = null;
    let live = true;
    readSession()
      .then(async (session) => ({
        session,
        m: await import("@/lib/account-sync-client"),
      }))
      .then(
        ({ session, m }) => {
          if (!live) return;
          if (signedIn(session)) stop = m.startAccountSync();
          else m.markSignedOut();
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
