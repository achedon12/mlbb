import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed calls between the site and the bot, both ways (docs/discord-bot.md).
 *
 * Each request carries `X-MLBBDex-Timestamp` (unix seconds) and
 * `X-MLBBDex-Signature`: hex HMAC-SHA256 of
 * `${timestamp}.${METHOD}.${path}.${body}` with `BOT_API_SECRET`. The path is
 * the pathname and the query string exactly as sent; the body is the raw
 * text, empty for a GET. Signing the method, the path and the body binds the
 * signature to that one request: it cannot be moved to another route, and no
 * byte of the body can change.
 *
 * The receiver refuses a timestamp more than five minutes away, compares in
 * constant time, and remembers the signatures it accepted for as long as they
 * would stay valid: the same request played twice is refused the second time.
 */

export const HEADER_TIMESTAMP = "x-mlbbdex-timestamp";
export const HEADER_SIGNATURE = "x-mlbbdex-signature";
export const MAX_SKEW_S = 300;
/** Shorter secrets are refused outright: `openssl rand -hex 32` gives 64 characters. */
export const MIN_SECRET = 32;

export function sign(secret: string, timestamp: number, method: string, path: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${method.toUpperCase()}.${path}.${body}`).digest("hex");
}

/** Headers for an outgoing request. */
export function signedHeaders(secret: string, method: string, path: string, body: string, now = Date.now()): Record<string, string> {
  const timestamp = Math.floor(now / 1000);
  return {
    [HEADER_TIMESTAMP]: String(timestamp),
    [HEADER_SIGNATURE]: sign(secret, timestamp, method, path, body),
  };
}

export type Verdict = { ok: true } | { ok: false; reason: "no-secret" | "missing" | "skew" | "signature" | "replay" };

/**
 * Accepted signatures, until they expire. Bounded: past the cap, the oldest
 * go first (a Map keeps insertion order), which only matters under a flood
 * that the rate limits already cut.
 */
export class ReplayGuard {
  private seen = new Map<string, number>();
  constructor(private readonly max = 10_000) {}

  /** True the first time a signature is seen within its window. */
  accept(signature: string, nowS: number): boolean {
    for (const [key, until] of this.seen) {
      if (until >= nowS && this.seen.size < this.max) break;
      this.seen.delete(key);
    }
    if (this.seen.has(signature)) return false;
    this.seen.set(signature, nowS + 2 * MAX_SKEW_S);
    return true;
  }

  /** Lets a signature through again: its request failed before doing anything, the sender will retry it. */
  forget(signature: string): void {
    this.seen.delete(signature);
  }
}

export function verify(
  o: {
    secret: string | null | undefined;
    method: string;
    path: string;
    body: string;
    timestamp: string | null;
    signature: string | null;
    now?: number;
    guard?: ReplayGuard;
  },
): Verdict {
  if (!o.secret || o.secret.length < MIN_SECRET) return { ok: false, reason: "no-secret" };
  if (!o.timestamp || !o.signature) return { ok: false, reason: "missing" };
  if (!/^\d{1,12}$/.test(o.timestamp) || !/^[0-9a-f]{64}$/.test(o.signature)) return { ok: false, reason: "signature" };
  const nowS = Math.floor((o.now ?? Date.now()) / 1000);
  const timestamp = Number(o.timestamp);
  if (Math.abs(nowS - timestamp) > MAX_SKEW_S) return { ok: false, reason: "skew" };
  const expected = Buffer.from(sign(o.secret, timestamp, o.method, o.path, o.body), "hex");
  const given = Buffer.from(o.signature, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "signature" };
  if (o.guard && !o.guard.accept(o.signature, nowS)) return { ok: false, reason: "replay" };
  return { ok: true };
}

/** Path as signed: pathname and query string, as the request line carries them. */
export function signedPath(url: string | URL): string {
  const u = typeof url === "string" ? new URL(url) : url;
  return `${u.pathname}${u.search}`;
}
