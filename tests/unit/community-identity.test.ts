import { describe, expect, it } from "vitest";
import {
  DISCORD_EPOCH_MS,
  DISCORD_MIN_AGE_MS,
  discordAccountId,
  discordCreatedAt,
  discordDisplayName,
  discordOldEnough,
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
    });
    const both = resolveMember({ game: GAME, discord, link: null, now: NOW });
    expect(both).toMatchObject({ status: "ok", via: "game", linkable: true, author: { provider: "game" } });
    const unlinkedRow = resolveMember({ game: GAME, discord, link: { linkedTo: null, primaryName: null }, now: NOW });
    expect(unlinkedRow).toMatchObject({ linkable: true });
    const linked = resolveMember({ game: GAME, discord, link: { linkedTo: "a".repeat(24), primaryName: "Ling Main" }, now: NOW });
    expect(linked).toMatchObject({ linkable: false, via: "game" });
  });

  it("lets a Discord account a week old in on its own, under its hash and display name", () => {
    const member = resolveMember({ game: { status: "none" }, discord, link: null, now: NOW });
    expect(member).toEqual({
      status: "ok",
      author: { id: discordAccountId(OLD), name: "Leo", provider: "discord" },
      via: "discord",
      linkable: false,
    });
  });

  it("keeps a Discord account younger than a week out", () => {
    expect(resolveMember({ game: { status: "none" }, discord: { id: FRESH, name: "Raid" }, link: null, now: NOW })).toEqual({ status: "discordTooNew" });
    expect(resolveMember({ game: { status: "unavailable" }, discord: { id: FRESH, name: "Raid" }, link: null, now: NOW })).toEqual({
      status: "discordTooNew",
    });
  });

  it("makes a linked Discord login act as its game account", () => {
    const link = { linkedTo: "b".repeat(24), primaryName: "Gord Fan" };
    const member = resolveMember({ game: { status: "none" }, discord: { id: FRESH, name: "Leo" }, link, now: NOW });
    // The game account carries the ban and the new-account period, so the Discord age no longer matters.
    expect(member).toEqual({ status: "ok", author: { id: "b".repeat(24), name: "Gord Fan", provider: "game" }, via: "discord", linkable: false });
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
