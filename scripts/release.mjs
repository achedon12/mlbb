/**
 * What counts as released.
 *
 * The wiki documents the game ahead of time: a hero announced on the test
 * server gets its data entry, its page and its artwork weeks before it ships
 * (Dori in November 2026: release "TBA", page marked `{{Unfinished}}`), and
 * the skin module lists skins dated "202X" or marked "Upcoming". The site
 * describes the live game only, so every list (heroes, skins, sitemap, draft,
 * quizzes, tier list, bot) goes through these rules.
 *
 * Shared by the sync (`scripts/sync.mjs`), which leaves unreleased entries out
 * of the data, and by the site (`src/lib/data.ts`), which applies the same
 * rules to data written by an older sync.
 */

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * The first moment of the period a date names, in UTC, or null when the text
 * names none. A date can be precise to the day ("16 May 2016", "2024-01-01"),
 * the month ("December 2016", "2026-11") or the year ("2018"). "TBA", "202X"
 * and an empty field name nothing.
 */
export function releaseStart(text) {
  if (text == null) return null;
  // Wiki links keep their label: "[[Patch Notes/1.4.66|16 March 2020]]".
  const s = String(text)
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .trim()
    .toLowerCase();
  if (!s) return null;

  let m = s.match(/\b(\d{4})-(\d{2})(?:-(\d{2}))?\b/);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1);

  m = s.match(/\b(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{4})\b/);
  if (m && MONTHS[m[2]]) return Date.UTC(Number(m[3]), MONTHS[m[2]] - 1, Number(m[1]));

  m = s.match(/\b([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m && MONTHS[m[1]]) return Date.UTC(Number(m[3]), MONTHS[m[1]] - 1, Number(m[2]));

  m = s.match(/\b([a-z]+)\.?,?\s+(\d{4})\b/);
  if (m && MONTHS[m[1]]) return Date.UTC(Number(m[2]), MONTHS[m[1]] - 1, 1);

  // A year alone, but not "202X" (no digit may follow).
  m = s.match(/\b(\d{4})\b(?![x\d])/);
  if (m) return Date.UTC(Number(m[1]), 0, 1);

  return null;
}

/**
 * "past" once the period a date names has started (a skin dated "2026-11"
 * is out on the 1st of November), "future" before, "unknown" when the text
 * names no date.
 */
export function releaseState(text, now = Date.now()) {
  const start = releaseStart(text);
  if (start == null) return "unknown";
  return start <= now ? "past" : "future";
}

/** Markers of content that is not in the live game. */
const NOT_LIVE = /\b(upcoming|unreleased|tba|tbd|leak(?:ed|s)?|advanced? server|test server|coming soon)\b/i;

/** True when a field (availability, label) says the content is not live. */
export const markedNotLive = (value) => value != null && NOT_LIVE.test(String(value));

/**
 * Whether a hero is in the live game.
 *
 * `official` is the set of slugs of the heroes the game lists (the community
 * API, which relays Moonton's own hero list, or Liquipedia): a hero announced
 * on the wiki only is not in it. Without that list (both sources down), the
 * release date alone decides, which still leaves "TBA" out. A date in the
 * future always leaves the hero out, whatever the lists say; `unfinished`
 * flags a wiki page marked `{{Unfinished}}`.
 */
export function isReleasedHero(hero, { official = null, now = Date.now(), unfinished = false } = {}) {
  const state = releaseState(hero.release, now);
  if (state === "future") return false;
  if (official) return official.has(hero.slug);
  return state === "past" && !unfinished;
}

/**
 * Whether the site lists a hero of the catalogue. The sync marks the heroes
 * it kept with `released: true`, after checking the official list; a
 * catalogue written before that field existed is judged on its dates.
 */
export function isListedHero(hero, now = Date.now()) {
  if (typeof hero.released === "boolean") return hero.released;
  return isReleasedHero(hero, { now });
}

/**
 * Whether a skin is out, from what the catalogue carries.
 *
 * The sync writes `released` once it has weighed every source (see
 * `skinRelease`). Data written before that field existed falls back on the
 * module's own fields: a past date and no "Upcoming"-like mark.
 */
export function isReleasedSkin(skin, now = Date.now()) {
  if (typeof skin.released === "boolean") return skin.released;
  if (markedNotLive(skin.availability) || markedNotLive(skin.label)) return false;
  return releaseState(skin.release, now) === "past";
}

/**
 * Sync-side verdict on a skin, from every source.
 *
 * - `confirmed`: Liquipedia lists the skin in the hero's gallery, a list
 *   that follows the live game;
 * - `month`: the StarLight or Collector page dates the skin to a month
 *   ("2026-11");
 * - `base`: the hero's default skin, which ships with the hero (Sora's
 *   "Azure Cloud" is dated a year late in the module, December 2026, yet
 *   Sora is out).
 *
 * A dated month, when it has started, also replaces a missing or unreadable
 * module date ("202X"). Returns the date to show and the verdict.
 */
export function skinRelease(skin, { confirmed = false, month = null, base = false, now = Date.now() } = {}) {
  const own = releaseState(skin.release, now);
  const monthState = month ? releaseState(month, now) : "unknown";
  const release = own === "unknown" && monthState !== "unknown" ? month : skin.release ?? null;

  if (monthState === "future") return { release, released: false };
  if (confirmed || base || monthState === "past") return { release, released: true };
  if (markedNotLive(skin.availability) || markedNotLive(skin.label)) return { release, released: false };
  return { release, released: own === "past" };
}
