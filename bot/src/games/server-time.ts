/**
 * Game server time and resets, ported from the site's `src/lib/server-time.ts`:
 * UTC-8 all year round, daily reset at 00:00, weekly on Monday 00:00,
 * Starlight on the 1st of the month (source: Mobile Legends Wiki, "Server time").
 */

const MINUTE = 60_000;
const DAY = 86_400_000;
export const SERVER_OFFSET_MIN = -8 * 60;

function instantServer(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day) - SERVER_OFFSET_MIN * MINUTE;
}

/** A date whose UTC fields read as the server's wall clock. */
export function wallServer(instant: number): Date {
  return new Date(instant + SERVER_OFFSET_MIN * MINUTE);
}

export function nextResetDaily(now: number): number {
  const m = wallServer(now);
  const today = instantServer(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate());
  return today > now ? today : today + DAY;
}

export function nextResetWeekly(now: number): number {
  const m = wallServer(now);
  const gap = (1 - m.getUTCDay() + 7) % 7;
  const target = instantServer(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate() + gap);
  return target > now ? target : target + 7 * DAY;
}

export function nextStarlight(now: number): number {
  const m = wallServer(now);
  const first = instantServer(m.getUTCFullYear(), m.getUTCMonth(), 1);
  return first > now ? first : instantServer(m.getUTCFullYear(), m.getUTCMonth() + 1, 1);
}
