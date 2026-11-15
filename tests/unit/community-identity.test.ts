import { describe, expect, it } from "vitest";
import {
  DISCORD_EPOCH_MS,
  DISCORD_MIN_AGE_MS,
  discordAccountId,
  discordCreatedAt,
  discordDisplayName,
  discordOldEnough,
  actingAccount,
  planReportMerge,
  planVoteMerge,
  resolveMember,
  type GameLogin,
} from "@/lib/community/identity";
import { createHash } from "node:crypto";

const DAY = 24 * 3600_000;

/** A snowflake created at `ms` (Unix time). */
const snowflake = (ms: number) => ((BigInt(ms - DISCORD_EPOCH_MS) << BigInt(22)) + BigInt(4242)).toString();

const NOW = Date.UTC(2026, 10, 15, 12);
const OLD = snowflake(NOW - 400 * DAY);
const FRESH = snowflake(NOW - 2 * DAY);
const GAME: GameLogin = { status: "ok", id: "a".repeat(24), name: "Ling Main" };

describe("Discord account age", () => {
  it("reads the creation date from the id", () => {
    // Discord's documented example: 175928847299117063 was created 2016-04-30T11:18:25.796Z.
    expect(discordCreatedAt("175928847299117063")).toBe(Date.parse("2016-04-30T11:18:25.796Z"));
    expect(discordCreatedAt(snowflake(NOW - 3 * DAY))).toBe(NOW - 3 * DAY);
  });

  it("refuses anything that is not a snowflake", () => {
    expect(discordCreatedAt("")).toBeNull();
    expect(discordCreatedAt("12345")).toBeNull();
    expect(discordCreatedAt("1759288472991170631234")).toBeNull();
    expect(discordCreatedAt("99999999999999999999")).toBeNull(); // over 2^64
    expect(discordCreatedAt("17592884729911706a")).toBeNull();
  });

  it("asks for a week, measured from the id", () => {
    expect(DISCORD_MIN_AGE_MS).toBe(7 * DAY);
    expect(discordOldEnough(OLD, NOW)).toBe(true);
    expect(discordOldEnough(FRESH, NOW)).toBe(false);
    expect(discordOldEnough(snowflake(NOW - 7 * DAY), NOW)).toBe(true);
    expect(discordOldEnough(snowflake(NOW - 7 * DAY + 1000), NOW)).toBe(false);
    // A date in the future (a forged id) is not old enough either.
    expect(discordOldEnough(snowflake(NOW + 30 * DAY), NOW)).toBe(false);
    expect(discordOldEnough("not-an-id", NOW)).toBe(false);
  });
});

describe("Discord member ids and names", () => {
  it("hashes the Discord id in a namespace of its own", () => {
    const id = discordAccountId(OLD);
    expect(id).toMatch(/^[0-9a-f]{24}$/);
    expect(id).toBe(discordAccountId(OLD));
    expect(id).not.toBe(discordAccountId(FRESH));
    expect(id).not.toContain(OLD);
    // Not a bare hash of the id either: the namespace is part of it.
    expect(id).not.toBe(createHash("sha256").update(OLD).digest("hex").slice(0, 24));
  });

  it("cleans the display name, never falls back to the id", () => {
    const id = discordAccountId(OLD);
    expect(discordDisplayName("  Leo   the\tGreat ", id)).toBe("Leo the Great");
    expect(discordDisplayName("evil‮eman​", id)).toBe("evileman");
    expect(discordDisplayName("line\nbreak", id)).toBe("line break");
    expect(discordDisplayName("x".repeat(64), id)).toHaveLength(40);
    expect(discordDisplayName("<script>alert(1)</script>", id)).toBe("<script>alert(1)</script>"); // text, escaped when rendered
    expect(discordDisplayName("​​", id)).toBe(`Member ${id.slice(0, 6)}`);
    expect(discordDisplayName("free diamonds here", id)).toBe(`Member ${id.slice(0, 6)}`);
    expect(discordDisplayName("https://bit.ly/abc", id)).toBe(`Member ${id.slice(0, 6)}`);
    expect(discordDisplayName("", id)).not.toContain(OLD);
  });
});

