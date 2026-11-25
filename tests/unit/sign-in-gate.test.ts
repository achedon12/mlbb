import { describe, expect, it } from "vitest";
import { DISCORD_COOKIE, GAME_COOKIE, signInRedirect } from "@/lib/sign-in-gate";

const none = () => false;
const only = (cookie: string) => (name: string) => name === cookie;

describe("sign-in gate of the account pages", () => {
  it("sends a visitor without any login to the sign-in, returning to the page", () => {
    expect(signInRedirect("/fr/account", none)).toBe("/fr/login?next=%2Ffr%2Faccount");
    expect(signInRedirect("/en/account/", none)).toBe("/en/login?next=%2Fen%2Faccount");
    expect(signInRedirect("/fr/account/profile", none)).toBe("/fr/login?next=%2Ffr%2Faccount%2Fprofile");
  });

  it("lets a login cookie through, for the page to check it", () => {
    expect(signInRedirect("/fr/account", only(GAME_COOKIE))).toBeNull();
    expect(signInRedirect("/fr/account", only(DISCORD_COOKIE))).toBeNull();
    expect(signInRedirect("/fr/account/profile", only(GAME_COOKIE))).toBeNull();
  });

  it("asks a Discord login alone for the game account on the game profile", () => {
    expect(signInRedirect("/fr/account/profile", only(DISCORD_COOKIE))).toBe("/fr/login?next=%2Ffr%2Faccount%2Fprofile");
  });

  it("leaves every other page alone", () => {
    for (const path of ["/fr/login", "/fr/accounts", "/fr/account/progress", "/xx/account", "/account", "/fr/heroes"]) {
      expect(signInRedirect(path, none), path).toBeNull();
    }
  });
});
