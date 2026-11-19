import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/mlbb-auth";
import { readFrequentHeroes, readStats } from "@/lib/player-api";
import { cardAccess, isDiscordId, keptSince, profileDiscordKey } from "@/lib/discord-profile/access";
import { CARD_HEIGHT, CARD_WIDTH, cardLabels, renderCard } from "@/lib/discord-profile/card";
import { buildSnapshot, readSnapshot, regionOf, SNAPSHOT_MAX_MS, winRate, type ProfileSnapshot } from "@/lib/discord-profile/snapshot";
import { FREQUENT_HEROES, ME, STATS } from "./player-samples";

/**
 * The Discord profile card: what is saved from the game's services, who may
 * post whose card, and the drawn PNG.
 */

const PROFILE: Profile = {
  roleId: ME.roleId,
  zoneId: ME.zoneId,
  name: "  Leo·Gold  ",
  level: 87,
  rankCurrent: 136 + 87,
  rankMax: 136 + 112,
  country: "ph",
  avatar: "https://akmpicture.youngjoygame.com/dist/avatar.png",
};

const heroes = () => ({ heroes: readFrequentHeroes(FREQUENT_HEROES.data).entries, full: true });

describe("card snapshot", () => {
  it("sums the season's heroes and keeps the three most played, mapped to the site's sheets", () => {
    const s = buildSnapshot({ profile: PROFILE, season: 40, heroes: heroes(), stats: readStats(STATS.data) })!;
    expect(s).not.toBeNull();
    // 25 + 12 + 8 + 6 + 3 + 4 (Miya's string counters), the unreadable and empty entries left out.
    expect(s.matches).toBe(58);
    expect(s.wins).toBe(17 + 4 + 7 + 2 + 1 + 4);
    expect(s.heroes.map((h) => h.name)).toEqual(["Ling", "Lolita", "Fanny"]);
    expect(s.heroes[0]).toMatchObject({ slug: "ling", matches: 25, wins: 17 });
    expect(s).toMatchObject({ name: "Leo·Gold", country: "PH", season: 40, rankLevel: 223, full: true });
  });

  it("falls back on the all-seasons figures, without a season, when the heroes are unreadable", () => {
    const s = buildSnapshot({ profile: PROFILE, season: 40, heroes: null, stats: readStats(STATS.data) })!;
    expect(s).toMatchObject({ season: null, matches: 308, wins: 188, mvp: 73, heroes: [] });
  });

  it("drops what it cannot trust: an avatar off Moonton's CDN, an unknown country, a profile without id", () => {
    const s = buildSnapshot({ profile: { ...PROFILE, avatar: "https://evil.example/a.png", country: "ZZ" }, season: null, heroes: null, stats: null })!;
    expect(s.avatar).toBeNull();
    expect(s.country).toBe("");
    expect(s.matches).toBe(0);
    expect(buildSnapshot({ profile: { ...PROFILE, roleId: 0 }, season: 40, heroes: heroes(), stats: null })).toBeNull();
  });

  it("reads a stored snapshot back through its schema only", () => {
    const s = buildSnapshot({ profile: PROFILE, season: 40, heroes: heroes(), stats: null })!;
    expect(readSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(readSnapshot({ ...s, v: 2 })).toBeNull();
    expect(readSnapshot({ ...s, avatar: "javascript:alert(1)" })).toBeNull();
    expect(readSnapshot({ ...s, heroes: [...s.heroes, ...s.heroes] })).toBeNull();
    expect(readSnapshot("nope")).toBeNull();
  });

  it("places countries in the game's regions", () => {
    expect(regionOf("PH")).toBe("SEA");
    expect(regionOf("id")).toBe("SEA");
    expect(regionOf("FR")).toBe("EU");
    expect(regionOf("US")).toBe("NA");
    expect(regionOf("")).toBeNull();
    expect(winRate(3, 4)).toBe(75);
    expect(winRate(0, 0)).toBeNull();
  });
});

describe("who may post whose card", () => {
  const me = "123456789012345678";
  const other = "876543210987654321";
  const now = Date.UTC(2026, 10, 19);
  const fresh = { public: false, snapshotAt: new Date(now - 86_400_000) };

  it("shows your own card once linked, public or not", () => {
    expect(cardAccess({ viewer: me, target: me, row: fresh, now })).toEqual({ ok: true, own: true });
    expect(cardAccess({ viewer: me, target: me, row: null, now })).toEqual({ ok: false, reason: "notLinked" });
  });

  it("shows someone else's card only when they made it public", () => {
    expect(cardAccess({ viewer: other, target: me, row: fresh, now })).toEqual({ ok: false, reason: "unavailable" });
    expect(cardAccess({ viewer: other, target: me, row: { ...fresh, public: true }, now })).toEqual({ ok: true, own: false });
  });

  it("never tells another member whether a card exists", () => {
    const answers = [null, fresh, { public: true, snapshotAt: new Date(now - SNAPSHOT_MAX_MS - 1) }].map((row) => cardAccess({ viewer: other, target: me, row, now }));
    expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1);
  });

  it("stops showing figures older than 30 days, even to their owner", () => {
    const old = { public: true, snapshotAt: new Date(now - SNAPSHOT_MAX_MS - 1) };
    expect(cardAccess({ viewer: me, target: me, row: old, now })).toEqual({ ok: false, reason: "stale" });
    expect(keptSince(now).getTime()).toBe(now - SNAPSHOT_MAX_MS);
  });

  it("hashes Discord ids in a namespace of their own", () => {
    expect(profileDiscordKey(me)).toMatch(/^[0-9a-f]{24}$/);
    expect(profileDiscordKey(me)).not.toBe(profileDiscordKey(other));
    expect(isDiscordId(me)).toBe(true);
    expect(isDiscordId("12")).toBe(false);
    expect(isDiscordId("12345678901234567a")).toBe(false);
  });
});

