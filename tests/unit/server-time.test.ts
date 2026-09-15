import { describe, expect, it } from "vitest";
import {
  offsetTimezone,
  split,
  endsOfSeason,
  labelOffset,
  wallServer,
  nextEndSeason,
  nextResetWeekly,
  nextResetDaily,
  nextStarlight,
} from "@/lib/server-time";
import { patchDetails } from "@/lib/data";

const iso = (ms: number) => new Date(ms).toISOString();
const t = (s: string) => Date.parse(s);

describe("server time (UTC-8)", () => {
  it("gives the server's wall-clock time", () => {
    const m = wallServer(t("2026-09-11T08:00:00Z"));
    expect(m.getUTCHours()).toBe(0);
    expect(m.getUTCDate()).toBe(11);
  });

  it("sets the daily reset at 08:00 UTC, strictly after the instant", () => {
    expect(iso(nextResetDaily(t("2026-09-11T07:59:59Z")))).toBe("2026-09-11T08:00:00.000Z");
    expect(iso(nextResetDaily(t("2026-09-11T08:00:00Z")))).toBe("2026-09-12T08:00:00.000Z");
    expect(iso(nextResetDaily(t("2026-12-31T23:00:00Z")))).toBe("2027-01-01T08:00:00.000Z");
  });

  it("sets the weekly reset on Monday at 00:00 server time", () => {
    // Friday 11 September 2026 -> Monday 14.
    expect(iso(nextResetWeekly(t("2026-09-11T12:00:00Z")))).toBe("2026-09-14T08:00:00.000Z");
    // Monday 07:00 UTC: still Sunday 23:00 on the server.
    expect(iso(nextResetWeekly(t("2026-09-14T07:00:00Z")))).toBe("2026-09-14T08:00:00.000Z");
    expect(iso(nextResetWeekly(t("2026-09-14T08:00:00Z")))).toBe("2026-09-21T08:00:00.000Z");
  });

  it("restarts Starlight on the 1st of the month, next year included", () => {
    expect(iso(nextStarlight(t("2026-09-11T12:00:00Z")))).toBe("2026-10-01T08:00:00.000Z");
    expect(iso(nextStarlight(t("2026-10-01T07:59:00Z")))).toBe("2026-10-01T08:00:00.000Z");
    expect(iso(nextStarlight(t("2026-10-01T08:00:00Z")))).toBe("2026-11-01T08:00:00.000Z");
    expect(iso(nextStarlight(t("2026-12-15T00:00:00Z")))).toBe("2027-01-01T08:00:00.000Z");
  });
});

describe("durations and time zones", () => {
  it("splits a duration, never negative", () => {
    expect(split(90_061_000)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(split(999)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    expect(split(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("follows daylight saving time in IANA time zones", () => {
    expect(offsetTimezone("Europe/Paris", Date.UTC(2026, 6, 1))).toBe(120);
    expect(offsetTimezone("Europe/Paris", Date.UTC(2026, 0, 15))).toBe(60);
    expect(offsetTimezone("Asia/Kolkata", Date.UTC(2026, 6, 1))).toBe(330);
    expect(offsetTimezone("Etc/GMT+8", Date.UTC(2026, 6, 1))).toBe(-480);
  });

  it("writes the offset in the UTC+x style", () => {
    expect(labelOffset(330)).toBe("UTC+5:30");
    expect(labelOffset(-180)).toBe("UTC−3");
    expect(labelOffset(0)).toBe("UTC");
  });
});

describe("announced season ends", () => {
  const patch = (date: string, html: string) => ({ version: "x", link: "https://exemple", date, sections: [{ html }] });

  it("reads the server time of a season end and converts it to UTC", () => {
    const ends = endsOfSeason([patch("2024-03-05", "<li>S31 will end at 23:59:59 on 3/15 (Server Time).</li>")]);
    expect(ends).toHaveLength(1);
    expect(ends[0].season).toBe(31);
    expect(iso(ends[0].end)).toBe("2024-03-16T07:59:59.000Z");
  });

  it("moves to the next year for an end announced in December for January", () => {
    const ends = endsOfSeason([patch("2025-12-20", "S40 will end at 23:59:59 on 1/5 (Server Time).")]);
    expect(iso(ends[0].end)).toBe("2026-01-06T07:59:59.000Z");
  });

  it("keeps only upcoming ends", () => {
    const ends = endsOfSeason([patch("2024-03-05", "S31 will end at 23:59:59 on 3/15 (Server Time).")]);
    expect(nextEndSeason(ends, t("2024-03-10T00:00:00Z"))?.season).toBe(31);
    expect(nextEndSeason(ends, t("2026-09-11T00:00:00Z"))).toBeNull();
  });

  // The synced notes only keep the latest patches in detail, so an announcement
  // leaves the data once its patch is old enough: the real wording is frozen
  // here (patch 1.8.66, "Ranked" section) instead of being read from the data.
  it("finds a season end in the wording of a real patch note", () => {
    const html =
      '<h3 id="ranked"><span></span><span>[Ranked]</span></h3>\n<ol><li>S31 will end at 23:59:59 on 3/15 (Server Time).</li></ol>';
    const ends = endsOfSeason([patch("2024-03-05", html)]);
    expect(ends.map((f) => f.season)).toEqual([31]);
  });

  it("reads the synced notes without failing", () => {
    for (const end of endsOfSeason(Object.values(patchDetails))) {
      expect(Number.isInteger(end.season)).toBe(true);
      expect(Number.isFinite(end.end)).toBe(true);
    }
  });
});
