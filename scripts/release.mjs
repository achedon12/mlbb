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

/** "YYYY-MM" of a date precise to the month at least, or null. */
function monthOf(text) {
  const m = String(text ?? "").match(/\b(\d{4})-(\d{2})\b/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** "MM-DD" of a date precise to the day ("2025-12-18", "18 December 2025"), or null. */
function dayOf(text) {
  const s = String(text ?? "").trim();
  if (!/\d{4}-\d{2}-\d{2}|\b\d{1,2}\s+[a-z]+\.?,?\s+\d{4}|\b[a-z]+\.?\s+\d{1,2},?\s+\d{4}/i.test(s)) return null;
  const start = releaseStart(s);
  return start == null ? null : new Date(start).toISOString().slice(5, 10);
}

/**
 * Sync-side verdict on a skin, from every source.
 *
 * - `confirmed`: Liquipedia lists the skin in the hero's gallery, a list
 *   that follows the live game;
 * - `month`: the StarLight or Collector page dates the skin to a month
 *   ("2026-11");
 * - `base`: the hero's default skin, which ships with the hero;
 * - `heroRelease`: the hero's release date, to read a wrong year.
 *
 * The date shown follows these rules:
 *
 * - a dated month, when it has started, replaces a missing or unreadable
 *   module date ("202X"), and a module date of another month: the monthly
 *   pages are reviewed month by month, the module is not (Fredrinn's
 *   "Royal Marshal", StarLight of December 2025, is dated November 2025 in
 *   the module);
 * - a date still to come on a skin the other sources show as out is wrong,
 *   and is not shown. When it falls on the hero's release day in another
 *   year, the year is the typo and the hero's release date is used (Sora's
 *   "Azure Cloud", sold since Sora came out on 18 December 2025, is dated
 *   18 December 2026); otherwise the skin goes without a date.
 *
 * Returns the date to show, the verdict, and `dateFix`, the reason when the
 * module's date was replaced (null otherwise).
 */
export function skinRelease(
  skin,
  { confirmed = false, month = null, base = false, heroRelease = null, now = Date.now() } = {},
) {
  const own = releaseState(skin.release, now);
  const monthState = month ? releaseState(month, now) : "unknown";
  let release = skin.release ?? null;
  let dateFix = null;
  if (monthState !== "unknown" && (own === "unknown" || monthOf(skin.release) !== month)) {
    if (own !== "unknown") dateFix = "series month";
    release = month;
  }

  if (monthState === "future") return { release, released: false, dateFix };
  const out = confirmed || base || monthState === "past";
  if (out && releaseState(release, now) === "future") {
    // monthState is "unknown" here: a started month would have replaced the date.
    const day = dayOf(release);
    const typo = day && day === dayOf(heroRelease) && releaseState(heroRelease, now) === "past";
    release = typo ? new Date(releaseStart(heroRelease)).toISOString().slice(0, 10) : null;
    dateFix = typo ? "year typo" : "future date";
  }
  if (out) return { release, released: true, dateFix };
  if (markedNotLive(skin.availability) || markedNotLive(skin.label)) return { release, released: false, dateFix };
  return { release, released: own === "past", dateFix };
}
