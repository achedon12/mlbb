"use client";

/**
 * What `/api/session` answers: the game account, or else the Discord
 * login's name. `unavailable`: a game session whose profile the login service cannot give
 * right now (the nickname, when sent, is the last one it gave).
 */
export type Session = { connected: boolean; unavailable?: true; pseudo?: string; discord?: string };

let pending: Promise<Session> | null = null;

/**
 * The session for this page load, read once and shared by the header button
 * and the account sync, so a visitor costs one request, not one per user.
 */
export function readSession(): Promise<Session> {
  pending ??= fetch("/api/session", {
    cache: "no-store",
    credentials: "same-origin",
  })
    .then((r) => (r.ok ? (r.json() as Promise<Session>) : { connected: false }))
    .catch(() => {
      pending = null;
      return { connected: false };
    });
  return pending;
}

/** Signed in one way or the other: the only case where there is progress to sync. */
export const signedIn = (s: Session) => s.connected || Boolean(s.discord);
