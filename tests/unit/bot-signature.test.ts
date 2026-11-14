import { describe, expect, it } from "vitest";
import {
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  MAX_SKEW_S,
  ReplayGuard,
  sign,
  signedHeaders,
  signedPath,
  verify,
} from "@/lib/bot/signature";

const SECRET = "a".repeat(64);
const NOW = Date.UTC(2026, 10, 14, 12, 0, 0);
const PATH = "/api/bot/daily?day=2026-11-14&locale=fr";
const BODY = JSON.stringify({ full: true, guilds: [] });

function request(o: { method?: string; path?: string; body?: string; at?: number; secret?: string } = {}) {
  const headers = signedHeaders(o.secret ?? SECRET, o.method ?? "POST", o.path ?? PATH, o.body ?? BODY, o.at ?? NOW);
  return { timestamp: headers[HEADER_TIMESTAMP], signature: headers[HEADER_SIGNATURE] };
}

const check = (
  signed: { timestamp: string | null; signature: string | null },
  o: { method?: string; path?: string; body?: string; now?: number; secret?: string | null; guard?: ReplayGuard } = {},
) =>
  verify({
    secret: o.secret === undefined ? SECRET : o.secret,
    method: o.method ?? "POST",
    path: o.path ?? PATH,
    body: o.body ?? BODY,
    now: o.now ?? NOW,
    guard: o.guard,
    ...signed,
  });

describe("bot request signing", () => {
  it("signs timestamp, method, path and body as hex HMAC-SHA256", () => {
    // Reference value computed independently: printf '1700000000.GET./x.' | openssl dgst -sha256 -hmac key
    expect(sign("key", 1_700_000_000, "GET", "/x", "")).toBe("2215b9c92cc9303e038f9338bcf026027d1f6127ef165945188e835b4c3671c4");
    // The method is upper-cased: both sides agree whatever their HTTP library sends.
    expect(sign("key", 1_700_000_000, "get", "/x", "")).toBe(sign("key", 1_700_000_000, "GET", "/x", ""));
  });

  it("accepts a request it signed", () => {
    expect(check(request())).toEqual({ ok: true });
  });

  it("refuses a changed body, path, method or secret", () => {
    const signed = request();
    expect(check(signed, { body: BODY.replace("true", "false") })).toEqual({ ok: false, reason: "signature" });
    expect(check(signed, { path: "/api/bot/daily?day=2026-11-15&locale=fr" })).toEqual({ ok: false, reason: "signature" });
    expect(check(signed, { method: "PUT" })).toEqual({ ok: false, reason: "signature" });
    expect(check(signed, { secret: "b".repeat(64) })).toEqual({ ok: false, reason: "signature" });
  });

  it("refuses a timestamp more than five minutes away, both ways", () => {
    expect(check(request({ at: NOW - (MAX_SKEW_S + 1) * 1000 }))).toEqual({ ok: false, reason: "skew" });
    expect(check(request({ at: NOW + (MAX_SKEW_S + 1) * 1000 }))).toEqual({ ok: false, reason: "skew" });
    expect(check(request({ at: NOW - (MAX_SKEW_S - 1) * 1000 }))).toEqual({ ok: true });
  });

  it("refuses the same request played twice", () => {
    const guard = new ReplayGuard();
    const signed = request();
    expect(check(signed, { guard })).toEqual({ ok: true });
    expect(check(signed, { guard })).toEqual({ ok: false, reason: "replay" });
    // Another request in the same second is a new signature.
    expect(check(request({ body: "{}" }), { guard, body: "{}" })).toEqual({ ok: true });
  });

  it("forgets accepted signatures once they could no longer be valid", () => {
    const guard = new ReplayGuard();
    expect(guard.accept("x", 1_000)).toBe(true);
    expect(guard.accept("x", 1_000 + 2 * MAX_SKEW_S)).toBe(false);
    expect(guard.accept("x", 1_000 + 2 * MAX_SKEW_S + 1)).toBe(true);
  });

  it("refuses everything without a secret, and requests without headers", () => {
    expect(check(request(), { secret: "" })).toEqual({ ok: false, reason: "no-secret" });
    expect(check(request(), { secret: null })).toEqual({ ok: false, reason: "no-secret" });
    expect(check({ timestamp: null, signature: null })).toEqual({ ok: false, reason: "missing" });
    expect(check({ timestamp: "abc", signature: "zz" })).toEqual({ ok: false, reason: "signature" });
  });

  it("signs the path with its query string, as sent", () => {
    expect(signedPath("http://mlbb:3001/api/bot/daily?day=2026-11-14&locale=fr")).toBe(PATH);
    expect(signedPath("http://mlbb:3001/api/bot/guilds/sync")).toBe("/api/bot/guilds/sync");
  });
});
