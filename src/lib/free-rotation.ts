/**
 * Free hero rotation of the week.
 *
 * The game does not publish its weekly free heroes anywhere the sync can
 * read, so the list is editorial (`src/data/editorial/free-rotation.json`),
 * copied by hand from the game every Monday. A list nobody updated is worse
 * than no list: past `STALE_DAYS` after its week started, it is treated as
 * missing, and the page says so instead of showing last week's heroes.
 *
 * Pure module: the data is passed in, so the rules can be tested on any date.
 */

/** Shape of the editorial file. */
export interface FreeRotationData {
  /** Monday the rotation starts on, YYYY-MM-DD; null when never filled. */
  weekStart: string | null;
  /** Day the file was last edited, YYYY-MM-DD. */
  updated: string | null;
  /** Where the list was read: an official post, or null for the game itself. */
  source: string | null;
  /** Hero slugs, as in `src/data/game/heroes.json`. */
  heroes: string[];
}

/** A rotation is a week long; three extra days cover a late update. */
export const STALE_DAYS = 10;

const DAY = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FreeRotation =
  | { state: "current"; weekStart: string; updated: string | null; source: string | null; heroes: string[] }
  /** Filled once, but more than `STALE_DAYS` old (or dated in the future). */
  | { state: "stale"; weekStart: string; updated: string | null }
  /** Never filled, or emptied on purpose. */
  | { state: "empty" };

/**
 * Status of the rotation at an instant. Unknown slugs are dropped (the unit
 * test fails on them first); a list left with no hero counts as empty.
 */
export function freeRotation(data: FreeRotationData, now: number, known: (slug: string) => boolean): FreeRotation {
  const heroes = [...new Set(data.heroes)].filter(known);
  if (!data.weekStart || !DATE.test(data.weekStart) || heroes.length === 0) return { state: "empty" };
  const start = Date.parse(`${data.weekStart}T00:00:00Z`);
  const age = (now - start) / DAY;
  if (Number.isNaN(start) || age < -1 || age > STALE_DAYS) {
    return { state: "stale", weekStart: data.weekStart, updated: data.updated };
  }
  return { state: "current", weekStart: data.weekStart, updated: data.updated, source: data.source, heroes };
}
