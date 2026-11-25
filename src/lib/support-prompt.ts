/**
 * When the support cards (`components/support-links.tsx`) may show: the
 * footer link and the About block always do; the cards follow two rules,
 * remembered in the browser only.
 *
 * - "Later" hides every card for 14 days.
 * - The cards of the daily games (quiz, MLBBdle) wait for the second
 *   completion: a first-time player gets the result, not a request.
 *
 * Storage refused (private mode, blocked site data): no win is counted, so
 * the game cards stay hidden; the other cards still show, without "Later"
 * being remembered.
 */
export const SUPPORT_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
export const SUPPORT_WINS_BEFORE_CARD = 2;

const KEY = "mlbb_support";

export interface SupportMemory {
  /** Daily games completed (quiz finished, MLBBdle solved) since the first visit. */
  wins: number;
  /** Timestamp (ms) until which the cards stay hidden; 0 when never dismissed. */
  hiddenUntil: number;
}

const EMPTY: SupportMemory = { wins: 0, hiddenUntil: 0 };

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** A stored value, cleaned: anything malformed reads as nothing remembered. */
export function parseSupportMemory(raw: string | null): SupportMemory {
  if (!raw) return { ...EMPTY };
  try {
    const value = JSON.parse(raw) as Partial<SupportMemory> | null;
    const wins = typeof value?.wins === "number" && Number.isFinite(value.wins) ? Math.max(0, Math.floor(value.wins)) : 0;
    const hiddenUntil = typeof value?.hiddenUntil === "number" && Number.isFinite(value.hiddenUntil) ? value.hiddenUntil : 0;
    return { wins, hiddenUntil };
  } catch {
    return { ...EMPTY };
  }
}

export function readSupportMemory(): SupportMemory {
  try {
    return parseSupportMemory(storage()?.getItem(KEY) ?? null);
  } catch {
    return { ...EMPTY };
  }
}

function writeSupportMemory(memory: SupportMemory) {
  try {
    storage()?.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* storage unavailable: nothing is remembered */
  }
}

/** One more daily game completed. */
export function recordSupportWin() {
  const memory = readSupportMemory();
  writeSupportMemory({ ...memory, wins: memory.wins + 1 });
}

/** "Later": no card for 14 days. */
export function dismissSupport(now: number) {
  writeSupportMemory({ ...readSupportMemory(), hiddenUntil: now + SUPPORT_DISMISS_MS });
}

/** Whether a card may show; `gated` for the daily games' cards. */
export function supportCardAllowed(memory: SupportMemory, { gated, now }: { gated: boolean; now: number }): boolean {
  if (memory.hiddenUntil > now) return false;
  return !gated || memory.wins >= SUPPORT_WINS_BEFORE_CARD;
}
