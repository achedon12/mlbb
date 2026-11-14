import { describe, expect, it } from "vitest";
import { originAllowed } from "@/lib/bot/dashboard-guard";
import { authorizeUrl, callbackQuery, challengeOf, createState, createVerifier, isState, isVerifier } from "@/lib/bot/oauth";
import { seal, unseal } from "@/lib/bot/seal";
import { openOAuth, openSession, sealSession } from "@/lib/bot/session";

const config = { sessionSecret: "s".repeat(64) };
const USER = { id: "123456789012345678", name: "Leo", avatar: null };

describe("Discord OAuth helpers", () => {
  it("derives the S256 challenge of RFC 7636 (appendix B)", () => {
    expect(challengeOf("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates verifiers and states of the expected form, never twice the same", () => {
    const verifiers = new Set(Array.from({ length: 50 }, createVerifier));
    const states = new Set(Array.from({ length: 50 }, createState));
    expect(verifiers.size).toBe(50);
    expect(states.size).toBe(50);
    for (const v of verifiers) expect(isVerifier(v)).toBe(true);
    for (const s of states) expect(isState(s)).toBe(true);
    expect(isState("short")).toBe(false);
  });

  it("asks for identify only, with PKCE S256 and the state", () => {
    const url = new URL(
      authorizeUrl({ clientId: "123456789012345678", redirectUri: "https://mlbbdex.com/api/discord/callback", state: "st", challenge: "ch" }),
    );
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(url.searchParams.get("scope")).toBe("identify");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("redirect_uri")).toBe("https://mlbbdex.com/api/discord/callback");
  });

  it("bounds the callback parameters", () => {
    const state = createState();
    expect(callbackQuery.safeParse({ code: "abcdefghijklmnop", state }).success).toBe(true);
    expect(callbackQuery.safeParse({ code: "abc", state }).success).toBe(false);
    expect(callbackQuery.safeParse({ code: "x".repeat(201), state }).success).toBe(false);
    expect(callbackQuery.safeParse({ code: "abcdefghijk<script>", state }).success).toBe(false);
    expect(callbackQuery.safeParse({ code: "abcdefghijklmnop", state: "nope" }).success).toBe(false);
  });
});

describe("sealed cookies", () => {
  it("opens what it sealed, until it expires", () => {
    const now = Date.now();
    const sealed = seal("k".repeat(40), "session", { a: 1 }, 60, now);
    expect(unseal("k".repeat(40), "session", sealed, now)).toEqual({ a: 1 });
    expect(unseal("k".repeat(40), "session", sealed, now + 61_000)).toBeNull();
  });

  it("refuses a tampered value, another key or another purpose", () => {
    const sealed = seal("k".repeat(40), "session", { a: 1 }, 60);
    const bytes = Buffer.from(sealed, "base64url");
    bytes[bytes.length - 1] ^= 1;
    expect(unseal("k".repeat(40), "session", bytes.toString("base64url"))).toBeNull();
    expect(unseal("j".repeat(40), "session", sealed)).toBeNull();
    expect(unseal("k".repeat(40), "oauth", sealed)).toBeNull();
    expect(unseal("k".repeat(40), "session", "not base64!")).toBeNull();
    expect(unseal("k".repeat(40), "session", undefined)).toBeNull();
  });

  it("keeps the session shape: an OAuth value does not open as a session", () => {
    const sealed = sealSession(config, USER);
    expect(openSession(config, sealed)).toEqual(USER);
    expect(openOAuth(config, sealed)).toBeNull();
    const pending = seal(config.sessionSecret, "oauth", { state: "s", verifier: "v", locale: "fr", next: "elsewhere" }, 60);
    // `next` is an enum of the site's own pages: anything else is refused.
    expect(openOAuth(config, pending)).toBeNull();
  });
});

describe("dashboard origin check", () => {
  const site = "https://mlbbdex.com";
  it("accepts the public origin only, in production", () => {
    expect(originAllowed("https://mlbbdex.com", site, "http://mlbb:3001/api/discord/logout", true)).toBe(true);
    expect(originAllowed("https://evil.example", site, "http://mlbb:3001/api/discord/logout", true)).toBe(false);
    expect(originAllowed("http://mlbb:3001", site, "http://mlbb:3001/api/discord/logout", true)).toBe(false);
    expect(originAllowed(null, site, "http://mlbb:3001/x", true)).toBe(false);
    expect(originAllowed("null", site, "http://mlbb:3001/x", true)).toBe(false);
  });

  it("also accepts the address the request was sent to, in development", () => {
    expect(originAllowed("http://localhost:3013", site, "http://localhost:3013/api/discord/logout", false)).toBe(true);
    expect(originAllowed("http://localhost:9999", site, "http://localhost:3013/api/discord/logout", false)).toBe(false);
  });
});
