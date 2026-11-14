import { describe, expect, it } from "vitest";
import { comparePath } from "../src/commands/compare.js";
import { parseLeaderboardOptions } from "../src/commands/leaderboard.js";
import { parseMode } from "../src/commands/mlbbdle.js";
import { parseStyle } from "../src/commands/nickname.js";
import { findPatch, parseVersion } from "../src/commands/patch.js";
import { parseQuizButton } from "../src/commands/quiz.js";
import { parseRank } from "../src/commands/shared.js";
import { filterRanking, parseTierlistOptions, tierlistPath } from "../src/commands/tierlist.js";
import { loadConfig, requireDiscord, ConfigError } from "../src/config.js";
import { normalize, resolveByName, searchByName, toChoices } from "../src/search.js";

const heroes = [
  { slug: "chang-e", name: "Chang'e", roles: ["Mage"], lanes: ["Mid"], title: null, release: null },
  { slug: "chou", name: "Chou", roles: ["Fighter"], lanes: ["Exp", "Roam"], title: null, release: null },
  { slug: "x-borg", name: "X.Borg", roles: ["Fighter"], lanes: ["Exp"], title: null, release: null },
  { slug: "layla", name: "Layla", roles: ["Marksman"], lanes: ["Gold"], title: null, release: null },
  { slug: "lancelot", name: "Lancelot", roles: ["Assassin"], lanes: ["Jungle"], title: null, release: null },
];

describe("name search", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalize("Chang'e")).toBe("change");
    expect(normalize("  CHANGÉ ")).toBe("change");
    expect(normalize("X.Borg")).toBe("xborg");
  });

  it("ranks exact, then prefix, then substring matches", () => {
    expect(searchByName(heroes, "la").map((h) => h.slug)).toEqual(["lancelot", "layla"]);
    expect(searchByName(heroes, "cho").map((h) => h.slug)).toEqual(["chou"]);
    expect(searchByName(heroes, "borg").map((h) => h.slug)).toEqual(["x-borg"]);
    expect(searchByName(heroes, "")).toHaveLength(heroes.length);
  });

  it("resolves a slug, an exact name, or a single candidate; refuses ambiguity", () => {
    expect(resolveByName(heroes, "chang-e")?.slug).toBe("chang-e");
    expect(resolveByName(heroes, "chang e")?.slug).toBe("chang-e");
    expect(resolveByName(heroes, "xborg")?.slug).toBe("x-borg");
    expect(resolveByName(heroes, "lay")?.slug).toBe("layla");
    expect(resolveByName(heroes, "la")).toBeNull();
    expect(resolveByName(heroes, "zzz")).toBeNull();
  });

  it("caps autocomplete choices at 25 and 100 characters", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ slug: `h${i}`, name: `${"n".repeat(150)}${i}` }));
    const choices = toChoices(many);
    expect(choices).toHaveLength(25);
    expect(choices[0]!.name.length).toBe(100);
  });
});

