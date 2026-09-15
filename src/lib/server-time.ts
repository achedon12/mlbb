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

/** End of a ranked season, as announced by the patch notes. */
export interface EndSeason {
  season: number;
  /** UTC instant, in milliseconds. */
  end: number;
  /** Version of the patch that announces it. */
  patch: string;
  link: string;
}

/**
 * "S31 will end at 23:59:59 on 3/15 (Server Time).": the only form in
 * which the game dates a season end. Month and day, without year.
 */
const PATTERN_END = /\bS(\d+) will end at (\d{1,2}):(\d{2}):(\d{2}) on (\d{1,2})\/(\d{1,2}) \(Server Time\)/gi;

/**
 * Season ends announced in the synced patch notes, from oldest
 * to most recent. The year is missing: it is the patch's, or the
 * next one when the date falls more than a month before its publication (December
 * patch, end in January).
 */
export function endsOfSeason(
  patches: { version: string; link: string; date?: string | null; sections: { html: string }[] }[],
): EndSeason[] {
  const ends = new Map<number, EndSeason>();
  for (const p of patches) {
    if (!p.date) continue;
    const published = Date.parse(`${p.date}T00:00:00Z`);
    if (Number.isNaN(published)) continue;
    const year = new Date(published).getUTCFullYear();
    for (const section of p.sections) {
      for (const m of section.html.matchAll(PATTERN_END)) {
        const [, season, h, mi, s, month, day] = m.map(Number);
        let end = instantServer(year, month - 1, day, h, mi, s);
        if (end < published - 31 * DAY) end = instantServer(year + 1, month - 1, day, h, mi, s);
        if (!ends.has(season) || ends.get(season)!.end < end) ends.set(season, { season, end, patch: p.version, link: p.link });
      }
    }
  }
  return [...ends.values()].sort((a, b) => a.end - b.end);
}

/** Next upcoming season end, or null when none is announced. */
export function nextEndSeason(ends: EndSeason[], now: number): EndSeason | null {
  return ends.find((f) => f.end > now) ?? null;
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
