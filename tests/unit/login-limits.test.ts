import { describe, expect, it } from "vitest";
import {
  allowAccountCode,
  allowCodeCheck,
  allowCodeRequest,
  cap,
  clearAccount,
  refundAttempt,
  reserveAttempt,
} from "@/lib/login-limits";
import { limitByMinute } from "@/lib/push-server";
import { loginHref, safeNext } from "@/lib/login-next";

describe("login limits", () => {
  it("allows five code requests and ten checks a minute per address", () => {
    const sends = Array.from({ length: 6 }, () => allowCodeRequest("203.0.113.1"));
    expect(sends).toEqual([true, true, true, true, true, false]);
    const checks = Array.from({ length: 11 }, () => allowCodeCheck("203.0.113.1"));
    expect(checks.filter(Boolean)).toHaveLength(10);
    expect(allowCodeRequest("203.0.113.2")).toBe(true);
  });

  it("sends an account three codes every ten minutes per address", () => {
    const t = 1_000_000;
    expect([0, 1, 2, 3].map((i) => allowAccountCode(11, 1, "a", t + i))).toEqual([true, true, true, false]);
    expect(allowAccountCode(12, 1, "a", t)).toBe(true);
    expect(allowAccountCode(11, 1, "a", t + 10 * 60_000 - 1)).toBe(false);
    expect(allowAccountCode(11, 1, "a", t + 10 * 60_000)).toBe(true);
  });

  it("does not let a stranger lock the player out, but caps the account at ten codes", () => {
    const t = 1_500_000;
    for (let i = 0; i < 3; i++) expect(allowAccountCode(13, 1, "attacker", t)).toBe(true);
    expect(allowAccountCode(13, 1, "attacker", t)).toBe(false);
    // The player, from their own address, still gets a code.
    expect(allowAccountCode(13, 1, "player", t)).toBe(true);
    // Many addresses together stop at ten codes for the account.
    const spread = Array.from({ length: 10 }, (_, i) => allowAccountCode(13, 1, `bot-${i}`, t));
    expect(spread.filter(Boolean)).toHaveLength(6);
    expect(allowAccountCode(13, 1, "someone-else", t)).toBe(false);
  });

  it("burns a code after five attempts, until a new one is sent", () => {
    const t = 2_000_000;
    expect(Array.from({ length: 6 }, () => reserveAttempt(21, 1, t))).toEqual([true, true, true, true, true, false]);
    expect(reserveAttempt(22, 1, t)).toBe(true);
    allowAccountCode(21, 1, "a", t);
    expect(reserveAttempt(21, 1, t)).toBe(true);
  });

  it("reserves attempts before the service answers: parallel checks cannot pass the limit", async () => {
    const t = 2_500_000;
    let judged = 0;
    // Twenty checks from as many addresses, all in flight at once.
    const check = async () => {
      if (!reserveAttempt(23, 1, t)) return "refused";
      await new Promise((r) => setTimeout(r, 5));
      judged += 1;
      return "wrong";
    };
    const results = await Promise.all(Array.from({ length: 20 }, check));
    expect(judged).toBe(5);
    expect(results.filter((r) => r === "refused")).toHaveLength(15);
  });

  it("gives an attempt back on an outage, never below zero", () => {
    const t = 2_700_000;
    for (let i = 0; i < 5; i++) reserveAttempt(24, 1, t);
    expect(reserveAttempt(24, 1, t)).toBe(false);
    refundAttempt(24, 1);
    expect(reserveAttempt(24, 1, t)).toBe(true);
    expect(reserveAttempt(24, 1, t)).toBe(false);
    refundAttempt(25, 1);
    expect(reserveAttempt(25, 1, t)).toBe(true);
  });

  it("forgets the attempts once the code is long expired, and on a sign-in", () => {
    const t = 3_000_000;
    for (let i = 0; i < 5; i++) reserveAttempt(31, 1, t);
    expect(reserveAttempt(31, 1, t + 10 * 60_000)).toBe(true);
    for (let i = 0; i < 5; i++) reserveAttempt(32, 1, t);
    clearAccount(32, 1);
    expect(reserveAttempt(32, 1, t)).toBe(true);
  });
});

describe("bounded memory", () => {
  it("drops expired entries before live ones", () => {
    const map = new Map<string, { live: boolean }>([
      ["victim", { live: true }],
      ...Array.from({ length: 5 }, (_, i) => [`junk-${i}`, { live: false }] as [string, { live: boolean }]),
    ]);
    cap(map, (v) => !v.live, 3);
    expect(map.has("victim")).toBe(true);
    expect(map.size).toBe(1);
  });

  it("drops the oldest only when everything is live", () => {
    const map = new Map(Array.from({ length: 5 }, (_, i) => [`k${i}`, i]));
    cap(map, () => false, 3);
    expect([...map.keys()]).toEqual(["k2", "k3", "k4"]);
  });

  it("keeps a live per-minute window when the map fills with fresh addresses", () => {
    const allowed = limitByMinute(2, 10);
    allowed("victim");
    allowed("victim");
    expect(allowed("victim")).toBe(false);
    // Fresh addresses push the oldest out, but no full reset happens on the way.
    for (let i = 0; i < 9; i++) allowed(`flood-${i}`);
    expect(allowed("victim")).toBe(false);
  });
});

describe("return after sign-in", () => {
  it("keeps the site's own paths", () => {
    expect(safeNext("/fr/heroes/miya")).toBe("/fr/heroes/miya");
    expect(safeNext("/builds/abc?tab=votes#top")).toBe("/builds/abc?tab=votes#top");
    expect(safeNext("/account")).toBe("/account");
  });

  it("refuses anything that could leave the site or loop", () => {
    for (const raw of [
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "https://evil.example",
      "evil.example",
      "javascript:alert(1)",
      "/\nfoo",
      "",
      "/login",
      "/fr/login?next=/x",
      "/api/session",
      "/" + "a".repeat(600),
      null,
      undefined,
      ["/heroes"],
    ]) {
      expect(safeNext(raw)).toBeNull();
    }
  });

  it("builds the login address with the return path", () => {
    expect(loginHref("/fr/collection")).toBe("/login?next=%2Ffr%2Fcollection");
    expect(loginHref("//evil.example")).toBe("/login");
    expect(loginHref(null)).toBe("/login");
    expect(loginHref("/fr/heroes", { from: "prompt" })).toBe("/login?from=prompt&next=%2Ffr%2Fheroes");
  });
});
