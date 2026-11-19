import { botConfig } from "@/lib/bot/config";
import { seal, unseal } from "@/lib/bot/seal";
import { expiration } from "@/lib/mlbb-auth";

/**
 * The player's game token, kept with their card so /profile reads fresh
 * figures: sealed with AES-256-GCM (key from `BOT_SESSION_SECRET`, its own
 * purpose), and only until the token's own expiry, 7 days at most.
 */

const MAX_TTL_S = 7 * 86_400;

/** The sealed token, or null: no bot configuration, or a token already expired. */
export function sealGameToken(token: string, now = Date.now()): string | null {
  const config = botConfig();
  if (!config) return null;
  const exp = expiration(token);
  const ttl = Math.min(MAX_TTL_S, exp === null ? MAX_TTL_S : exp - Math.floor(now / 1000));
  if (ttl <= 0) return null;
  return seal(config.sessionSecret, "gameToken", { t: token }, ttl, now);
}

/** The token, or null: absent, tampered, sealed with another key, expired. */
export function openGameToken(sealed: string | null | undefined, now = Date.now()): string | null {
  const config = botConfig();
  if (!config || !sealed) return null;
  const value = unseal(config.sessionSecret, "gameToken", sealed, now) as { t?: unknown } | null;
  return typeof value?.t === "string" && value.t.length > 0 && value.t.length < 4000 ? value.t : null;
}
