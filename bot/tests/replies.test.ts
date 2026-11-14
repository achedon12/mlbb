import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { aboutEmbed } from "../src/commands/about.js";
import { loadConfig } from "../src/config.js";
import { COLORS, errorEmbed, FAMILY_COLORS, listMore, makeView, notFoundEmbed, offersInvite, replyRow } from "../src/embeds/common.js";
import { leaderboardEmbed, mlbbdleClassicEmbed } from "../src/embeds/daily.js";
import {
  buildEmbed,
  counterEmbed,
  emblemEmbed,
  heroButtons,
  heroEmbed,
  itemEmbed,
  patchEmbed,
  spellEmbed,
  tierlistEmbed,
} from "../src/embeds/game.js";
import { inviteUrl } from "../src/links.js";
import { distance, suggest } from "../src/search.js";
import { GameData } from "../src/site/game-data.js";
import type { HeroDetail, RankingEntry } from "../src/site/game-data.js";
import { VERSION } from "../src/version.js";

const SITE = "https://mlbbdex.com";
const en = makeView("en", SITE, "hero");
const fr = makeView("fr", SITE, "hero");
const COMMUNITY = "1571086017287561237";
const INVITE = inviteUrl("1571083624789581834");

const layla: HeroDetail = {
  slug: "layla",
  name: "Layla",
  title: "Energy Gunner",
  roles: ["Marksman"],
  lanes: ["Gold"],
  release: null,
  damageType: null,
  attackType: null,
  ratings: { difficulty: 2 },
  skills: [{ name: "Malefic Gun" }, { name: "Malefic Bomb" }],
  skins: [],
  images: { portrait: "/visuels/heros/layla/portrait.webp", icon: "/visuels/heros/layla/icone.webp", skins: {} },
  illustrations: {
    "Energy Gunner": "/visuels/heros/layla/illustrations/energy-gunner.webp",
    "Green Flash": "/visuels/heros/layla/illustrations/green-flash.webp",
  },
  analysis: null,
};
const ranking: RankingEntry = { slug: "layla", name: "Layla", tier: "S", winRate: 53.2, banRate: 1.5, pickRate: 4.2, score: 53.6 };

describe("hero sheet visuals", () => {
  it("uses the square icon as thumbnail and the original skin's artwork as image", () => {
    const json = heroEmbed(en, layla, ranking, null).toJSON();
    expect(json.thumbnail?.url).toBe(`${SITE}/visuels/heros/layla/icone.webp`);
    expect(json.image?.url).toBe(`${SITE}/visuels/heros/layla/illustrations/energy-gunner.webp`);
  });

  it("falls back to the portrait, and shows no image without artwork", () => {
    const bare = { ...layla, images: { ...layla.images, icon: null }, illustrations: {} };
    const json = heroEmbed(en, bare, null, null).toJSON();
    expect(json.thumbnail?.url).toContain("/portrait.webp");
    expect(json.image).toBeUndefined();
  });

  it("orders the fields: who the hero is, how it does, then the skills", () => {
    const json = heroEmbed(en, layla, ranking, { items: ["Boots"], emblem: "Marksman", spell: "Flicker" }).toJSON();
    expect(json.fields?.map((f) => f.name)).toEqual([
      "Role", "Lanes", "Tier", "Win rate", "Pick rate", "Ban rate", "Best build", "Emblem", "Spell", "Skills",
    ]);
  });

  it("build, counter and skins replies carry the hero's icon too", () => {
    expect(buildEmbed(en, layla, [], null).toJSON().thumbnail?.url).toContain("/icone.webp");
    expect(counterEmbed(en, layla, { strong: [], weak: [] }).toJSON().thumbnail?.url).toContain("/icone.webp");
  });

  it("items, emblems and spells show their icon", () => {
    const item = itemEmbed(en, { slug: "blade-of-despair", name: "Blade of Despair", summary: null, category: "Attack", price: 3010, bonus: null, unique: null, passive: null, active: null, recipe: [] });
    expect(item.toJSON().thumbnail?.url).toBe(`${SITE}/visuels/objets/blade-of-despair.webp`);
    expect(emblemEmbed(en, { slug: "mage", name: "Mage Emblem", roles: ["Mage"] }, null).toJSON().thumbnail?.url).toBe(`${SITE}/visuels/emblemes/mage-emblem.webp`);
    expect(spellEmbed(en, { slug: "flicker", name: "Flicker", roles: ["Mage"] }, null).toJSON().thumbnail?.url).toBe(`${SITE}/visuels/sorts/flicker.webp`);
  });
});

