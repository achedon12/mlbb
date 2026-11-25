import { afterEach, describe, expect, it, vi } from "vitest";
import { lastKnownProfile, profile, resetBreakers } from "@/lib/mlbb-auth";

/**
 * The basic profile is asked for several times on one page view (header,
 * progress sync, account page): a success is kept a minute, an outage half
 * a minute, and the last good one stays readable through a short outage.
 */

const INFO = { code: 0, data: { roleId: 11, zoneId: 22, name: "Leo", level: 40, rank_level: 100, history_rank_level: 120, reg_country: "FR" } };

function answer(status: number, body: unknown = INFO) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetBreakers();
});

describe("profile memory", () => {
  it("asks the service once a minute for the same token", async () => {
    const fetcher = vi.fn(async () => answer(200));
    vi.stubGlobal("fetch", fetcher);
    const first = await profile("token-a");
    const second = await profile("token-a");
    expect(first).toEqual(second);
    expect(first.status).toBe("ok");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps an outage half a minute, and the last good profile through a 429", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => answer(200)));
    await profile("token-b");
    expect(lastKnownProfile("token-b")?.name).toBe("Leo");

    vi.advanceTimersByTime(61_000);
    const busy = vi.fn(async () => answer(429, {}));
    vi.stubGlobal("fetch", busy);
    expect((await profile("token-b")).status).toBe("unavailable");
    expect((await profile("token-b")).status).toBe("unavailable");
    // The second read comes from memory (and the breaker is open): one call only.
    expect(busy).toHaveBeenCalledTimes(1);
    expect(lastKnownProfile("token-b")?.name).toBe("Leo");
    expect(lastKnownProfile("token-other")).toBeNull();
  });

  it("forgets the last profile once the token is refused", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer(200)));
    await profile("token-c");
    vi.useFakeTimers();
    vi.advanceTimersByTime(61_000);
    vi.stubGlobal("fetch", vi.fn(async () => answer(401, {})));
    expect((await profile("token-c")).status).toBe("expired");
    expect(lastKnownProfile("token-c")).toBeNull();
  });
});
