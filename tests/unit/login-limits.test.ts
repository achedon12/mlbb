import { describe, expect, it } from "vitest";
import { allowAccountCode, allowCodeCheck, allowCodeRequest, attemptsLeft, clearAccount, recordWrongCode } from "@/lib/login-limits";
import { loginHref, safeNext } from "@/lib/login-next";

describe("login limits", () => {
  it("allows five code requests and ten checks a minute per address", () => {
    const sends = Array.from({ length: 6 }, () => allowCodeRequest("203.0.113.1"));
    expect(sends).toEqual([true, true, true, true, true, false]);
    const checks = Array.from({ length: 11 }, () => allowCodeCheck("203.0.113.1"));
    expect(checks.filter(Boolean)).toHaveLength(10);
    expect(allowCodeRequest("203.0.113.2")).toBe(true);
  });

  it("sends an account three codes every ten minutes", () => {
    const t = 1_000_000;
    expect([0, 1, 2, 3].map((i) => allowAccountCode(11, 1, t + i))).toEqual([true, true, true, false]);
    expect(allowAccountCode(12, 1, t)).toBe(true);
    expect(allowAccountCode(11, 1, t + 10 * 60_000 - 1)).toBe(false);
    expect(allowAccountCode(11, 1, t + 10 * 60_000)).toBe(true);
  });

  it("burns a code after five wrong attempts, until a new one is sent", () => {
    const t = 2_000_000;
    for (let i = 0; i < 4; i++) recordWrongCode(21, 1, t);
    expect(attemptsLeft(21, 1, t)).toBe(true);
    recordWrongCode(21, 1, t);
    expect(attemptsLeft(21, 1, t)).toBe(false);
    expect(attemptsLeft(22, 1, t)).toBe(true);
    allowAccountCode(21, 1, t);
    expect(attemptsLeft(21, 1, t)).toBe(true);
  });

  it("forgets the attempts once the code is long expired, and on a sign-in", () => {
    const t = 3_000_000;
    for (let i = 0; i < 5; i++) recordWrongCode(31, 1, t);
    expect(attemptsLeft(31, 1, t + 10 * 60_000)).toBe(true);
    for (let i = 0; i < 5; i++) recordWrongCode(32, 1, t);
    clearAccount(32, 1);
    expect(attemptsLeft(32, 1, t)).toBe(true);
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