describe("resolveMember", () => {
  const discord = { id: OLD, name: "Leo" };

  it("keeps the game account first, and offers to link a Discord login beside it", () => {
    expect(resolveMember({ game: GAME, discord: null, link: null, now: NOW })).toEqual({
      status: "ok",
      author: { id: GAME.status === "ok" ? GAME.id : "", name: "Ling Main", provider: "game" },
      via: "game",
      linkable: false,
      unlinkable: false,
    });
    const both = resolveMember({ game: GAME, discord, link: null, now: NOW });
    expect(both).toMatchObject({ status: "ok", via: "game", linkable: true, author: { provider: "game" } });
    const unlinkedRow = resolveMember({ game: GAME, discord, link: { linkedTo: null, primaryName: null, bannedAt: null, banUntil: null }, now: NOW });
    expect(unlinkedRow).toMatchObject({ linkable: true });
    const linked = resolveMember({ game: GAME, discord, link: { linkedTo: "a".repeat(24), primaryName: "Ling Main", bannedAt: null, banUntil: null }, now: NOW });
    expect(linked).toMatchObject({ linkable: false, unlinkable: true, via: "game" });
    // Linked to another game account: neither offer.
    const elsewhere = resolveMember({ game: GAME, discord, link: { linkedTo: "z".repeat(24), primaryName: "Other", bannedAt: null, banUntil: null }, now: NOW });
    expect(elsewhere).toMatchObject({ linkable: false, unlinkable: false, via: "game" });
  });

  it("offers to unlink a Discord login linked to the game account beside it, and only that one", () => {
    const gameId = GAME.status === "ok" ? GAME.id : "";
    const link = { linkedTo: gameId, primaryName: "Ling Main", bannedAt: null, banUntil: null };
    expect(resolveMember({ game: GAME, discord, link, now: NOW })).toMatchObject({ via: "game", linkable: false, unlinkable: true });
    // Signed in with Discord alone: nothing to prove the game account with.
    expect(resolveMember({ game: { status: "none" }, discord, link, now: NOW })).toMatchObject({ via: "discord", unlinkable: false });
    // Once unlinked, the Discord login is its own member again, under the account-age guard.
    const unlinked = { linkedTo: null, primaryName: null, bannedAt: null, banUntil: null };
    expect(resolveMember({ game: { status: "none" }, discord: { id: FRESH, name: "Leo" }, link: unlinked, now: NOW })).toEqual({ status: "discordTooNew" });
    expect(resolveMember({ game: { status: "none" }, discord, link: unlinked, now: NOW })).toMatchObject({
      status: "ok",
      author: { id: discordAccountId(OLD), provider: "discord" },
    });
  });

  it("lets a Discord account a week old in on its own, under its hash and display name", () => {
    const member = resolveMember({ game: { status: "none" }, discord, link: null, now: NOW });
    expect(member).toEqual({
      status: "ok",
      author: { id: discordAccountId(OLD), name: "Leo", provider: "discord" },
      via: "discord",
      linkable: false,
      unlinkable: false,
    });
  });

  it("keeps a Discord account younger than a week out", () => {
    expect(resolveMember({ game: { status: "none" }, discord: { id: FRESH, name: "Raid" }, link: null, now: NOW })).toEqual({ status: "discordTooNew" });
    expect(resolveMember({ game: { status: "unavailable" }, discord: { id: FRESH, name: "Raid" }, link: null, now: NOW })).toEqual({
      status: "discordTooNew",
    });
  });

  it("makes a linked Discord login act as its game account", () => {
    const link = { linkedTo: "b".repeat(24), primaryName: "Gord Fan", bannedAt: null, banUntil: null };
    const member = resolveMember({ game: { status: "none" }, discord: { id: FRESH, name: "Leo" }, link, now: NOW });
    // The game account carries the ban and the new-account period, so the Discord age no longer matters.
    expect(member).toEqual({ status: "ok", author: { id: "b".repeat(24), name: "Gord Fan", provider: "game" }, via: "discord", linkable: false, unlinkable: false });
  });

  it("answers the game login's own status without a Discord login", () => {
    expect(resolveMember({ game: { status: "none" }, discord: null, link: null, now: NOW })).toEqual({ status: "none" });
    expect(resolveMember({ game: { status: "unavailable" }, discord: null, link: null, now: NOW })).toEqual({ status: "unavailable" });
  });
});

describe("planVoteMerge", () => {
  const g = "g".repeat(24);
  const d = "d".repeat(24);

  it("moves the Discord member's votes, drops duplicates and votes that would be on one's own post", () => {
    const plan = planVoteMerge({
      gameId: g,
      discordId: d,
      gameVotes: [
        { kind: "thread", targetId: 1 },
        { kind: "post", targetId: 7 }, // on the Discord member's own reply
      ],
      discordVotes: [
        { kind: "thread", targetId: 1 }, // both voted
        { kind: "thread", targetId: 2 }, // the game account's own thread
        { kind: "post", targetId: 1 }, // same id, other kind: not a duplicate
        { kind: "post", targetId: 3 },
      ],
      authors: new Map([
        ["thread:1", "x".repeat(24)],
        ["thread:2", g],
        ["post:1", "y".repeat(24)],
        ["post:3", "z".repeat(24)],
        ["post:7", d],
      ]),
    });
    expect(plan.move).toEqual([
      { kind: "post", targetId: 1 },
      { kind: "post", targetId: 3 },
    ]);
    expect(plan.drop).toEqual([
      { vote: { kind: "thread", targetId: 1 }, voter: "discord" },
      { vote: { kind: "thread", targetId: 2 }, voter: "discord" },
      { vote: { kind: "post", targetId: 7 }, voter: "game" },
    ]);
  });

  it("does nothing without votes", () => {
    expect(planVoteMerge({ gameId: g, discordId: d, gameVotes: [], discordVotes: [], authors: new Map() })).toEqual({ move: [], drop: [] });
  });
});

