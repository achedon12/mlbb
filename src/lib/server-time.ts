/**
 * MLBB server time and resets.
 *
 * Pure module, without data: the clock client component imports it as
 * is. All deadlines are computed in UTC milliseconds, from a
 * single timezone constant.
 */
import type { Locale } from "@/i18n/config";

const MINUTE = 60_000;
const DAY = 86_400_000;

/**
 * Server time offset from UTC, in minutes: UTC-8, all year round, without
 * daylight saving time.
 *
 * Source: Fandom wiki, "Server time" page (accessed on September 11, 2026),
 * https://mobilelegends.fandom.com/wiki/Server_time — "Coordinated Universal
 * Time (UTC) subtracted by eight hours". Its table confirms it (00:00 server
 * = 16:00 in Manila, 09:00 in Paris in winter), as do the patch notes, which
 * date season ends and starts "(Server Time)". Sources that claim
 * "midnight UTC+8" confuse the Asian audience's timezone with the game's.
 */
export const SERVER_OFFSET_MIN = -8 * 60;

/** The same timezone for Intl. `Etc/` zones invert the sign: `Etc/GMT+8` means UTC-8. */
export const SERVER_TIMEZONE = "Etc/GMT+8";

/**
 * Server time of resets, same source: daily tasks at 00:00, weekly
 * tasks on Monday at 00:00. Starlight restarts on the 1st of each month at
 * 00:00 ("StarLight" page of the same wiki).
 */
export const TIME_RESET = 0;
/** Day of the weekly reset, numbered like `getUTCDay`: 1 = Monday. */
export const DAY_RESET_WEEKLY = 1;

export const TIME_SOURCES = {
  server: "https://mobilelegends.fandom.com/wiki/Server_time",
  starlight: "https://mobilelegends.fandom.com/wiki/StarLight",
} as const;

/** UTC instant of a server "wall clock" time (year, month 0-11, day, hour…). */
function instantServer(year: number, month: number, day: number, time = 0, minute = 0, second = 0): number {
  return Date.UTC(year, month, day, time, minute, second) - SERVER_OFFSET_MIN * MINUTE;
}

/** Server wall clock time: a date whose UTC fields give the server time. */
export function wallServer(instant: number): Date {
  return new Date(instant + SERVER_OFFSET_MIN * MINUTE);
}

/** Next daily reset, strictly after `now`. */
export function nextResetDaily(now: number): number {
  const m = wallServer(now);
  const today = instantServer(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate(), TIME_RESET);
  return today > now ? today : today + DAY;
}

/** Next weekly reset (Monday 00:00 server), strictly after `now`. */
export function nextResetWeekly(now: number): number {
  const m = wallServer(now);
  const gap = (DAY_RESET_WEEKLY - m.getUTCDay() + 7) % 7;
  const target = instantServer(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate() + gap, TIME_RESET);
  return target > now ? target : target + 7 * DAY;
}

/** Next Starlight start (1st of the month, 00:00 server), strictly after `now`. */
export function nextStarlight(now: number): number {
  const m = wallServer(now);
  const ceMonth = instantServer(m.getUTCFullYear(), m.getUTCMonth(), 1, TIME_RESET);
  return ceMonth > now ? ceMonth : instantServer(m.getUTCFullYear(), m.getUTCMonth() + 1, 1, TIME_RESET);
}

