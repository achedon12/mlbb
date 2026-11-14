import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { botConfig } from "@/lib/bot/config";
import { redirectUri, refused } from "@/lib/bot/dashboard-guard";
import { authorizeUrl, challengeOf, createState, createVerifier } from "@/lib/bot/oauth";
import { seal } from "@/lib/bot/seal";
import { cookieOptions, OAUTH_COOKIE, OAUTH_PATH, OAUTH_TTL_S, type OAuthPending } from "@/lib/bot/session";
import { addressOf, limitByMinute } from "@/lib/push-server";

/**
 * Starts the Discord login: a fresh state and PKCE verifier, sealed in a
 * short cookie scoped to `/api/discord`, then off to Discord's consent page.
 * `?locale=` and `?next=dashboard|admin|moderation` only choose which of the site's
 * own pages the callback returns to.
 */
export const dynamic = "force-dynamic";

const allowed = limitByMinute(20);

export async function GET(request: Request) {
  const config = botConfig();
  if (!config) return refused(404, "not found");
  if (!allowed(addressOf(request))) return refused(429, "too many requests");
  const query = new URL(request.url).searchParams;
  const locale = query.get("locale") ?? "en";
  const pending: OAuthPending = {
    state: createState(),
    verifier: createVerifier(),
    locale: isLocale(locale) ? locale : "en",
    next: query.get("next") === "admin" ? "admin" : query.get("next") === "moderation" ? "moderation" : "dashboard",
  };
  const response = NextResponse.redirect(
    authorizeUrl({ clientId: config.clientId, redirectUri: redirectUri(request), state: pending.state, challenge: challengeOf(pending.verifier) }),
  );
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(OAUTH_COOKIE, seal(config.sessionSecret, "oauth", pending, OAUTH_TTL_S), cookieOptions(OAUTH_TTL_S, OAUTH_PATH));
  return response;
}
