import { describe, expect, it } from "vitest";
import { MAX_SKEW_SECONDS, ReplayGuard, sign, signedHeaders, verify } from "../src/security/signing.js";

const SECRET = "a".repeat(64);
const NOW = Date.UTC(2026, 10, 14, 12, 0, 0);

function request(overrides: Partial<Parameters<typeof verify>[0]> = {}) {
  const headers = signedHeaders(SECRET, "POST", "/internal/test-post", '{"a":1}', NOW);
  return {
    secret: SECRET,
    timestamp: headers["X-MLBBDex-Timestamp"],
    signature: headers["X-MLBBDex-Signature"],
    method: "POST",
    path: "/internal/test-post",
    body: '{"a":1}',
    now: NOW,
    ...overrides,
  };
}

describe("signing", () => {
  it("signs `${ts}.${METHOD}.${path}.${body}` with HMAC-SHA256 in hex", () => {
    // Reference value computed independently: printf '1700000000.GET./internal/stats.' | openssl dgst -sha256 -hmac "$SECRET"
    const signature = sign(SECRET, 1700000000, "get", "/internal/stats", "");
    expect(signature).toBe("25d336ee63e62bb854506ea4973b8c340e57861b3c0aee2ae6509cf569ecdbc8");
    expect(signature).toBe(sign(SECRET, 1700000000, "GET", "/internal/stats", ""));
  });

  it("accepts a fresh, untouched request", () => {
    expect(verify(request())).toEqual({ ok: true });
  });

  it("accepts a clock skew up to 300 s either way, and refuses beyond", () => {
    expect(verify(request({ now: NOW + MAX_SKEW_SECONDS * 1000 }))).toEqual({ ok: true });
    expect(verify(request({ now: NOW - MAX_SKEW_SECONDS * 1000 }))).toEqual({ ok: true });
    expect(verify(request({ now: NOW + (MAX_SKEW_SECONDS + 1) * 1000 }))).toEqual({ ok: false, reason: "skew" });
    expect(verify(request({ now: NOW - (MAX_SKEW_SECONDS + 1) * 1000 }))).toEqual({ ok: false, reason: "skew" });
  });

  it("refuses any tampering: body, path, method, timestamp, secret", () => {
    expect(verify(request({ body: '{"a":2}' }))).toEqual({ ok: false, reason: "mismatch" });
    expect(verify(request({ path: "/internal/announcements/flush" }))).toEqual({ ok: false, reason: "mismatch" });
    expect(verify(request({ method: "GET" }))).toEqual({ ok: false, reason: "mismatch" });
    const r = request();
    expect(verify({ ...r, timestamp: String(Number(r.timestamp) + 1) })).toEqual({ ok: false, reason: "mismatch" });
    expect(verify(request({ secret: "b".repeat(64) }))).toEqual({ ok: false, reason: "mismatch" });
  });

  it("refuses missing or malformed headers without throwing", () => {
    expect(verify(request({ signature: undefined }))).toEqual({ ok: false, reason: "missing" });
    expect(verify(request({ timestamp: undefined }))).toEqual({ ok: false, reason: "missing" });
    expect(verify(request({ signature: "zz" }))).toEqual({ ok: false, reason: "malformed" });
    expect(verify(request({ signature: "ab".repeat(16) }))).toEqual({ ok: false, reason: "malformed" });
    expect(verify(request({ timestamp: "12abc" }))).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses a replayed signature within the window", () => {
    const guard = new ReplayGuard();
    const { signature } = request();
    expect(guard.accept(signature!, NOW)).toBe(true);
    expect(guard.accept(signature!, NOW + 1000)).toBe(false);
    expect(guard.accept(signature!.toUpperCase(), NOW + 2000)).toBe(false);
  });

  it("forgets signatures once they are too old to verify anyway", () => {
    const guard = new ReplayGuard(1000);
    expect(guard.accept("ab".repeat(32), NOW)).toBe(true);
    expect(guard.accept("ab".repeat(32), NOW + 1001)).toBe(true);
  });

  it("keeps its memory bounded under a flood", () => {
    const guard = new ReplayGuard(60_000, 3);
    for (const s of ["a", "b", "c", "d"]) expect(guard.accept(s.repeat(64), NOW)).toBe(true);
    expect(guard.accept("d".repeat(64), NOW)).toBe(false);
  });
});
