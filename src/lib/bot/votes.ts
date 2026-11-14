import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Vote webhooks of the bot lists, verified the way each list documents it.
 *
 * - **top.gg, v1 webhooks**: `x-topgg-signature: t=<unix>,v1=<hex>`, the hex
 *   HMAC-SHA256 of `${t}.${rawBody}` keyed with the webhook secret
 *   (`whs_…`); a timestamp more than five minutes old is refused. Payload
 *   `{ type: "vote.create" | "webhook.test", data: { user: { platform_id } } }`.
 * - **top.gg, legacy (v0)**: the secret typed in the bot's settings, sent as
 *   is in `Authorization`. Payload `{ user, type: "upvote" | "test" }`.
 * - **discordbotlist.com**: the webhook secret, sent as is in
 *   `Authorization`. Payload `{ id, username, avatar, admin }`.
 *
 * Every comparison runs in constant time. Pure module: no request, no
 * database, tested on its own.
 */

export const TOPGG_SIGNATURE_HEADER = "x-topgg-signature";
export const TOPGG_MAX_AGE_S = 300;
/** A list secret shorter than this is treated as unset: the route does not exist. */
export const MIN_WEBHOOK_SECRET = 16;

const digest = (v: string) => createHash("sha256").update(v).digest();

/** Constant time whatever the lengths: both sides are hashed first. */
export function sameValue(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

/** `Authorization` as top.gg (v0) and discordbotlist.com send it: the secret itself. */
export function authorizationMatches(header: string | null, secret: string): boolean {
  if (!header || secret.length < MIN_WEBHOOK_SECRET) return false;
  return sameValue(header, secret);
}

/** Parsed `t=…,v1=…` header, or null when malformed. */
export function parseTopggSignature(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value, extra] = part.trim().split("=");
    if (extra !== undefined || !key || !value) return null;
    if (key === "t") {
      if (!/^\d{1,12}$/.test(value) || timestamp !== null) return null;
      timestamp = Number(value);
    } else if (key === "v1") {
      if (!/^[0-9a-f]{64}$/i.test(value)) return null;
      signatures.push(value.toLowerCase());
    }
  }
  return timestamp === null || !signatures.length ? null : { timestamp, signatures };
}

export type SignatureVerdict = { ok: true; signature: string } | { ok: false };

/** top.gg v1: signature over `${t}.${rawBody}`, fresh within five minutes. */
export function verifyTopggSignature(header: string | null, rawBody: string, secret: string, now = Date.now()): SignatureVerdict {
  if (!header || secret.length < MIN_WEBHOOK_SECRET) return { ok: false };
  const parsed = parseTopggSignature(header);
  if (!parsed) return { ok: false };
  if (Math.abs(Math.floor(now / 1000) - parsed.timestamp) > TOPGG_MAX_AGE_S) return { ok: false };
  const expected = createHmac("sha256", secret).update(`${parsed.timestamp}.${rawBody}`).digest();
  // Every candidate is compared, so the time taken does not depend on which matched.
  let match: string | null = null;
  for (const candidate of parsed.signatures) {
    if (timingSafeEqual(Buffer.from(candidate, "hex"), expected)) match = candidate;
  }
  return match ? { ok: true, signature: `${parsed.timestamp}:${match}` } : { ok: false };
}

const snowflake = z.string().regex(/^\d{17,20}$/);

/** The voter's Discord id, null for a test event (acknowledged, not counted). */
export const topggVote = z.union([
  z
    .object({
      type: z.enum(["vote.create", "webhook.test"]),
      data: z.object({ user: z.object({ platform_id: snowflake }) }),
    })
    .transform((v) => (v.type === "webhook.test" ? null : v.data.user.platform_id)),
  z.object({ user: snowflake, type: z.string().max(16) }).transform((v) => (v.type === "test" ? null : v.user)),
]);

export const dblVote = z.object({ id: snowflake }).transform((v): string | null => v.id);
