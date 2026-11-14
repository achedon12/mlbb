import { NextRequest, type NextFetchEvent } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

/**
 * The API rate limit, keyed by the address nginx saw: rewriting the
 * left-most `X-Forwarded-For` entry must not buy a fresh window. Each case
 * uses addresses of its own, the windows living in the module.
 */
const LIMIT = 90;
const event = { waitUntil: () => {} } as unknown as NextFetchEvent;

function status(forwarded?: string) {
  const headers = forwarded === undefined ? undefined : { "x-forwarded-for": forwarded };
  return proxy(new NextRequest("http://127.0.0.1:3001/api/v1/patches", { headers }), event).status;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("API rate limit", () => {
  it("ignores a forged left-most entry", () => {
    const statuses = Array.from({ length: LIMIT + 1 }, (_, i) => status(`10.0.0.${i % 250}, 203.0.113.20`));
    expect(statuses.slice(0, LIMIT).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("tells callers apart by the entry nginx appended", () => {
    for (let i = 0; i < LIMIT; i++) status("203.0.113.21");
    expect(status("203.0.113.21")).toBe(429);
    expect(status("1.2.3.4, 203.0.113.22")).toBe(200);
  });

  it("respects the configured number of hops", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    // The right-most entry is the CDN, shared by every caller behind it.
    for (let i = 0; i < LIMIT; i++) status("203.0.113.23, 198.51.100.50");
    expect(status("203.0.113.23, 198.51.100.50")).toBe(429);
    expect(status("203.0.113.24, 198.51.100.50")).toBe(200);
  });

  it("puts requests without a valid address in one shared window", () => {
    const statuses = Array.from({ length: LIMIT + 1 }, (_, i) =>
      status(i % 3 === 0 ? undefined : i % 3 === 1 ? "not-an-ip" : "1.2.3.4, 203.0.113.25:80"),
    );
    expect(statuses.at(-1)).toBe(429);
  });
});
