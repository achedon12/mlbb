/**
 * Circuit breaker for an outside service.
 *
 * When the service answers 429 or a 5xx, hammering it again only makes the
 * wait longer and every page slower. The breaker pauses all calls for the
 * time the service asked for (`Retry-After`), else a minute, doubling on
 * each consecutive failure up to a cap, and forgets everything on the first
 * answer that is not a failure. While paused, callers answer "unavailable"
 * without touching the network.
 */
export interface Breaker {
  /** True while calls must not go out. */
  paused(now?: number): boolean;
  /** Records the answer's status: 429 and 5xx pause, anything else resets. */
  record(status: number, retryAfter: string | null, now?: number): void;
  /** Back to the closed state (tests, or a manual reset). */
  reset(): void;
}

/** Statuses that mean the service is overloaded or down, not that the request is wrong. */
export const isOutage = (status: number) => status === 429 || status >= 500;

/** `Retry-After` as milliseconds from now: a number of seconds or an HTTP date. */
export function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const value = header.trim();
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

export function createBreaker(baseMs = 60_000, maxMs = 10 * 60_000): Breaker {
  let pausedUntil = 0;
  let failures = 0;
  return {
    paused: (now = Date.now()) => now < pausedUntil,
    record(status, retryAfter, now = Date.now()) {
      if (!isOutage(status)) {
        failures = 0;
        pausedUntil = 0;
        return;
      }
      // Requests already in flight when the pause started land here too:
      // they must not stretch a pause that is already running.
      if (now < pausedUntil) return;
      failures += 1;
      const base = retryAfterMs(retryAfter, now) ?? baseMs;
      const wait = Math.min(maxMs, Math.max(1000, base) * 2 ** (failures - 1));
      pausedUntil = now + wait;
    },
    reset() {
      failures = 0;
      pausedUntil = 0;
    },
  };
}