/** Width and height from a PNG's header. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("card drawing", () => {
  afterEach(() => vi.unstubAllGlobals());

  const snapshot = (): ProfileSnapshot => buildSnapshot({ profile: PROFILE, season: 40, heroes: heroes(), stats: readStats(STATS.data) })!;

  it("draws a PNG of the card's size, without the network (avatar and flag fall back)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const bytes = await renderCard(snapshot(), cardLabels("fr"), { showId: false, updatedAt: new Date(Date.UTC(2026, 10, 18)) });
    expect(pngSize(bytes)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
    expect(bytes.length).toBeGreaterThan(20_000);
  }, 30_000);

  it("draws an empty season and every rank family", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    for (const rankLevel of [0, 50, 120, 300]) {
      const empty = { ...snapshot(), rankLevel, rankMaxLevel: rankLevel, matches: 0, wins: 0, heroes: [], avatar: null, country: "" };
      const bytes = await renderCard(empty, cardLabels("en"), { showId: true, updatedAt: new Date() });
      expect(pngSize(bytes)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
    }
  }, 60_000);

  // `WRITE_CARD_SAMPLE=1 npx vitest run tests/unit/discord-profile.test.ts`
  // redraws docs/discord-profile-card.png, with a hero portrait for avatar.
  it.runIf(process.env.WRITE_CARD_SAMPLE)("writes the sample card of the docs", async () => {
    const real = globalThis.fetch;
    const portrait = readFileSync("public/visuels/heros/layla/portrait.webp");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) =>
      String(url).startsWith("https://akmpicture.") ? new Response(portrait) : real(url, init),
    ));
    const bytes = await renderCard(snapshot(), cardLabels("en"), { showId: true, updatedAt: new Date(Date.UTC(2026, 10, 18)) });
    mkdirSync("docs", { recursive: true });
    writeFileSync("docs/discord-profile-card.png", bytes);
  }, 60_000);
});
