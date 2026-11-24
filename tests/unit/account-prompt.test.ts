import { describe, expect, it } from "vitest";
import { momentEarned, promptAllowed } from "@/lib/account-prompt";
import { resolveOwner } from "@/lib/account-owner";
import { discordAccountId } from "@/lib/community/identity";

const NOW = Date.parse("2026-11-24T12:00:00Z");

describe("account prompt", () => {
  it("is earned on the third MLBBdle solve, a two-day quiz streak, any favourite", () => {
    expect(momentEarned("mlbbdle", { solves: 2 })).toBe(false);
    expect(momentEarned("mlbbdle", { solves: 3 })).toBe(true);
    expect(momentEarned("quiz", { streak: 1 })).toBe(false);
    expect(momentEarned("quiz", { streak: 2 })).toBe(true);
    expect(momentEarned("favourite", {})).toBe(true);
  });

  const allowed = (o: Partial<Parameters<typeof promptAllowed>[0]>) =>
    promptAllowed({ status: "signedOut", memory: {}, shownThisVisit: false, now: NOW, ...o });

  it("shows to a signed-out visitor who never closed it", () => {
    expect(allowed({})).toBe(true);
  });

  it("never to a signed-in player, nor on a site without account copies, nor before the state is known", () => {
    for (const status of ["saved", "saving", "paused", "unavailable", "checking", "retrying"]) expect(allowed({ status })).toBe(false);
  });

  it("once per visit", () => {
    expect(allowed({ shownThisVisit: true })).toBe(false);
  });

  it("not for two months after it was closed, again after", () => {
    expect(allowed({ memory: { dismissedUntil: NOW + 1 } })).toBe(false);
    expect(allowed({ memory: { dismissedUntil: NOW - 1 } })).toBe(true);
  });

  it("never again once followed, and never when storage refuses", () => {
    expect(allowed({ memory: { followed: true } })).toBe(false);
    expect(allowed({ memory: null })).toBe(false);
    expect(allowed({ shownThisVisit: null })).toBe(false);
  });
});

describe("progress owner", () => {
  const discord = { id: "123456789012345678", name: "Dex Fan", avatar: null };
  const game = { status: "ok" as const, id: "g".repeat(24), name: "GamePlayer" };

  it("is the game account when signed in with it", () => {
    expect(resolveOwner({ game, discord, link: null, now: NOW })).toMatchObject({ status: "ok", id: game.id, via: "game" });
  });

  it("is the linked game account for a linked Discord login", () => {
    const link = { linkedTo: game.id, primaryName: "GamePlayer", bannedAt: null, banUntil: null };
    expect(resolveOwner({ game: { status: "none" }, discord, link, now: NOW })).toMatchObject({ status: "ok", id: game.id, via: "discord" });
  });

  it("is the Discord account's own hash otherwise, never the Discord id", () => {
    const owner = resolveOwner({ game: { status: "none" }, discord, link: null, now: NOW });
    expect(owner).toMatchObject({ status: "ok", id: discordAccountId(discord.id), name: "Dex Fan" });
    expect(owner.status === "ok" && owner.id).not.toContain(discord.id);
  });

  it("refuses a banned Discord row, and nobody without a login", () => {
    const link = { linkedTo: null, primaryName: null, bannedAt: new Date(NOW - 1000), banUntil: null };
    expect(resolveOwner({ game: { status: "none" }, discord, link, now: NOW }).status).toBe("banned");
    expect(resolveOwner({ game: { status: "none" }, discord: null, link: null, now: NOW }).status).toBe("none");
    expect(resolveOwner({ game: { status: "unavailable" }, discord: null, link: null, now: NOW }).status).toBe("unavailable");
  });
});
