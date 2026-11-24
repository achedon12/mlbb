import { describe, expect, it } from "vitest";
import {
  MAX_REMINDERS_BY_MONTH,
  MAX_REMINDERS_BY_SOURCE,
  admitReminder,
  sourceOf,
  type StoredReminder,
} from "@/lib/reminder-server";
import { MAX_REMINDERS_BY_BROWSER, monthStart } from "@/lib/reminders";

const NOW = Date.parse("2026-11-24T12:00:00Z");
const P256DH = `B${"A".repeat(86)}`; // 87 base64url characters: 65 bytes
const AUTH = "A".repeat(22); // 16 bytes

const subscription = (n: number | string, host = "fcm.googleapis.com", auth = AUTH) => ({
  endpoint: `https://${host}/fcm/send/${n}`,
  keys: { p256dh: P256DH, auth },
});

const stored = (n: number | string, month: string, source = "s1", extra: Partial<StoredReminder> = {}): StoredReminder => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${n}`,
  cles: { p256dh: P256DH, auth: AUTH },
  langue: "en",
  mois: month,
  source,
  cree: new Date(NOW).toISOString(),
  ...extra,
});

const ask = (sub: unknown, month = "2026-12", source = "s1") => ({ subscription: sub, locale: "en" as const, month, source });

describe("admitReminder: subscription shape", () => {
  it("accepts a subscription at a known push service", () => {
    for (const host of ["fcm.googleapis.com", "updates.push.services.mozilla.com", "wns2-par02p.notify.windows.com", "web.push.apple.com"]) {
      expect(admitReminder([], ask(subscription(1, host)), NOW).result).toBe("created");
    }
  });

  it("refuses an unknown host, plain http, credentials or an odd port", () => {
    for (const endpoint of [
      "https://evil.example/fcm/send/1",
      "https://fcm.googleapis.com.evil.example/x",
      "http://fcm.googleapis.com/fcm/send/1",
      "https://user:pass@fcm.googleapis.com/fcm/send/1",
      "https://fcm.googleapis.com:8443/fcm/send/1",
      "https://127.0.0.1/fcm/send/1",
    ]) {
      expect(admitReminder([], ask({ endpoint, keys: { p256dh: P256DH, auth: AUTH } }), NOW).result).toBe("invalid");
    }
  });

  it("refuses keys of the wrong shape or length", () => {
    for (const keys of [
      { p256dh: "short", auth: AUTH },
      { p256dh: P256DH, auth: "A".repeat(10) },
      { p256dh: `${P256DH.slice(0, -1)}+`, auth: AUTH },
      { p256dh: P256DH },
      null,
    ]) {
      expect(admitReminder([], ask({ endpoint: subscription(1).endpoint, keys }), NOW).result).toBe("invalid");
    }
  });
});

describe("admitReminder: caps", () => {
  it("does not store the same reminder twice", () => {
    expect(admitReminder([stored(1, "2026-12")], ask(subscription(1)), NOW).result).toBe("exists");
  });

  it("caps one endpoint, whatever auth key it comes with", () => {
    const months = Array.from({ length: MAX_REMINDERS_BY_BROWSER }, (_, i) => `2027-${String((i % 12) + 1).padStart(2, "0")}`);
    const list = months.map((m, i) => stored(1, m, `s${i}`, { cles: { p256dh: P256DH, auth: `${"B".repeat(21)}${i % 10}` } }));
    expect(admitReminder(list, ask(subscription(1, "fcm.googleapis.com", "C".repeat(22)), "2026-12", "fresh"), NOW).result).toBe("full");
  });

  it("caps one address across invented endpoints", () => {
    const list = Array.from({ length: MAX_REMINDERS_BY_SOURCE }, (_, i) => stored(`fake-${i}`, "2026-12", "attacker"));
    expect(admitReminder(list, ask(subscription("another"), "2026-12", "attacker"), NOW).result).toBe("limited");
    // Someone else is not blocked by it.
    expect(admitReminder(list, ask(subscription("real"), "2026-12", "someone"), NOW).result).toBe("created");
  });

  it("a full month leaves the other months open", () => {
    const list = Array.from({ length: MAX_REMINDERS_BY_MONTH }, (_, i) => stored(`f${i}`, "2026-12", `s${i}`));
    expect(admitReminder(list, ask(subscription("x"), "2026-12", "new"), NOW).result).toBe("full");
    expect(admitReminder(list, ask(subscription("x"), "2027-01", "new"), NOW).result).toBe("created");
  });

  it("purges reminders long past before counting", () => {
    const old = Array.from({ length: MAX_REMINDERS_BY_SOURCE }, (_, i) => stored(`old-${i}`, "2026-09", "s1"));
    const { result, list } = admitReminder(old, ask(subscription("new"), "2026-12", "s1"), NOW);
    expect(result).toBe("created");
    expect(list?.map((r) => r.mois)).toEqual(["2026-12"]);
  });

  it("writes the purge even when it refuses", () => {
    const list = [stored("old", "2026-09"), stored(1, "2026-12")];
    const outcome = admitReminder(list, ask(subscription(1)), NOW);
    expect(outcome.result).toBe("exists");
    expect(outcome.list?.map((r) => r.mois)).toEqual(["2026-12"]);
  });

  it("refuses a month already open", () => {
    expect(admitReminder([], ask(subscription(1), "2026-11"), NOW).result).toBe("past");
    expect(monthStart("2026-11")! < NOW).toBe(true);
  });
});

describe("sourceOf", () => {
  it("is stable per address and does not contain it", () => {
    expect(sourceOf("203.0.113.7")).toBe(sourceOf("203.0.113.7"));
    expect(sourceOf("203.0.113.7")).not.toBe(sourceOf("203.0.113.8"));
    expect(sourceOf("203.0.113.7")).toMatch(/^[0-9a-f]{16}$/);
  });
});
