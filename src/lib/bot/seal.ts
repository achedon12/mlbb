import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Sealed cookie values: AES-256-GCM, key derived from `BOT_SESSION_SECRET`
 * with HKDF, one key per purpose (the session, the OAuth exchange), so a
 * value sealed for one can never be opened as the other. GCM authenticates
 * as it encrypts: a changed byte opens as nothing.
 *
 * Every sealed value carries its own expiry, checked on opening, on top of
 * the cookie's: a copied cookie stops working at the same time.
 */

export type Purpose = "session" | "oauth";

const keyOf = (secret: string, purpose: Purpose) =>
  Buffer.from(hkdfSync("sha256", secret, "mlbbdex-bot", `cookie:${purpose}`, 32));

export function seal(secret: string, purpose: Purpose, value: object, ttlS: number, now = Date.now()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret, purpose), iv);
  const plain = Buffer.from(JSON.stringify({ v: value, exp: Math.floor(now / 1000) + ttlS }));
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

/** The value, or null: tampered, sealed with another key or purpose, expired, malformed. */
export function unseal(secret: string, purpose: Purpose, sealed: string | undefined | null, now = Date.now()): unknown {
  if (!sealed || sealed.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(sealed)) return null;
  const raw = Buffer.from(sealed, "base64url");
  if (raw.length < 12 + 16 + 1) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyOf(secret, purpose), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(plain) as { v?: unknown; exp?: unknown };
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(now / 1000)) return null;
    return parsed.v ?? null;
  } catch {
    return null;
  }
}
