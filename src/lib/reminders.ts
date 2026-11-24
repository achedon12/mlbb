import { signalProgress } from "./progress-signal";
import { SERVER_OFFSET_MIN } from "./server-time";

/**
 * Reminders for upcoming months of skins and events: the side-effect-free part.
 *
 * A reminder targets a month ("2026-12"). Each month opens on the 1st at
 * 00:00 server time: the StarLight skin of the month arrives then, and the
 * month's events follow. That instant is what the calendar file and the push
 * notification point at. Pure module: the browser button, the calendar route
 * and the push storage all read it.
 */

const MINUTE = 60_000;
const DAY = 86_400_000;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** A reminder is only accepted for a month that opens within this window. */
export const REMINDER_HORIZON_DAYS = 400;

/** UTC instant of the 1st of `month` at 00:00 server time; null for an unreadable month. */
export function monthStart(month: string): number | null {
  const m = MONTH.exec(month);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, 1) - SERVER_OFFSET_MIN * MINUTE;
}

/** Whether a reminder for `month` still makes sense at `now`: not opened yet, not years away. */
export function isRemindable(month: string, now: number): boolean {
  const start = monthStart(month);
  return start !== null && start > now && start - now <= REMINDER_HORIZON_DAYS * DAY;
}

// ── Calendar file (RFC 5545) ───────────────────────────────────────

/** Text value escaping: backslash, semicolon, comma and line breaks. */
export function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines are folded at 75 octets, continuations starting with a space. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const n = bytes.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + n > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** "20261201T080000Z". */
export function icsDate(instant: number): string {
  return new Date(instant).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export interface CalendarEvent {
  uid: string;
  start: number;
  /** Minutes. */
  duration: number;
  title: string;
  description: string;
  url: string;
  /** Creation instant of the file. */
  stamp: number;
}

/** A one-event calendar, with an alarm when it starts. */
export function icsCalendar(e: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MLBBDex//Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(e.stamp)}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(e.start + e.duration * MINUTE)}`,
    `SUMMARY:${icsText(e.title)}`,
    `DESCRIPTION:${icsText(`${e.description}\n${e.url}`)}`,
    `URL:${e.url}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(e.title)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ── Push reminders ─────────────────────────────────────────────────

/** Reminders a browser may hold at once. */
export const MAX_REMINDERS_BY_BROWSER = 12;
/** A reminder found later than this after its month opened is dropped unsent. */
export const LATE_TOLERANCE_MS = 2 * DAY;

/** Reminders due at `now`, and those too late to be worth sending. */
export function sortDue<R extends { mois: string }>(reminders: readonly R[], now: number): { due: R[]; stale: R[]; waiting: R[] } {
  const due: R[] = [];
  const stale: R[] = [];
  const waiting: R[] = [];
  for (const r of reminders) {
    const start = monthStart(r.mois);
    if (start === null || now - start > LATE_TOLERANCE_MS) stale.push(r);
    else if (start <= now) due.push(r);
    else waiting.push(r);
  }
  return { due, stale, waiting };
}

// ── Browser memory ─────────────────────────────────────────────────

/**
 * How this browser was told to remind: a calendar file, a push notification,
 * or both. `synced`: the reminder was set on another device of the signed-in
 * account (the account sync wrote it here); neither way is set on this one.
 */
export interface ReminderMemory {
  calendar?: boolean;
  push?: boolean;
  synced?: boolean;
}

/** Whether a month's memory says a reminder exists, here or on another device. */
export const isReminded = (m: ReminderMemory | undefined) => Boolean(m && (m.calendar || m.push || m.synced));

const STORAGE = "mlbb_reminders";

/** Reminders this browser set, by month. Storage missing or garbled: none. */
export function readReminders(): Record<string, ReminderMemory> {
  try {
    const raw = localStorage.getItem(STORAGE);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([k, v]) => MONTH.test(k) && typeof v === "object" && v !== null),
    ) as Record<string, ReminderMemory>;
  } catch {
    return {};
  }
}

/** Records (or with `null`, forgets) this browser's reminder for a month; past months are dropped. */
export function writeReminder(month: string, memory: ReminderMemory | null, now = Date.now()) {
  try {
    const all = readReminders();
    if (isReminded(memory ?? undefined)) all[month] = memory!;
    else delete all[month];
    for (const key of Object.keys(all)) {
      const start = monthStart(key);
      if (start === null || now - start > LATE_TOLERANCE_MS) delete all[key];
    }
    localStorage.setItem(STORAGE, JSON.stringify(all));
    signalProgress();
  } catch {
    /* storage refused: the reminder still exists, only its badge is forgotten */
  }
}
