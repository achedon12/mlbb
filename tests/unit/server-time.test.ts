import { describe, expect, it } from "vitest";
import {
  COUNTRIES_WORLD,
  currentSeason,
  offsetTimezone,
  split,
  labelOffset,
  wallServer,
  nextResetWeekly,
  nextResetDaily,
  nextSeason,
  nextStarlight,
  readServerDate,
  seasonAnnouncements,
  seasonCalendar,
  seasonsEditorial,
} from "@/lib/server-time";
import { patchDetails } from "@/lib/data";
import seasonsData from "@/data/editorial/seasons.json";

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
describe("ranked seasons", () => {
  const patch = (html: string, link = "https://exemple") => ({ link, sections: [{ html }] });
  const editorial = seasonsEditorial(seasonsData.seasons);

  it("reads a server wall-clock date as UTC-8", () => {
    expect(iso(readServerDate("2026-09-16T00:00:00")!)).toBe("2026-09-16T08:00:00.000Z");
    expect(iso(readServerDate("2026-09-15T21:59:59")!)).toBe("2026-09-16T05:59:59.000Z");
    expect(iso(readServerDate("2026-09-16")!)).toBe("2026-09-16T08:00:00.000Z");
    expect(readServerDate(null)).toBeNull();
    expect(readServerDate("16/09/2026")).toBeNull();
  });

  // The real wordings, frozen here (patches 2.2.16 and 1.8.66): the synced
  // notes only keep the latest patches in detail.
  it("reads both wordings of a season bound in a patch note", () => {
    const a = seasonAnnouncements([
      patch(
        "<li>S41 will end at 21:59:59 on September 15 (Server Time).</li><li>S42 will start from 00:00:00 on September 16 (Server Time).</li>",
      ),
      patch('<h3 id="ranked">[Ranked]</h3>\n<ol><li>S31 will end at 23:59:59 on 3/15 (Server Time).</li></ol>'),
    ]);
    expect(a.map((x) => [x.season, x.kind, x.month, x.day, x.hour])).toEqual([
      [41, "end", 9, 15, 21],
      [42, "start", 9, 16, 0],
      [31, "end", 3, 15, 23],
    ]);
  });

  it("anchors an announcement's year on the season it follows, never on the patch date", () => {
    const base = [{ season: 42, start: readServerDate("2026-09-16T00:00:00"), end: null, source: "https://s42" }];
    const calendar = seasonCalendar(
      base,
      seasonAnnouncements([
        patch("S42 will end at 21:59:59 on 12/15 (Server Time). S43 will start from 00:00:00 on 12/16 (Server Time)."),
      ]),
    );
    expect(calendar.map((s) => [s.season, s.start && iso(s.start), s.end && iso(s.end)])).toEqual([
      [42, "2026-09-16T08:00:00.000Z", "2026-12-16T05:59:59.000Z"],
      [43, "2026-12-16T08:00:00.000Z", null],
    ]);
    // A season end in January follows a start in the autumn: next year.
    const january = seasonCalendar(base, seasonAnnouncements([patch("S42 will end at 21:59:59 on 1/5 (Server Time).")]));
    expect(iso(january[0].end!)).toBe("2027-01-06T05:59:59.000Z");
  });

  it("keeps the editorial dates and ignores old announcements", () => {
    const calendar = seasonCalendar(
      editorial,
      seasonAnnouncements([
        // An old note the wiki dates this year: it must not reopen season 38 or 34.
        patch("S34 will end at 21:59:59 on 12/21 (Server Time). S38 will end at 21:59:59 on 12/17 (Server Time)."),
        patch("S41 will end at 21:59:59 on 9/1 (Server Time)."),
      ]),
    );
    expect(calendar.map((s) => s.season)).toEqual(editorial.map((s) => s.season));
    expect(calendar.find((s) => s.season === 41)?.end).toBe(readServerDate("2026-09-15T21:59:59"));
  });

  it("finds the season under way and the next one", () => {
    const calendar = seasonCalendar(
      [
        { season: 41, start: readServerDate("2026-06-17T00:00:00"), end: readServerDate("2026-09-15T21:59:59"), source: null },
        { season: 42, start: readServerDate("2026-09-16T00:00:00"), end: null, source: null },
      ],
      [],
    );
    expect(currentSeason(calendar, t("2026-11-14T00:00:00Z"))?.season).toBe(42);
    expect(currentSeason(calendar, t("2026-07-01T00:00:00Z"))?.season).toBe(41);
    // Between the end of 41 (05:59:59 UTC) and the start of 42 (08:00 UTC).
    expect(currentSeason(calendar, t("2026-09-16T07:00:00Z"))).toBeNull();
    expect(nextSeason(calendar, t("2026-09-16T07:00:00Z"))?.season).toBe(42);
    expect(nextSeason(calendar, t("2026-11-14T00:00:00Z"))).toBeNull();
  });

  it("keeps a valid editorial file: increasing seasons, dated sources, ends after starts", () => {
    expect(seasonsData.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const seasons = seasonsData.seasons;
    seasons.forEach((s, i) => {
      if (i > 0) expect(s.season).toBe(seasons[i - 1].season + 1);
      expect(readServerDate(s.start)).not.toBeNull();
      if (s.end !== null) expect(readServerDate(s.end)!).toBeGreaterThan(readServerDate(s.start)!);
      expect(s.source).toMatch(/^https:\/\//);
    });
  });

  it("reads the synced notes without failing", () => {
    for (const s of seasonCalendar(editorial, seasonAnnouncements(Object.values(patchDetails)))) {
      expect(Number.isInteger(s.season)).toBe(true);
      if (s.start !== null) expect(Number.isFinite(s.start)).toBe(true);
      if (s.end !== null) expect(Number.isFinite(s.end)).toBe(true);
    }
  });
});

describe("world reset table", () => {
  it("lists every main market once, with a valid time zone", () => {
    const keys = COUNTRIES_WORLD.map((c) => `${c.country}-${c.timezone}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const country of ["PH", "ID", "MY", "SG", "TH", "VN", "MM", "KH", "BR", "FR", "RU", "TR", "IN", "JP"]) {
      expect(COUNTRIES_WORLD.some((c) => c.country === country)).toBe(true);
    }
    expect(COUNTRIES_WORLD.filter((c) => c.country === "US")).toHaveLength(2);
    for (const c of COUNTRIES_WORLD) expect(() => offsetTimezone(c.timezone, Date.now())).not.toThrow();
  });

  it("computes the local reset from Intl, daylight saving time included", () => {
    // Daily reset at 08:00 UTC: 16:00 in Manila all year, 09:00 or 10:00 in Paris.
    const winter = nextResetDaily(t("2026-01-10T00:00:00Z"));
    const summer = nextResetDaily(t("2026-07-10T00:00:00Z"));
    const hour = (ms: number, zone: string) =>
      new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: zone }).format(ms);
    expect(hour(winter, "Asia/Manila")).toBe("16:00");
    expect(hour(summer, "Asia/Manila")).toBe("16:00");
    expect(hour(winter, "Europe/Paris")).toBe("09:00");
    expect(hour(summer, "Europe/Paris")).toBe("10:00");
    expect(hour(summer, "America/Los_Angeles")).toBe("01:00");
  });
});
