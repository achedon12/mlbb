import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Request signing between the bot and the site, the same scheme both ways:
 *
 *   X-MLBBDex-Timestamp: unix seconds
 *   X-MLBBDex-Signature: hex HMAC-SHA256(secret, `${ts}.${METHOD}.${path}.${body}`)
 *
 * `path` is the pathname plus the query string exactly as sent, `body` the raw
 * body ("" for a GET). Signing the method and the path stops a captured
 * signature from being replayed on another route; the timestamp bounds how
 * long a captured request stays usable.
 */

export const TIMESTAMP_HEADER = "x-mlbbdex-timestamp";
export const SIGNATURE_HEADER = "x-mlbbdex-signature";
export const MAX_SKEW_SECONDS = 300;

export function sign(secret: string, timestamp: number, method: string, path: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${method.toUpperCase()}.${path}.${body}`)
    .digest("hex");
}

export function signedHeaders(
  secret: string,
  method: string,
  path: string,
  body: string,
  now = Date.now(),
): Record<string, string> {
  const timestamp = Math.floor(now / 1000);
  return {
    "X-MLBBDex-Timestamp": String(timestamp),
    "X-MLBBDex-Signature": sign(secret, timestamp, method, path, body),
  };
}

export type VerifyFailure = "missing" | "malformed" | "skew" | "mismatch" | "replay";

export interface VerifyInput {
  secret: string;
  timestamp: string | undefined;
  signature: string | undefined;
  method: string;
  path: string;
  body: string;
  now?: number;
}

export function verify(input: VerifyInput): { ok: true } | { ok: false; reason: VerifyFailure } {
  const { timestamp, signature } = input;
  if (!timestamp || !signature) return { ok: false, reason: "missing" };
  if (!/^\d{1,12}$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(signature)) return { ok: false, reason: "malformed" };
  const ts = Number(timestamp);
  const nowSec = Math.floor((input.now ?? Date.now()) / 1000);
  if (Math.abs(nowSec - ts) > MAX_SKEW_SECONDS) return { ok: false, reason: "skew" };
  const expected = Buffer.from(sign(input.secret, ts, input.method, input.path, input.body), "hex");
  const given = Buffer.from(signature, "hex");
  // Both are 32 bytes here (the regex above), which timingSafeEqual requires.
  if (!timingSafeEqual(expected, given)) return { ok: false, reason: "mismatch" };
  return { ok: true };
}

/**
 * Remembers the signatures of recent mutating requests, so one captured on
 * the network cannot be sent again within the skew window. Only POSTs go
 * through it: two identical reads in the same second are legitimate (the
 * dashboard checks access on every read) and replaying a read changes nothing.
 * Entries expire with the window, so memory stays bounded by the request rate.
 */
export class ReplayGuard {
  private readonly seen = new Map<string, number>();

  constructor(private readonly windowMs = MAX_SKEW_SECONDS * 2 * 1000, private readonly maxEntries = 10_000) {}

  /** True the first time a signature is seen within the window. */
  accept(signature: string, now = Date.now()): boolean {
    this.prune(now);
    const key = signature.toLowerCase();
    if (this.seen.has(key)) return false;
    if (this.seen.size >= this.maxEntries) {
      // Under a flood, drop the oldest: Map iterates in insertion order.
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    this.seen.set(key, now + this.windowMs);
    return true;
  }

  private prune(now: number): void {
    for (const [key, expires] of this.seen) {
      if (expires > now) break;
      this.seen.delete(key);
    }
  }
}
