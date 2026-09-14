import { cookies } from "next/headers";
import { cache } from "react";
import { expiration, profile, type Profile } from "./mlbb-auth";

/**
 * Game session.
 *
 * The token provided by the login service is stored in an httpOnly
 * cookie: it never leaves the server, and the site has no state to
 * keep on its side — no database, no sessions table. Logging
 * out means deleting the cookie; expiry is what the token says.
 */
const COOKIE = "mlbb_jeu";

export async function openSession(token: string): Promise<void> {
  const exp = expiration(token);
  const maxAge = exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : 60 * 60 * 24 * 7;

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function closeSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * Closes the session when allowed. During a page render,
 * cookies are read-only and Next refuses to touch them: the cookie then stays
 * in place, and the header's call to `/api/session` — a route
 * handler, which is allowed — will clear it along the way.
 */
async function closeIfPossible(): Promise<void> {
  try {
    await closeSession();
  } catch {
    // Page render: read-only cookie.
  }
}

/** Current token, or null. An expired token is treated as missing. */
export async function tokenCurrent(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const exp = expiration(token);
  if (exp && exp < Math.floor(Date.now() / 1000)) return null;

  return token;
}

/**
 * Session state.
 *
 * Account pages must distinguish an expired session — the user must
 * log in again — from a temporarily unavailable source — waiting is enough. The
 * token is only returned to the server code that calls the service; it has no business
 * in a client component's props.
 */
export type StateSession =
  | { state: "missing" }
  | { state: "expired" }
  | { state: "unavailable"; token: string }
  | { state: "ok"; token: string; profile: Profile };

/**
 * An "expired" response from the service — token revoked before its expiry —
 * closes the session along the way when allowed: the next render will see it
 * empty, without a dead token lingering in the cookie.
 */
async function readSession(): Promise<StateSession> {
  const token = await tokenCurrent();
  if (!token) return { state: "missing" };

  const result = await profile(token);
  if (result.etat === "expired") {
    await closeIfPossible();
    return { state: "expired" };
  }
  // Source unavailable: the session is kept, but the profile is not available.
  return result.etat === "ok" ? { state: "ok", token, profile: result.donnees } : { state: "unavailable", token };
}

/** Session state, read once per page render. */
export const sessionPlayer = cache(readSession);

/** Profile of the current session, or null. */
export async function profileCurrent(): Promise<Profile | null> {
  const session = await readSession();
  return session.state === "ok" ? session.profile : null;
}