export interface Duration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Splits a duration into whole days, hours, minutes and seconds; never negative. */
export function split(ms: number): Duration {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/**
 * Offset of an IANA timezone from UTC at a given instant, in minutes: it follows
 * daylight saving time, which a fixed offset would not.
 */
export function offsetTimezone(timezone: string, instant: number): number {
  const matches = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const v = (type: Intl.DateTimeFormatPartTypes) => Number(matches.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"), v("second"));
  return Math.round((wall - Math.floor(instant / 1000) * 1000) / MINUTE);
}

/** "UTC+2", "UTC−3", "UTC+5:30", "UTC". */
export function labelOffset(minutes: number): string {
  if (minutes === 0) return "UTC";
  const absolute = Math.abs(minutes);
  const rest = absolute % 60;
  return `UTC${minutes > 0 ? "+" : "−"}${Math.floor(absolute / 60)}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

// ── Ranked seasons ──────────────────────────────────────────────────

/**
 * A ranked season. Instants are UTC milliseconds; a bound that has not been
 * announced is null, never estimated.
 */
export interface Season {
  season: number;
  start: number | null;
  end: number | null;
  /** Where the dates come from: a patch note. */
  source: string | null;
}

/** A season as written in `src/data/editorial/seasons.json`: server wall-clock dates. */
export interface SeasonEditorial {
  season: number;
  start: string | null;
  end: string | null;
  source?: string | null;
}

/** "2026-09-16T00:00:00", server wall clock, to a UTC instant; null when unreadable. */
export function readServerDate(text: string | null | undefined): number | null {
  const m = text?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
  return instantServer(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

export function seasonsEditorial(list: readonly SeasonEditorial[]): Season[] {
  return list
    .map((s) => ({ season: s.season, start: readServerDate(s.start), end: readServerDate(s.end), source: s.source ?? null }))
    .sort((a, b) => a.season - b.season);
}

/** A season bound read in a patch note: month and day, never the year. */
export interface SeasonAnnouncement {
  season: number;
  kind: "start" | "end";
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  link: string;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/**
 * "S41 will end at 21:59:59 on September 15 (Server Time)." and "S42 will
 * start from 00:00:00 on 9/16 (Server Time).": the two forms in which the
 * game dates a season, month and day without a year.
 */
const PATTERN_SEASON =
  /\bS(\d+) will (end at|start from) (\d{1,2}):(\d{2}):(\d{2}) on (?:(\d{1,2})\/(\d{1,2})|([A-Za-z]+) (\d{1,2})) \(Server Time\)/gi;

export function seasonAnnouncements(patches: { link: string; sections: { html: string }[] }[]): SeasonAnnouncement[] {
  const output: SeasonAnnouncement[] = [];
  for (const p of patches) {
    for (const section of p.sections) {
      for (const m of section.html.matchAll(PATTERN_SEASON)) {
        const month = m[6] ? Number(m[6]) : MONTHS.indexOf(m[8].toLowerCase()) + 1;
        const day = Number(m[7] ?? m[9]);
        if (month < 1 || month > 12 || day < 1 || day > 31) continue;
        output.push({
          season: Number(m[1]),
          kind: m[2].toLowerCase().startsWith("end") ? "end" : "start",
          month,
          day,
          hour: Number(m[3]),
          minute: Number(m[4]),
          second: Number(m[5]),
          link: p.link,
        });
      }
    }
  }
  return output;
}

/** A season lasts about three months: an announced bound further than this from its reference is someone else's. */
const SEASON_SPAN = 200 * DAY;

/**
 * Season calendar: the editorial dates, completed by the patch-note
 * announcements of the seasons that follow them.
 *
 * The wiki dates its patch pages unreliably (an old note can carry this
 * year's date), so the year of an announcement is not taken from its patch:
 * it is the first one that puts the date after the bound it follows — the
 * season's start for an end, the previous season's end for a start — within
 * one season's span. An announcement for a season the editorial file already
 * dates, or with nothing to anchor it, is left out.
 */
export function seasonCalendar(editorial: readonly Season[], announcements: readonly SeasonAnnouncement[]): Season[] {
  const seasons = new Map(editorial.map((s) => [s.season, { ...s }]));
  const last = Math.max(0, ...editorial.map((s) => s.season));
  const ordered = [...announcements]
    .filter((a) => a.season >= last)
    .sort((a, b) => a.season - b.season || (a.kind === b.kind ? 0 : a.kind === "start" ? -1 : 1));

  for (const a of ordered) {
    const entry = seasons.get(a.season) ?? { season: a.season, start: null, end: null, source: null };
    if (entry[a.kind] !== null) continue;
    const previous = seasons.get(a.season - 1);
    const reference = a.kind === "end" ? (entry.start ?? previous?.end ?? null) : (previous?.end ?? previous?.start ?? null);
    if (reference === null) continue;
    const year = wallServer(reference).getUTCFullYear();
    const instant = [year, year + 1]
      .map((y) => instantServer(y, a.month - 1, a.day, a.hour, a.minute, a.second))
      .find((i) => i > reference - DAY && i < reference + SEASON_SPAN);
    if (instant === undefined) continue;
    entry[a.kind] = instant;
    entry.source ??= a.link;
    seasons.set(a.season, entry);
  }
  return [...seasons.values()].sort((a, b) => a.season - b.season);
}

/**
 * The season under way: the latest one started and not yet over. Between the
 * end of a season and the start of the next, none.
 */
export function currentSeason(calendar: readonly Season[], now: number): Season | null {
  const started = calendar.filter((s) => s.start !== null && s.start <= now);
  const latest = started.at(-1);
  return latest && (latest.end === null || latest.end > now) ? latest : null;
}

/** The first season whose start is announced and still to come. */
export function nextSeason(calendar: readonly Season[], now: number): Season | null {
  return calendar.find((s) => s.start !== null && s.start > now) ?? null;
}

/**
 * Countries of the local times table, by site language: those where the game has the
 * most players speaking that language. The country name comes from Intl
 * (`DisplayNames`), in the reader's language; the city is only used to
 * tell apart countries with several timezones.
 */
export interface CountryTimezone {
  /** ISO 3166-1 code. */
  country: string;
  timezone: string;
  city?: string;
}

/**
 * The game's main markets, whatever the site language: Southeast Asia first,
 * where most players are, then the other large communities. One row per
 * zone; the United States gets its two coasts.
 */
export const COUNTRIES_WORLD: CountryTimezone[] = [
  { country: "PH", timezone: "Asia/Manila" },
  { country: "ID", timezone: "Asia/Jakarta", city: "Jakarta" },
  { country: "MY", timezone: "Asia/Kuala_Lumpur" },
  { country: "SG", timezone: "Asia/Singapore" },
  { country: "TH", timezone: "Asia/Bangkok" },
  { country: "VN", timezone: "Asia/Ho_Chi_Minh" },
  { country: "MM", timezone: "Asia/Yangon" },
  { country: "KH", timezone: "Asia/Phnom_Penh" },
  { country: "IN", timezone: "Asia/Kolkata" },
  { country: "JP", timezone: "Asia/Tokyo" },
  { country: "RU", timezone: "Europe/Moscow", city: "Moscow" },
  { country: "TR", timezone: "Europe/Istanbul" },
  { country: "FR", timezone: "Europe/Paris" },
  { country: "BR", timezone: "America/Sao_Paulo", city: "São Paulo" },
  { country: "US", timezone: "America/New_York", city: "New York" },
  { country: "US", timezone: "America/Los_Angeles", city: "Los Angeles" },
];

export const COUNTRY_BY_LOCALE: Record<Locale, CountryTimezone[]> = {
  fr: [
    { country: "FR", timezone: "Europe/Paris" },
    { country: "BE", timezone: "Europe/Brussels" },
    { country: "CH", timezone: "Europe/Zurich" },
    { country: "LU", timezone: "Europe/Luxembourg" },
    { country: "CA", timezone: "America/Toronto", city: "Montréal" },
    { country: "MA", timezone: "Africa/Casablanca" },
    { country: "DZ", timezone: "Africa/Algiers" },
    { country: "TN", timezone: "Africa/Tunis" },
    { country: "SN", timezone: "Africa/Dakar" },
    { country: "CI", timezone: "Africa/Abidjan" },
    { country: "CM", timezone: "Africa/Douala" },
    { country: "CD", timezone: "Africa/Kinshasa" },
    { country: "RE", timezone: "Indian/Reunion" },
  ],
  it: [
    { country: "IT", timezone: "Europe/Rome" },
    { country: "CH", timezone: "Europe/Zurich" },
    { country: "SM", timezone: "Europe/San_Marino" },
    { country: "MT", timezone: "Europe/Malta" },
  ],
  es: [
    { country: "ES", timezone: "Europe/Madrid" },
    { country: "MX", timezone: "America/Mexico_City" },
    { country: "CO", timezone: "America/Bogota" },
    { country: "AR", timezone: "America/Argentina/Buenos_Aires" },
    { country: "PE", timezone: "America/Lima" },
    { country: "CL", timezone: "America/Santiago" },
    { country: "VE", timezone: "America/Caracas" },
    { country: "EC", timezone: "America/Guayaquil" },
    { country: "BO", timezone: "America/La_Paz" },
    { country: "GT", timezone: "America/Guatemala" },
    { country: "DO", timezone: "America/Santo_Domingo" },
  ],
  en: [
    { country: "US", timezone: "America/New_York", city: "New York" },
    { country: "US", timezone: "America/Los_Angeles", city: "Los Angeles" },
    { country: "GB", timezone: "Europe/London" },
    { country: "IE", timezone: "Europe/Dublin" },
    { country: "CA", timezone: "America/Vancouver", city: "Vancouver" },
    { country: "AU", timezone: "Australia/Sydney", city: "Sydney" },
    { country: "IN", timezone: "Asia/Kolkata" },
    { country: "PH", timezone: "Asia/Manila" },
    { country: "MY", timezone: "Asia/Kuala_Lumpur" },
    { country: "SG", timezone: "Asia/Singapore" },
    { country: "NG", timezone: "Africa/Lagos" },
    { country: "ZA", timezone: "Africa/Johannesburg" },
  ],
  // Indonesia spans three time zones.
  id: [
    { country: "ID", timezone: "Asia/Jakarta", city: "Jakarta" },
    { country: "ID", timezone: "Asia/Makassar", city: "Makassar" },
    { country: "ID", timezone: "Asia/Jayapura", city: "Jayapura" },
  ],
};
