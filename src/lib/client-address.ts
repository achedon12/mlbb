import { isIP } from "node:net";

/**
 * The caller's address, as far as it can be trusted.
 *
 * Each reverse proxy in front of the server appends the address it received
 * the connection from to `X-Forwarded-For`; whatever comes before those
 * entries was written by the caller and proves nothing. The left-most entry,
 * the one usually read, is therefore the easiest to forge. The trustworthy
 * one is counted from the right: with `TRUSTED_PROXY_HOPS` proxies (1, the
 * nginx in front of the container), it is the entry that many places from
 * the end.
 *
 * `X-Real-IP` is not read: nothing guarantees that a proxy overwrote it
 * rather than passing on the caller's own value. Next's proxy has no access
 * to the socket's address either, so without a usable header the address is
 * unknown (`null`) rather than guessed.
 */
const DEFAULT_HOPS = 1;

/** Read at runtime: the hosting can change without a rebuild. A bad value falls back to the default. */
export function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw) return DEFAULT_HOPS;
  const hops = Number(raw);
  return Number.isInteger(hops) && hops >= 0 ? hops : DEFAULT_HOPS;
}

export function clientAddress(headers: Headers, hops = trustedProxyHops()): string | null {
  // No proxy in front: every entry came from the caller.
  if (hops === 0) return null;
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const entries = forwarded.split(",").map((entry) => entry.trim());
  // Fewer entries than proxies: the chain is not the one configured.
  if (entries.length < hops) return null;
  const candidate = entries[entries.length - hops]!;
  return isIP(candidate) ? candidate : null;
}