describe("embed style", () => {
  it("every reply has the source and the site in its footer, with the site's icon", () => {
    for (const embed of [heroEmbed(fr, layla, null, null), tierlistEmbed(en, [], null, "/tier-list", null), errorEmbed(en, true)]) {
      const json = embed.toJSON();
      expect(json.footer?.text).toMatch(/^mlbbdex\.com · /);
      expect(json.footer?.icon_url).toBe(`${SITE}/icons/icon-192.png`);
    }
    expect(heroEmbed(fr, layla, null, null).toJSON().footer?.text).toContain("Données");
  });

  it("colours a reply by its command family", () => {
    expect(buildEmbed(en, layla, [], null).toJSON().color).toBe(FAMILY_COLORS.heroes);
    expect(counterEmbed(en, layla, { strong: [], weak: [] }).toJSON().color).toBe(FAMILY_COLORS.meta);
    expect(tierlistEmbed(en, [], null, "/tier-list", null).toJSON().color).toBe(FAMILY_COLORS.meta);
    expect(patchEmbed(en, { version: "2.1.90", title: "Patch 2.1.90", link: "" }, null, true).toJSON().color).toBe(FAMILY_COLORS.news);
    expect(leaderboardEmbed(en, "quiz", "week", { entries: [] }).toJSON().color).toBe(FAMILY_COLORS.games);
    expect(errorEmbed(en, false).toJSON().color).toBe(COLORS.slate);
    // A tier keeps its own colour on the hero sheet: S+ red, S gold...
    expect(heroEmbed(en, layla, { ...ranking, tier: "S+" }, null).toJSON().color).toBe(0xd94848);
  });

  it("the MLBBdle grid has no empty field next to it", () => {
    const hero = { slug: "a", name: "A", icon: null, gender: "female" as const, roles: [], lanes: [], specialties: [], damage: "", range: "", resource: "", region: "", year: 2020 };
    expect(mlbbdleClassicEmbed(en, 1, [hero], hero, true).toJSON().fields ?? []).toEqual([]);
  });

  it("says the site is down with a retry hint, in the reader's language", () => {
    expect(errorEmbed(en, true).toJSON().description).toContain("Try again in a minute");
    expect(errorEmbed(fr, true).toJSON().description).toContain("Réessaie dans une minute");
  });
});

describe("lists in fields", () => {
  it("count what does not fit instead of cutting a name in two", () => {
    expect(listMore(en, ["a", "b", "c"], ", ", 2)).toBe("a, b, +1 more");
    expect(listMore(en, ["a", "b"])).toBe("a, b");
    expect(listMore(en, [])).toBe("None");
    const long = Array.from({ length: 200 }, (_, i) => `Hero number ${i}`);
    const value = listMore(en, long);
    expect(value.length).toBeLessThanOrEqual(1024);
    expect(value).toMatch(/, \+\d+ more$/);
  });

  it("the tier list says how many heroes each tier has", () => {
    const entries = [ranking, { ...ranking, slug: "miya", name: "Miya" }];
    const json = tierlistEmbed(fr, entries, null, "/tier-list", "Mesuré le 2026-11-13").toJSON();
    expect(json.fields?.[0]).toEqual({ name: "S · 2", value: "Layla, Miya" });
    expect(json.description).toContain("-# Mesuré le 2026-11-13");
  });

  it("patch replies list the changed heroes with their arrow, then a count", () => {
    const adjustments = Array.from({ length: 34 }, (_, i) => ({ name: `H${i}`, slug: `h${i}`, type: i % 2 ? "nerf" : "buff" }));
    const json = patchEmbed(en, { version: "2.1.90", title: "Patch 2.1.90", link: "" }, { version: "2.1.90", title: "Patch 2.1.90", balance: { buff: 17, nerf: 17, adjust: 0 }, adjustments }, true).toJSON();
    const heroes = json.fields?.find((f) => f.name === "Heroes changed")?.value ?? "";
    expect(heroes.startsWith("▲ H0 · ▼ H1")).toBe(true);
    expect(heroes.endsWith("+4 more")).toBe(true);
    expect(json.fields?.[0]?.value).toBe("▲ 17");
  });
});

