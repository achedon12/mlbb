import { afterEach, describe, expect, it, vi } from "vitest";
import { clientAddress, trustedProxyHops } from "@/lib/client-address";

/**
 * The caller's address behind the reverse proxy: what the caller writes into
 * `X-Forwarded-For` itself must never be taken for its address.
 */
const headers = (forwarded?: string, extra: Record<string, string> = {}) =>
  new Headers({ ...(forwarded !== undefined ? { "x-forwarded-for": forwarded } : {}), ...extra });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("clientAddress", () => {
  it("takes the entry the nginx in front appended, not a forged left-most one", () => {
    expect(clientAddress(headers("1.2.3.4, 203.0.113.7"), 1)).toBe("203.0.113.7");
    expect(clientAddress(headers("203.0.113.7"), 1)).toBe("203.0.113.7");
  });

  it("counts the configured hops from the right", () => {
    // Caller forgery, then the CDN's view of the caller, then the CDN as seen by nginx.
    expect(clientAddress(headers("1.2.3.4, 203.0.113.7, 198.51.100.9"), 2)).toBe("203.0.113.7");
    expect(clientAddress(headers("2001:db8::1, 198.51.100.9"), 2)).toBe("2001:db8::1");
  });

  it("gives no address when the chain is shorter than the proxies in front", () => {
    expect(clientAddress(headers("203.0.113.7"), 2)).toBeNull();
  });

  it("trusts no header without a proxy in front", () => {
    expect(clientAddress(headers("203.0.113.7"), 0)).toBeNull();
  });

  it("drops what is not an IP address", () => {
    expect(clientAddress(headers("1.2.3.4, not-an-ip"), 1)).toBeNull();
    expect(clientAddress(headers("1.2.3.4, 203.0.113.7:4433"), 1)).toBeNull();
    expect(clientAddress(headers("1.2.3.4, "), 1)).toBeNull();
    expect(clientAddress(headers("999.1.1.1"), 1)).toBeNull();
  });

  it("ignores X-Real-IP, which the caller may have written itself", () => {
    expect(clientAddress(headers(undefined, { "x-real-ip": "203.0.113.7" }), 1)).toBeNull();
  });
});

describe("trustedProxyHops", () => {
  it("defaults to the single nginx and accepts a whole number of hops", () => {
    expect(trustedProxyHops()).toBe(1);
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(trustedProxyHops()).toBe(2);
    vi.stubEnv("TRUSTED_PROXY_HOPS", "0");
    expect(trustedProxyHops()).toBe(0);
  });

  it("falls back to the default on a bad value", () => {
    for (const value of ["-1", "1.5", "two", " "]) {
      vi.stubEnv("TRUSTED_PROXY_HOPS", value);
      expect(trustedProxyHops(), value).toBe(1);
    }
  });
});
