import { afterEach, describe, expect, it, vi } from "vitest";
import { createBreaker, isOutage, retryAfterMs } from "@/lib/circuit-breaker";
import { connect, friends, profile, resetBreakers, sendCode } from "@/lib/mlbb-auth";

/**
 * The breaker in front of arena.rone.dev: a 429 or a 5xx pauses every call
 * (Retry-After, else a minute, doubling, capped at ten minutes), the first
 * real answer closes it again.
 */

describe("circuit breaker", () => {
  it("only counts overload and server errors as outages", () => {
    expect([429, 500, 502, 503].every(isOutage)).toBe(true);
    expect([200, 400, 401, 404].some(isOutage)).toBe(false);
  });

  it("reads Retry-After as seconds or as a date", () => {
    expect(retryAfterMs("120")).toBe(120_000);
    expect(retryAfterMs(new Date(10_000 + 30_000).toUTCString(), 10_000)).toBe(30_000);
    expect(retryAfterMs("soon")).toBeNull();
    expect(retryAfterMs(null)).toBeNull();
  });

  it("pauses a minute, then doubles on consecutive failures up to ten minutes", () => {
    const b = createBreaker();
    let now = 0;
    b.record(429, null, now);
    expect(b.paused(now + 59_000)).toBe(true);
    expect(b.paused(now + 60_000)).toBe(false);

    now += 60_000;
    b.record(503, null, now);
    expect(b.paused(now + 119_000)).toBe(true);
    expect(b.paused(now + 120_000)).toBe(false);

    for (let i = 0; i < 6; i++) {
      now += 11 * 60_000;
      b.record(500, null, now);
    }
    expect(b.paused(now + 10 * 60_000 - 1)).toBe(true);
    expect(b.paused(now + 10 * 60_000)).toBe(false);
  });

  it("follows Retry-After and caps it", () => {
    const b = createBreaker();
    b.record(429, "5", 0);
    expect(b.paused(4_999)).toBe(true);
    expect(b.paused(5_000)).toBe(false);
    b.reset();
    b.record(429, "86400", 0);
    expect(b.paused(10 * 60_000)).toBe(false);
  });

  it("does not stretch a running pause with answers already in flight", () => {
    const b = createBreaker();
    b.record(429, null, 0);
    b.record(429, null, 1_000);
    b.record(429, null, 2_000);
    expect(b.paused(60_000)).toBe(false);
  });

  it("resets on the first answer that is not an outage", () => {
    const b = createBreaker();
    b.record(429, null, 0);
    b.record(200, null, 1_000);
    expect(b.paused(1_000)).toBe(false);
    // Back to a one-minute pause, not a doubled one.
    b.record(429, null, 2_000);
    expect(b.paused(62_000)).toBe(false);
  });
});

function answer(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("arena.rone.dev behind the breaker", () => {
  afterEach(() => {
    resetBreakers();
    vi.unstubAllGlobals();
  });

  it("calls an overloaded service unavailable, not an unknown account or a wrong code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer(429)));
    expect(await sendCode(1, 2)).toEqual({ ok: false, reason: "loginForm.errors.unavailable" });
    resetBreakers();
    vi.stubGlobal("fetch", vi.fn(async () => answer(502)));
    expect(await connect(1, 2, 1234)).toEqual({ ok: false, reason: "loginForm.errors.unavailable" });
  });

  it("still tells an unknown account and a wrong code apart from an outage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer(400, { code: 1 })));
    expect(await sendCode(1, 2)).toEqual({ ok: false, reason: "loginForm.errors.unknown" });
    expect(await connect(1, 2, 1234)).toEqual({ ok: false, reason: "loginForm.errors.wrongCode" });
  });

  it("stops calling the service while paused", async () => {
    const busy = vi.fn(async () => answer(503, {}, { "retry-after": "30" }));
    vi.stubGlobal("fetch", busy);
    expect((await sendCode(1, 2)).reason).toBe("loginForm.errors.unavailable");
    expect((await connect(1, 2, 1234)).ok).toBe(false);
    expect((await profile("breaker-token")).status).toBe("unavailable");
    expect(busy).toHaveBeenCalledTimes(1);
  });

  it("pauses the friends list on its own host", async () => {
    const busy = vi.fn(async () => answer(429));
    vi.stubGlobal("fetch", busy);
    expect((await friends("x.e30.y")).status).toBe("unavailable");
    expect((await friends("x.e30.y")).status).toBe("unavailable");
    expect(busy).toHaveBeenCalledTimes(1);
  });
});
