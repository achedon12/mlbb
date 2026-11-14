import { describe, expect, it, vi } from "vitest";

// The client log route would write to `logs/`: silence it.
vi.mock("@/lib/log", () => ({ log: vi.fn(async () => {}), logError: vi.fn(async () => {}) }));

const { addressOf, limitByMinute } = await import("@/lib/push-server");
const { POST: report } = await import("@/app/api/log/route");

/**
 * The per-route limits (notifications, community builds, client log) key
 * their windows on the address nginx saw: rewriting the left-most
 * `X-Forwarded-For` entry must not buy a fresh window.
 */
const request = (forwarded?: string, path = "/api/push/subscription") =>
  new Request(`http://127.0.0.1:3001${path}`, {
    method: "POST",
    headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded },
    body: JSON.stringify({ message: "boom" }),
  });

describe("addressOf", () => {
  it("ignores a forged left-most entry", () => {
    expect(addressOf(request("1.2.3.4, 203.0.113.30"))).toBe("203.0.113.30");
    const allowed = limitByMinute(5);
    const results = Array.from({ length: 6 }, (_, i) => allowed(addressOf(request(`10.0.0.${i}, 203.0.113.31`))));
    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it("puts requests without a trustworthy address in one window", () => {
    expect(addressOf(request())).toBe("unknown");
    expect(addressOf(request("not-an-ip"))).toBe("unknown");
    expect(addressOf(new Request("http://127.0.0.1:3001/", { headers: { "x-real-ip": "203.0.113.32" } }))).toBe(
      "unknown",
    );
  });
});

describe("client log limit", () => {
  it("refuses the 31st report of a minute despite a rotating forged entry", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      statuses.push((await report(request(`10.0.1.${i}, 203.0.113.33`, "/api/log"))).status);
    }
    expect(statuses.slice(0, 30).every((s) => s === 204)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    // Another caller behind the same nginx keeps its own window.
    expect((await report(request("10.0.1.99, 203.0.113.34", "/api/log"))).status).toBe(204);
  });
});