describe("did you mean", () => {
  const heroes = [
    { slug: "layla", name: "Layla" },
    { slug: "lylia", name: "Lylia" },
    { slug: "lancelot", name: "Lancelot" },
    { slug: "popol-and-kupa", name: "Popol and Kupa" },
    { slug: "chou", name: "Chou" },
  ];

  it("offers what autocomplete would, for an ambiguous value", () => {
    expect(suggest(heroes, "la").map((h) => h.slug).slice(0, 2)).toEqual(["lancelot", "layla"]);
    expect(suggest(heroes, "la")).toHaveLength(3);
  });

  it("offers the names a few typos away", () => {
    expect(suggest(heroes, "lyla").map((h) => h.slug)).toContain("layla");
    expect(suggest(heroes, "chuo").map((h) => h.slug)).toEqual(["chou"]);
    expect(suggest(heroes, "popul").map((h) => h.slug)).toEqual(["popol-and-kupa"]);
    expect(suggest(heroes, "zzzzzz")).toEqual([]);
    expect(suggest(heroes, "  ")).toEqual([]);
    expect(distance("kitten", "sitting")).toBe(3);
  });

  it("names the suggestions in the not-found reply, escaped", () => {
    const json = notFoundEmbed(en, "lyla", ["Layla", "Lylia"]).toJSON();
    expect(json.description).toBe("Nothing found for “lyla”.\nDid you mean **Layla**, **Lylia**?");
    expect(notFoundEmbed(fr, "zz").toJSON().description).toContain("Choisis un nom parmi les suggestions");
    expect(notFoundEmbed(en, "x", ["*bold*"]).toJSON().description).toContain("**\\*bold\\***");
  });
});

describe("link buttons under the main replies", () => {
  it("offer the invite everywhere but the community server", () => {
    expect(offersInvite("123456789012345678", COMMUNITY)).toBe(true);
    expect(offersInvite(null, COMMUNITY)).toBe(true);
    expect(offersInvite(COMMUNITY, COMMUNITY)).toBe(false);
    expect(offersInvite(COMMUNITY, undefined)).toBe(true);
  });

  it("are one row: the page, then the invite when there is one", () => {
    const withInvite = replyRow(en, "/tier-list", INVITE).toJSON().components;
    expect(withInvite.map((c) => ("label" in c ? c.label : null))).toEqual(["Open on MLBBDex", "Add to your server"]);
    expect(withInvite.map((c) => ("url" in c ? c.url : ""))[1]).toBe(INVITE);
    expect(replyRow(fr, "/tier-list", null).toJSON().components).toHaveLength(1);
  });

  it("the hero sheet keeps its three buttons and adds the invite as the fifth", () => {
    expect(heroButtons(en, "layla", INVITE).toJSON().components).toHaveLength(5);
    expect(heroButtons(en, "layla").toJSON().components).toHaveLength(4);
  });
});

describe("/about", () => {
  it("shows the version, the servers and since when the bot is online", () => {
    const startedAt = Date.UTC(2026, 10, 14, 8);
    const json = aboutEmbed(fr, { version: "1.2.0", servers: 12345, startedAt }).toJSON();
    const field = (name: string) => json.fields?.find((f) => f.name === name)?.value;
    expect(field("Version")).toBe("`1.2.0`");
    expect(field("Serveurs")).toMatch(/^12\s345$/);
    expect(field("En ligne depuis")).toBe(`<t:${startedAt / 1000}:R>`);
    expect(field("Langues")).toContain("Bahasa Indonesia");
  });

  it("leaves the server count out rather than showing a wrong one", () => {
    const json = aboutEmbed(en, { version: "1.2.0", servers: null, startedAt: 0 }).toJSON();
    expect(json.fields?.map((f) => f.name)).not.toContain("Servers");
  });

  it("reads the version from package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });
});

describe("startup", () => {
  it("the community server id must be a snowflake", () => {
    expect(loadConfig({ SUPPORT_GUILD_ID: COMMUNITY }).SUPPORT_GUILD_ID).toBe(COMMUNITY);
    expect(loadConfig({ SUPPORT_GUILD_ID: "" }).SUPPORT_GUILD_ID).toBeUndefined();
    expect(() => loadConfig({ SUPPORT_GUILD_ID: "mlbbdex" })).toThrow(/SUPPORT_GUILD_ID/);
  });

  it("warms the lists every command reads, and counts the loads that failed", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes("/items") ? new Response("down", { status: 503 }) : new Response(JSON.stringify({ data: url.includes("/rankings") ? { measuredAt: null, heroes: [] } : [] })),
    );
    const failed = await new GameData(SITE, fetch).warm();
    const paths = fetch.mock.calls.map(([url]) => new URL(url).pathname + new URL(url).search);
    expect(paths).toEqual(expect.arrayContaining(["/api/v1/heroes", "/api/v1/rankings", "/api/v1/patches", "/api/v1/items?locale=id"]));
    expect(failed).toBe(5);
  });
});
