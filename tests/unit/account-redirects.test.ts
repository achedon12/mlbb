import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/mlbb-auth";

/**
 * What the account pages may trust: the former progress page only ever
 * redirects within the site, and the account page only shows the id and the
 * Discord card of a profile the login service confirmed for the token.
 */

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  permanentRedirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

const { default: ProgressPage } = await import("@/app/[locale]/account/progress/page");
const { confirmedProfile } = await import("@/lib/session");

const visit = (locale: string) => ProgressPage({ params: Promise.resolve({ locale }) });

describe("the former progress page", () => {
  it("redirects to the account page's progress section", async () => {
    await expect(visit("fr")).rejects.toThrow("REDIRECT /fr/account#progress");
    await expect(visit("en")).rejects.toThrow("REDIRECT /en/account#progress");
  });

  it("never builds an address from an unknown language", async () => {
    for (const locale of ["/evil.com", "evil.com", "", "..", "fr/../x", "\\evil.com"]) {
      await expect(visit(locale)).rejects.toThrow("NOT_FOUND");
    }
  });
});

describe("confirmedProfile", () => {
  const PROFILE: Profile = { roleId: 7, zoneId: 8, name: "Leo", level: 1, rankCurrent: 1, rankMax: 1, country: "FR", avatar: null };

  it("is the service's profile, live or last known for this token", () => {
    expect(confirmedProfile({ state: "ok", token: "t", profile: PROFILE })).toBe(PROFILE);
    expect(confirmedProfile({ state: "unavailable", token: "t", lastKnown: PROFILE })).toBe(PROFILE);
  });

  it("is nothing while the service never confirmed the token, whatever the token claims", () => {
    // A token carrying another player's ids in its unchecked claims.
    const forged = `x.${Buffer.from(JSON.stringify({ Ext: { roleId: 999, zoneId: 1 } })).toString("base64url")}.y`;
    expect(confirmedProfile({ state: "unavailable", token: forged, lastKnown: null })).toBeNull();
    expect(confirmedProfile({ state: "expired" })).toBeNull();
    expect(confirmedProfile({ state: "missing" })).toBeNull();
  });
});
