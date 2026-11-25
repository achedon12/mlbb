import { limitByMinute } from "@/lib/push-server";

/**
 * Limits on the game-account login.
 *
 * The code is four digits: without limits, a script could send codes to any
 * player's mailbox in a loop, or try the ten thousand codes in a few
 * minutes. Layers, all in server memory:
 *
 * - per address: 5 code requests and 10 code checks a minute;
 * - per account and address: 3 codes every 10 minutes, so that a stranger
 *   using up their budget does not lock the player out of their own login;
 * - per account: 10 codes every 10 minutes whoever asks, against mailbox spam;
 * - per code: 5 attempts, whoever makes them, after which a new code must be
 *   requested;
 * - per account, across codes: 15 attempts every 10 minutes and 40 a day,
 *   which a new code does not reset.
 *
 * An attempt is reserved before the code goes to the service,
 *   so parallel requests cannot slip past the limit while one is in flight.
 */

export const allowCodeRequest = limitByMinute(5);
export const allowCodeCheck = limitByMinute(10);

const CODE_WINDOW_MS = 10 * 60_000;
const CODES_PER_REQUESTER = 3;
const CODES_PER_ACCOUNT = 10;
const ATTEMPTS_PER_CODE = 5;
/** A code is valid five minutes: past this, its attempt count is moot. */
const ATTEMPTS_KEPT_MS = 10 * 60_000;
const TRACKED_MAX = 5_000;

const accountKey = (roleId: number, zoneId: number) => `${roleId}:${zoneId}`;

/** Code requests, per account and per account and address. */
const codesSent = new Map<string, number[]>();
const attempts = new Map<string, { count: number; until: number }>();

/**
 * Keeps a map under the cap: expired entries go first, and only if that is
 * not enough the oldest live ones. Filling the map with fresh keys must not
 * wipe the counters that protect a real account.
 */
export function cap<K, V>(map: Map<K, V>, expired: (value: V) => boolean, max = TRACKED_MAX): void {
  if (map.size <= max) return;
  for (const [key, value] of map) {
    if (expired(value)) map.delete(key);
  }
  for (const old of map.keys()) {
    if (map.size <= max) break;
    map.delete(old);
  }
}

function recent(key: string, now: number): number[] {
  return (codesSent.get(key) ?? []).filter((t) => now - t < CODE_WINDOW_MS);
}

function push(key: string, times: number[], now: number) {
  codesSent.delete(key);
  codesSent.set(key, [...times, now]);
}

/**
 * Counts a code request for the account from this address; false when this
 * address already had its three codes for the account in the last ten
 * minutes, or the account its ten. A new code starts a fresh count of
 * attempts.
 */
export function allowAccountCode(roleId: number, zoneId: number, address: string, now = Date.now()): boolean {
  const account = accountKey(roleId, zoneId);
  const requester = `${account}@${address}`;
  const byAccount = recent(account, now);
  const byRequester = recent(requester, now);
  if (byAccount.length >= CODES_PER_ACCOUNT || byRequester.length >= CODES_PER_REQUESTER) return false;
  push(account, byAccount, now);
  push(requester, byRequester, now);
  cap(codesSent, (times) => times.every((t) => now - t >= CODE_WINDOW_MS));
  attempts.delete(account);
  return true;
}

/**
 * The account's attempts over sliding windows, whatever the code: a new code
 * resets the five per code, not these. Without them, ten codes of five
 * attempts every ten minutes would find a four-digit code within a day.
 */
const ATTEMPTS_PER_ACCOUNT_SHORT = 15;
const ATTEMPTS_SHORT_MS = 10 * 60_000;
const ATTEMPTS_PER_ACCOUNT_DAY = 40;
const DAY_MS = 24 * 3600_000;
const accountAttempts = new Map<string, number[]>();

/**
 * Reserves one attempt on the account's current code before it is checked;
 * false once five have been used on this code, fifteen on the account in
 * the last ten minutes or forty in the last day. Synchronous, so two
 * requests cannot both read the same count.
 */
export function reserveAttempt(roleId: number, zoneId: number, now = Date.now()): boolean {
  const key = accountKey(roleId, zoneId);
  const known = attempts.get(key);
  const count = known && known.until > now ? known.count : 0;
  const day = (accountAttempts.get(key) ?? []).filter((t) => now - t < DAY_MS);
  const short = day.filter((t) => now - t < ATTEMPTS_SHORT_MS).length;
  if (count >= ATTEMPTS_PER_CODE || short >= ATTEMPTS_PER_ACCOUNT_SHORT || day.length >= ATTEMPTS_PER_ACCOUNT_DAY) {
    return false;
  }
  attempts.delete(key);
  attempts.set(key, { count: count + 1, until: now + ATTEMPTS_KEPT_MS });
  cap(attempts, (a) => a.until <= now);
  accountAttempts.delete(key);
  accountAttempts.set(key, [...day, now]);
  cap(accountAttempts, (times) => times.every((t) => now - t >= DAY_MS));
  return true;
}

/** Gives a reserved attempt back: the service was down, the code was not judged. */
export function refundAttempt(roleId: number, zoneId: number): void {
  const key = accountKey(roleId, zoneId);
  const known = attempts.get(key);
  if (known && known.count > 0) known.count -= 1;
  accountAttempts.get(key)?.pop();
}

/** A successful sign-in clears the account's attempts. */
export function clearAccount(roleId: number, zoneId: number): void {
  const key = accountKey(roleId, zoneId);
  attempts.delete(key);
  accountAttempts.delete(key);
}
