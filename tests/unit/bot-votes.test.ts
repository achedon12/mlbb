import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authorizationMatches, dblVote, parseTopggSignature, topggVote, TOPGG_MAX_AGE_S, verifyTopggSignature } from "@/lib/bot/votes";

const SECRET = "whs_" + "s".repeat(40);
const NOW = Date.UTC(2026, 10, 14, 12, 0, 0);
const T = Math.floor(NOW / 1000);
const BODY = JSON.stringify({ type: "vote.create", data: { user: { platform_id: "123456789012345678" } } });
const header = (body = BODY, t = T, secret = SECRET) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("top.gg v1 signature", () => {
  it("accepts the documented signature of the raw body", () => {
    expect(verifyTopggSignature(header(), BODY, SECRET, NOW).ok).toBe(true);
  });

  it("refuses another body, another secret, or no signature", () => {
    expect(verifyTopggSignature(header(), BODY.replace("678", "679"), SECRET, NOW).ok).toBe(false);
    expect(verifyTopggSignature(header(BODY, T, "whs_" + "x".repeat(40)), BODY, SECRET, NOW).ok).toBe(false);
    expect(verifyTopggSignature(null, BODY, SECRET, NOW).ok).toBe(false);
    expect(verifyTopggSignature(header(), BODY, "", NOW).ok).toBe(false);
  });

  it("refuses a timestamp more than five minutes away", () => {
    expect(verifyTopggSignature(header(BODY, T - TOPGG_MAX_AGE_S - 1), BODY, SECRET, NOW).ok).toBe(false);
    expect(verifyTopggSignature(header(BODY, T + TOPGG_MAX_AGE_S + 1), BODY, SECRET, NOW).ok).toBe(false);
    expect(verifyTopggSignature(header(BODY, T - TOPGG_MAX_AGE_S + 1), BODY, SECRET, NOW).ok).toBe(true);
  });

  it("gives the same key for the same delivery, for the replay guard", () => {
    const a = verifyTopggSignature(header(), BODY, SECRET, NOW);
    const b = verifyTopggSignature(header(), BODY, SECRET, NOW + 1000);
    expect(a.ok && b.ok && a.signature === b.signature).toBe(true);
  });

  it("parses the header strictly", () => {
    expect(parseTopggSignature("t=1,v1=" + "a".repeat(64))).toEqual({ timestamp: 1, signatures: ["a".repeat(64)] });
    expect(parseTopggSignature("v1=" + "a".repeat(64))).toBeNull();
    expect(parseTopggSignature("t=1")).toBeNull();
    expect(parseTopggSignature("t=1,v1=zz")).toBeNull();
    expect(parseTopggSignature("t=1,t=2,v1=" + "a".repeat(64))).toBeNull();
  });
});

describe("shared-secret webhooks (top.gg legacy, discordbotlist.com)", () => {
  it("compares the Authorization header with the secret", () => {
    expect(authorizationMatches(SECRET, SECRET)).toBe(true);
    expect(authorizationMatches(SECRET + "x", SECRET)).toBe(false);
    expect(authorizationMatches(`Bearer ${SECRET}`, SECRET)).toBe(false);
    expect(authorizationMatches(null, SECRET)).toBe(false);
    // An unset or short secret never matches, not even an empty header.
    expect(authorizationMatches("", "")).toBe(false);
    expect(authorizationMatches("short", "short")).toBe(false);
  });
});

describe("vote payloads", () => {
  it("reads the voter from top.gg v1 and legacy payloads; tests count nothing", () => {
    expect(topggVote.parse(JSON.parse(BODY))).toBe("123456789012345678");
    expect(topggVote.parse({ type: "webhook.test", data: { user: { platform_id: "123456789012345678" } } })).toBeNull();
    expect(topggVote.parse({ user: "123456789012345678", type: "upvote" })).toBe("123456789012345678");
    expect(topggVote.parse({ user: "123456789012345678", type: "test" })).toBeNull();
    expect(topggVote.safeParse({ user: "not-an-id", type: "upvote" }).success).toBe(false);
  });

  it("reads the voter from discordbotlist.com", () => {
    expect(dblVote.parse({ id: "123456789012345678", username: "x", avatar: null, admin: false })).toBe("123456789012345678");
    expect(dblVote.safeParse({ id: "1" }).success).toBe(false);
  });
});
