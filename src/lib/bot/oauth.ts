import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/**
 * Discord OAuth2 for the dashboard login: authorization code flow with PKCE
 * (RFC 7636, S256) and a `state` value, scope `identify` only.
 *
 * The access token Discord returns is used once, to read who logged in, and
 * never stored nor returned: the session keeps the user id, name and avatar
 * hash, nothing Discord could honour.
 */

export const DISCORD_API = "https://discord.com/api/v10";
export const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
export const SCOPE = "identify";

const b64url = (buffer: Buffer) => buffer.toString("base64url");

/** 32 random bytes: a 43-character verifier, within RFC 7636's 43 to 128. */
export function createVerifier(): string {
  return b64url(randomBytes(32));
}

export function challengeOf(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

export function createState(): string {
  return b64url(randomBytes(24));
}

/** Verifier and state as generated above: base64url, fixed lengths. */
export const isVerifier = (v: string) => /^[A-Za-z0-9_-]{43,128}$/.test(v);
export const isState = (v: string) => /^[A-Za-z0-9_-]{32}$/.test(v);

export function authorizeUrl(o: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", o.clientId);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("redirect_uri", o.redirectUri);
  url.searchParams.set("state", o.state);
  url.searchParams.set("code_challenge", o.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/** Callback parameters: a code and the state, both bounded. */
export const callbackQuery = z.object({
  code: z.string().min(10).max(200).regex(/^[A-Za-z0-9_-]+$/),
  state: z.string().refine(isState),
});

export const discordUser = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  username: z.string().min(1).max(64),
  global_name: z.string().max(64).nullable().optional(),
  avatar: z.string().max(64).nullable().optional(),
});
export type DiscordUser = z.infer<typeof discordUser>;

const TIMEOUT_MS = 8_000;

/**
 * Trades the code for a token, reads the user with it, and lets the token
 * go: it leaves this function only as the user it identified.
 */
export async function identify(o: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  verifier: string;
}): Promise<DiscordUser | null> {
  const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: o.code,
      redirect_uri: o.redirectUri,
      client_id: o.clientId,
      client_secret: o.clientSecret,
      code_verifier: o.verifier,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!tokenResponse.ok) return null;
  const token = z
    .object({ access_token: z.string().min(1).max(500), token_type: z.string().max(20) })
    .safeParse(await tokenResponse.json().catch(() => null));
  if (!token.success) return null;

  const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${token.data.access_token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!userResponse.ok) return null;
  const user = discordUser.safeParse(await userResponse.json().catch(() => null));
  return user.success ? user.data : null;
}
