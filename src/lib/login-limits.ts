import { limitByMinute } from "@/lib/push-server";

/**
 * Limits on the game-account login.
 *
 * The code is four digits: without limits, a script could send codes to any
 * player's mailbox in a loop, or try the ten thousand codes in a few
 * minutes. Two layers, both in server memory:
 *
 * - per address: 5 code requests and 10 code checks a minute;
 * - per account (`roleId:zoneId`): 3 codes every 10 minutes, and 5 wrong
 *   attempts per code, after which a new code must be requested.
 */

export const allowCodeRequest = limitByMinute(5);
export const allowCodeCheck = limitByMinute(10);

const CODES_PER_WINDOW = 3;
const CODE_WINDOW_MS = 10 * 60_000;
const ATTEMPTS_PER_CODE = 5;
/** A code is valid five minutes: past this, its attempt count is moot. */
const ATTEMPTS_KEPT_MS = 10 * 60_000;
const TRACKED_MAX = 5_000;

const accountKey = (roleId: number, zoneId: number) => `${roleId}:${zoneId}`;

const codesSent = new Map<string, number[]>();
const wrongAttempts = new Map<string, { count: number; until: number }>();

function cap<K, V>(map: Map<K, V>) {
  for (const old of map.keys()) {
    if (map.size <= TRACKED_MAX) break;
    map.delete(old);
  }
}

/**
 * Counts a code request for the account; false when the account already had
 * its three codes in the last ten minutes. A new code starts a fresh count of
 * attempts.
 */
export function allowAccountCode(roleId: number, zoneId: number, now = Date.now()): boolean {
  const key = accountKey(roleId, zoneId);
  const recent = (codesSent.get(key) ?? []).filter((t) => now - t < CODE_WINDOW_MS);
  if (recent.length >= CODES_PER_WINDOW) {
    codesSent.set(key, recent);
    return false;
  }
  recent.push(now);
  codesSent.delete(key);
  codesSent.set(key, recent);
  cap(codesSent);
  wrongAttempts.delete(key);
  return true;
}

/** False once the current code has had its five wrong attempts. */
export function attemptsLeft(roleId: number, zoneId: number, now = Date.now()): boolean {
  const known = wrongAttempts.get(accountKey(roleId, zoneId));
  return !known || known.until <= now || known.count < ATTEMPTS_PER_CODE;
}

/** Records a wrong code for the account. */
export function recordWrongCode(roleId: number, zoneId: number, now = Date.now()): void {
  const key = accountKey(roleId, zoneId);
  const known = wrongAttempts.get(key);
  const count = known && known.until > now ? known.count + 1 : 1;
  wrongAttempts.delete(key);
  wrongAttempts.set(key, { count, until: now + ATTEMPTS_KEPT_MS });
  cap(wrongAttempts);
}

/** A successful sign-in clears the account's counts. */
export function clearAccount(roleId: number, zoneId: number): void {
  const key = accountKey(roleId, zoneId);
  wrongAttempts.delete(key);
  codesSent.delete(key);
}
