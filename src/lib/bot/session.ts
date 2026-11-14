import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import type { BotConfig } from "./config";
import { seal, unseal } from "./seal";

/**
 * Dashboard session: who logged in with Discord, in a sealed cookie
 * (httpOnly, Secure, SameSite=Lax, 7 days). Nothing on the server side, and
 * nothing Discord issued: the id, the display name and the avatar hash.
 *
 * The OAuth exchange keeps its state and PKCE verifier in a second sealed
 * cookie, ten minutes long, scoped to the callback route.
 */

export const SESSION_COOKIE = "mlbbdex_discord";
export const OAUTH_COOKIE = "mlbbdex_discord_oauth";
export const SESSION_TTL_S = 7 * 24 * 3600;
export const OAUTH_TTL_S = 10 * 60;
/** The OAuth cookie is only ever sent to the callback. */
export const OAUTH_PATH = "/api/discord/callback";

export const sessionShape = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  name: z.string().min(1).max(64),
  avatar: z.string().max(64).nullable(),
});
export type DiscordSession = z.infer<typeof sessionShape>;

/** Where the login comes back to: a fixed page of the site, never an address from the request. */
export const oauthShape = z.object({
  state: z.string(),
  verifier: z.string(),
  locale: z.enum(LOCALES),
  next: z.enum(["dashboard", "admin"]),
});
export type OAuthPending = z.infer<typeof oauthShape>;

export const cookieOptions = (maxAge: number, path = "/") =>
  ({ httpOnly: true, secure: true, sameSite: "lax", path, maxAge }) as const;

export function sealSession(config: Pick<BotConfig, "sessionSecret">, session: DiscordSession): string {
  return seal(config.sessionSecret, "session", session, SESSION_TTL_S);
}

export function openSession(config: Pick<BotConfig, "sessionSecret">, value: string | undefined): DiscordSession | null {
  const parsed = sessionShape.safeParse(unseal(config.sessionSecret, "session", value));
  return parsed.success ? parsed.data : null;
}

export function openOAuth(config: Pick<BotConfig, "sessionSecret">, value: string | undefined): OAuthPending | null {
  const parsed = oauthShape.safeParse(unseal(config.sessionSecret, "oauth", value));
  return parsed.success ? parsed.data : null;
}

/** Current dashboard user, or null. Reading cookies makes the page dynamic. */
export async function currentDiscordUser(config: BotConfig): Promise<DiscordSession | null> {
  return openSession(config, (await cookies()).get(SESSION_COOKIE)?.value);
}
