import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LATE_TOLERANCE_MS,
  foldLine,
  icsCalendar,
  icsText,
  isRemindable,
  monthStart,
  readReminders,
  sortDue,
  writeReminder,
} from "@/lib/reminders";

describe("monthStart", () => {
  it("opens a month on the 1st at 00:00 server time (UTC-8)", () => {
    expect(new Date(monthStart("2026-12")!).toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(new Date(monthStart("2027-01")!).toISOString()).toBe("2027-01-01T08:00:00.000Z");
  });

  it("rejects an unreadable month", () => {
    expect(monthStart("2026-13")).toBeNull();
    expect(monthStart("2026-1")).toBeNull();
    expect(monthStart("../etc")).toBeNull();
  });
});

describe("isRemindable", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  it("accepts a month still to open, within the horizon", () => {
    expect(isRemindable("2026-12", now)).toBe(true);
    expect(isRemindable("2027-06", now)).toBe(true);
  });
  it("refuses an open month, a past one, or one years away", () => {
    expect(isRemindable("2026-11", now)).toBe(false);
    expect(isRemindable("2025-12", now)).toBe(false);
    expect(isRemindable("2029-01", now)).toBe(false);
  });
});

describe("calendar file", () => {
  it("escapes text values", () => {
    expect(icsText("a, b; c\\d\ne")).toBe("a\\, b\\; c\\\\d\\ne");
  });

  it("folds long lines at 75 octets, multi-byte characters kept whole", () => {
    const folded = foldLine(`SUMMARY:${"é".repeat(80)}`);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"é".repeat(80)}`);
  });

  it("writes one event with an alarm at its start", () => {
    const ics = icsCalendar({
      uid: "month-2026-12@mlbbdex.com",
      start: monthStart("2026-12")!,
      duration: 60,
      title: "December 2026 is live",
      description: "The StarLight skin is out.",
      url: "https://mlbbdex.com/en/events/2026-12",
      stamp: Date.parse("2026-11-24T10:00:00Z"),
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261201T080000Z");
    expect(ics).toContain("DTEND:20261201T090000Z");
    expect(ics).toContain("DTSTAMP:20261124T100000Z");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:PT0M");
    expect(ics.split("\r\n").filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });
});

describe("sortDue", () => {
  const start = monthStart("2026-12")!;
  const list = [{ mois: "2026-12" }, { mois: "2027-01" }, { mois: "bad" }];

  it("waits before the month opens", () => {
    const { due, waiting, stale } = sortDue(list, start - 1);
    expect(due).toEqual([]);
    expect(waiting.map((r) => r.mois)).toEqual(["2026-12", "2027-01"]);
    expect(stale.map((r) => r.mois)).toEqual(["bad"]);
  });

  it("sends once open, drops what is found too late", () => {
    expect(sortDue(list, start + 60_000).due.map((r) => r.mois)).toEqual(["2026-12"]);
    expect(sortDue(list, start + LATE_TOLERANCE_MS + 1).stale.map((r) => r.mois)).toContain("2026-12");
  });
});

describe("browser memory", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("records, reads and forgets a reminder", () => {
    const now = Date.parse("2026-11-24T12:00:00Z");
    writeReminder("2026-12", { calendar: true }, now);
    expect(readReminders()).toEqual({ "2026-12": { calendar: true } });
    writeReminder("2026-12", null, now);
    expect(readReminders()).toEqual({});
  });

  it("drops months long past", () => {
    store.set("mlbb_reminders", JSON.stringify({ "2025-01": { calendar: true } }));
    writeReminder("2026-12", { push: true }, Date.parse("2026-11-24T12:00:00Z"));
    expect(Object.keys(readReminders())).toEqual(["2026-12"]);
  });

  it("survives garbled or missing storage", () => {
    store.set("mlbb_reminders", "{not json");
    expect(readReminders()).toEqual({});
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readReminders()).toEqual({});
    expect(() => writeReminder("2026-12", { calendar: true })).not.toThrow();
  });
});