describe("option parsing", () => {
  it("rank, mode and style fall back to their defaults on anything unknown", () => {
    expect(parseRank("glory")).toBe("glory");
    expect(parseRank("diamond")).toBe("all");
    expect(parseRank(null)).toBe("all");
    expect(parseMode("skill")).toBe("skill");
    expect(parseMode("nope")).toBe("classic");
    expect(parseStyle("fraktur")).toBe("fraktur");
    expect(parseStyle("<script>")).toBe("bold");
  });

  it("patch versions are read from loose input", () => {
    expect(parseVersion("2.1.90")).toBe("2.1.90");
    expect(parseVersion("v2.1.90")).toBe("2.1.90");
    expect(parseVersion("Patch Notes 1.9.42")).toBe("1.9.42");
    expect(parseVersion("latest")).toBeNull();
    const patches = [
      { version: "2.2.16", title: "Patch Notes 2.2.16", link: "" },
      { version: "2.1.90", title: "Patch Notes 2.1.90", link: "" },
    ];
    expect(findPatch(patches, null)?.version).toBe("2.2.16");
    expect(findPatch(patches, "2.1.90")?.version).toBe("2.1.90");
    expect(findPatch(patches, "9.9.9")).toBeNull();
  });

  it("tier list filters map to the site's pages and filter the heroes", () => {
    const f = parseTierlistOptions({ rank: "mythic", lane: "Exp", role: "Wizard" });
    expect(f).toEqual({ rank: "mythic", lane: "Exp", role: null });
    expect(tierlistPath(f)).toBe("/tier-list/lane/exp");
    expect(tierlistPath({ rank: "mythic", lane: null, role: null })).toBe("/tier-list/mythic");
    expect(tierlistPath({ rank: "all", lane: null, role: "Fighter" })).toBe("/tier-list/role/fighter");
    expect(tierlistPath({ rank: "all", lane: null, role: null })).toBe("/tier-list");
    const entries = heroes.map((h) => ({ slug: h.slug, name: h.name, tier: "S", winRate: 50, banRate: 1, pickRate: 1, score: 50 }));
    expect(filterRanking(entries, heroes, { rank: "all", lane: "Exp", role: "Fighter" }).map((e) => e.slug)).toEqual(["chou", "x-borg"]);
    expect(filterRanking(entries, [], { rank: "all", lane: null, role: null })).toHaveLength(5);
  });

  it("leaderboard options default to the classic MLBBdle of the week", () => {
    expect(parseLeaderboardOptions(null, null)).toEqual({ game: "mlbbdle-classic", period: "week" });
    expect(parseLeaderboardOptions("quiz", "all")).toEqual({ game: "quiz", period: "all" });
    expect(parseLeaderboardOptions("poker", "year")).toEqual({ game: "mlbbdle-classic", period: "week" });
  });

  it("quiz button ids are validated before use", () => {
    expect(parseQuizButton(["2026-11-14", "3", "2"])).toEqual({ day: "2026-11-14", step: 3, choice: 2 });
    expect(parseQuizButton(["2026-11-14", "3"])).toBeNull();
    expect(parseQuizButton(["../../etc", "1", "1"])).toBeNull();
    expect(parseQuizButton(["2026-11-14", "999", "1"])).toBeNull();
  });

  it("compare links use the site's alphabetical pair", () => {
    expect(comparePath("layla", "chou")).toBe("/compare/chou-vs-layla");
    expect(comparePath("chou", "layla")).toBe("/compare/chou-vs-layla");
  });
});

describe("configuration", () => {
  it("fails fast and clearly without a Discord token, and never echoes values", () => {
    const config = loadConfig({});
    expect(() => requireDiscord(config)).toThrow(ConfigError);
    expect(() => requireDiscord(config)).toThrow(/DISCORD_TOKEN and DISCORD_CLIENT_ID are not set/);
    expect(() => requireDiscord(loadConfig({ DISCORD_CLIENT_ID: "123456789012345678" }))).toThrow(/DISCORD_TOKEN is not set/);
  });

  it("applies defaults, treats empty values as unset and validates the rest", () => {
    const config = loadConfig({ BOT_HTTP_PORT: "", SITE_URL: "https://example.com/", TOPGG_TOKEN: "" });
    expect(config.BOT_HTTP_PORT).toBe(3100);
    expect(config.BOT_HTTP_HOST).toBe("127.0.0.1");
    expect(config.SITE_URL).toBe("https://example.com");
    expect(config.TOPGG_TOKEN).toBeUndefined();
    expect(() => loadConfig({ BOT_API_SECRET: "short" })).toThrow(/BOT_API_SECRET/);
    expect(() => loadConfig({ BOT_API_SECRET: "short-secret-value" })).not.toThrow(/short-secret-value/);
    expect(() => loadConfig({ DEV_GUILD_ID: "abc" })).toThrow(/DEV_GUILD_ID/);
  });
});
