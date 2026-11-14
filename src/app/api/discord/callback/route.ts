import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { botConfig } from "@/lib/bot/config";
import { redirectUri, refused, siteOrigin } from "@/lib/bot/dashboard-guard";
import { acceptCallback, identify, loginTarget } from "@/lib/bot/oauth";
import { cookieOptions, OAUTH_COOKIE, OAUTH_PATH, openOAuth, sealSession, SESSION_COOKIE, SESSION_TTL_S } from "@/lib/bot/session";
import { logError } from "@/lib/log";
import { addressOf, limitByMinute } from "@/lib/push-server";

/**
 * Discord sends the user back here. The state must match the sealed one
 * (constant-time comparison), the code is traded with the PKCE verifier, the
 * user is read, and the token is let go. The session cookie then holds the
 * id, name and avatar hash only.
 *
 * Whatever happens, the redirect goes to one of the site's own pages: the
 * dashboard (or the admin panel) in the language the login started from,
 * with `?login=failed` when it did not work out.
 */
export const dynamic = "force-dynamic";

const allowed = limitByMinute(20);

export async function GET(request: Request) {
  const config = botConfig();
  if (!config) return refused(404, "not found");
  if (!allowed(addressOf(request))) return refused(429, "too many requests");

  const jar = await cookies();
  const pending = openOAuth(config, jar.get(OAUTH_COOKIE)?.value);
  const back = (failed: boolean) => {
    const target = new URL(loginTarget(pending?.locale, pending?.next), siteOrigin(request));
    if (failed) target.searchParams.set("login", "failed");
    const response = NextResponse.redirect(target, 303);
    response.headers.set("Cache-Control", "private, no-store");
    // Single use: the state and verifier go, whatever the outcome.
    response.cookies.set(OAUTH_COOKIE, "", cookieOptions(0, OAUTH_PATH));
    return response;
  };

  const accepted = acceptCallback(pending, new URL(request.url).searchParams);
  if (!accepted) return back(true);

  try {
    const user = await identify({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: redirectUri(request),
      code: accepted.code,
      verifier: accepted.verifier,
    });
    if (!user) return back(true);
    // A new sealed value at every login (fresh IV, fresh expiry): whatever
    // session cookie the browser held before is replaced, never extended.
    const response = back(false);
    response.cookies.set(
      SESSION_COOKIE,
      sealSession(config, { id: user.id, name: (user.global_name || user.username).slice(0, 64), avatar: user.avatar ?? null }),
      cookieOptions(SESSION_TTL_S),
    );
    return response;
  } catch (error) {
    await logError("discord login failed", error);
    return back(true);
  }
}
