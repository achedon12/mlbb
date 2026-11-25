import { LOCALES } from "@/i18n/config";

/**
 * The account pages ask a visitor with no login at all to sign in, from the
 * proxy, before anything renders: a plain 307 to the login form. Left to the
 * page, the redirect came after the account's loading state had started to
 * stream, so the visitor got a 200 and a meta refresh instead.
 *
 * Only the cookies' presence is read here, never their content: a cookie
 * that is there but expired or forged still reaches the page, which checks
 * it and answers as before.
 */

/** The game session (`src/lib/session.ts`). */
export const GAME_COOKIE = "mlbb_jeu";
/** The Discord login (`src/lib/bot/session.ts`). */
export const DISCORD_COOKIE = "mlbbdex_discord";

/** Each gated page, and the logins that open it. */
const GATES: { page: RegExp; cookies: readonly string[] }[] = [
  // The account hub: a game session, or a Discord login alone.
  { page: new RegExp(`^/(${LOCALES.join("|")})/account/?$`), cookies: [GAME_COOKIE, DISCORD_COOKIE] },
  // The game profile: a game session only.
  { page: new RegExp(`^/(${LOCALES.join("|")})/account/profile/?$`), cookies: [GAME_COOKIE] },
];

/**
 * The login form's address for a gated page reached without any of its
 * logins, returning to the page once signed in; null when the page is not
 * gated or a login cookie is there.
 */
export function signInRedirect(pathname: string, hasCookie: (name: string) => boolean): string | null {
  for (const gate of GATES) {
    const match = gate.page.exec(pathname);
    if (!match) continue;
    if (gate.cookies.some(hasCookie)) return null;
    const locale = match[1];
    return `/${locale}/login?next=${encodeURIComponent(pathname.replace(/\/$/, ""))}`;
  }
  return null;
}