describe("invisible and stacked display names", () => {
  const id = discordAccountId(OLD);
  const fallback = `Member ${id.slice(0, 6)}`;

  it("treats blank fillers as nothing", () => {
    for (const blank of ["\u3164", "\u3164\u3164\u3164", "\u2800\u2800", "\u115F\u1160", "\uFFA0", "\u180E", "\u17B4\u17B5", "\u034F", " \u3164 \u2800 "]) {
      expect(discordDisplayName(blank, id)).toBe(fallback);
    }
    // Marks or punctuation alone draw no name either.
    expect(discordDisplayName("\u0301\u0301\u0301", id)).toBe(fallback);
    expect(discordDisplayName("...", id)).toBe(fallback);
    // A filler beside a real name is only a space.
    expect(discordDisplayName("Leo\u3164\u3164King", id)).toBe("Leo King");
  });

  it("caps stacked combining marks at two per character", () => {
    const zalgo = "Z" + "\u0300\u0301\u0302\u0303\u0304\u0305" + "a";
    expect(discordDisplayName(zalgo, id)).toBe("Z\u0300\u0301a");
    expect(discordDisplayName("Café", id)).toBe("Café");
    expect(discordDisplayName("Nguyễn", id)).toBe("Nguyễn");
  });

  it("keeps names in every script", () => {
    expect(discordDisplayName("김민수", id)).toBe("김민수");
    expect(discordDisplayName("ไทย", id)).toBe("ไทย");
    expect(discordDisplayName("Игрок 7", id)).toBe("Игрок 7");
    expect(discordDisplayName("42", id)).toBe("42");
  });
});

describe("bans and links", () => {
  const BANNED = { bannedAt: new Date(NOW - DAY), banUntil: null };
  const EXPIRED = { bannedAt: new Date(NOW - 10 * DAY), banUntil: new Date(NOW - DAY) };

  it("refuses a Discord login whose own row is banned, linked or not", () => {
    const discord = { id: OLD, name: "Leo" };
    expect(resolveMember({ game: { status: "none" }, discord, link: { linkedTo: null, primaryName: null, ...BANNED }, now: NOW })).toEqual({ status: "banned" });
    expect(
      resolveMember({ game: { status: "none" }, discord, link: { linkedTo: "g".repeat(24), primaryName: "Ling Main", ...BANNED }, now: NOW }),
    ).toEqual({ status: "banned" });
    // Even a fresh Discord account: the ban is the answer, not its age.
    expect(resolveMember({ game: { status: "none" }, discord: { id: FRESH, name: "x" }, link: { linkedTo: null, primaryName: null, ...BANNED }, now: NOW })).toEqual({
      status: "banned",
    });
    // A ban that ran out no longer stops it.
    expect(resolveMember({ game: { status: "none" }, discord, link: { linkedTo: null, primaryName: null, ...EXPIRED }, now: NOW })).toMatchObject({ status: "ok" });
  });

  it("never offers to merge a banned Discord row into a game account", () => {
    const member = resolveMember({ game: GAME, discord: { id: OLD, name: "Leo" }, link: { linkedTo: null, primaryName: null, ...BANNED }, now: NOW });
    expect(member).toMatchObject({ status: "ok", via: "game", linkable: false });
  });

  it("aims a decision on a linked Discord row at the game account it acts as", () => {
    expect(actingAccount({ accountId: "d".repeat(24), linkedTo: "g".repeat(24) }, "d".repeat(24))).toBe("g".repeat(24));
    expect(actingAccount({ accountId: "d".repeat(24), linkedTo: null }, "d".repeat(24))).toBe("d".repeat(24));
    expect(actingAccount(null, "x".repeat(24))).toBe("x".repeat(24));
  });
});

describe("planReportMerge", () => {
  const g = "g".repeat(24);
  const d = "d".repeat(24);
  const other = "o".repeat(24);

  it("drops duplicates and reports that would be on one's own post", () => {
    const drop = planReportMerge({
      gameId: g,
      discordId: d,
      reports: [
        { id: 1, kind: "post", targetId: 5, reporterId: g, authorId: other }, // kept
        { id: 2, kind: "post", targetId: 5, reporterId: d, authorId: other }, // duplicate of 1
        { id: 3, kind: "thread", targetId: 9, reporterId: d, authorId: g }, // Discord reported the game account
        { id: 4, kind: "card", targetId: 2, reporterId: g, authorId: d }, // game reported the Discord member
        { id: 5, kind: "thread", targetId: 5, reporterId: d, authorId: other }, // same id, other kind: kept
        { id: 6, kind: "post", targetId: 8, reporterId: other, authorId: d }, // someone else's report: kept
      ],
    });
    expect(drop.sort()).toEqual([2, 3, 4]);
  });
});
