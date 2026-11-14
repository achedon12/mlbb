import { describe, expect, it } from "vitest";
import { announcementMessage, allowedMentionsFor, monthName, testMessage } from "../src/embeds/announcements.js";
import { makeView, notFoundEmbed, plain } from "../src/embeds/common.js";
import { dailyPost, leaderboardEmbed, mlbbdleClassicEmbed, mlbbdleSolvedPublic, quizButtons, quizStepEmbed } from "../src/embeds/daily.js";
import { bestBuild, buildEmbed, counterEmbed, heroButtons, heroEmbed, itemEmbed, tierlistEmbed } from "../src/embeds/game.js";
import { inviteUrl, INVITE_PERMISSIONS, siteLink, assetUrl } from "../src/links.js";
import type { HeroDetail } from "../src/site/game-data.js";
import type { MlbbdleHero } from "../src/site/schemas.js";

const SITE = "https://mlbbdex.com";
const en = makeView("en", SITE, "hero");
const fr = makeView("fr", SITE, "hero");
const ROLE = "123456789012345678";

const layla: HeroDetail = {
  slug: "layla",
  name: "Layla",
  title: "Malefic Gunner",
  roles: ["Marksman"],
  lanes: ["Gold"],
  release: null,
  damageType: null,
  attackType: null,
  ratings: { difficulty: 2 },
  skills: [{ name: "Malefic Gun" }, null, { name: "Void Projectile" }],
  skins: [
    { id: "1", name: "Green Flash", release: null, rarity: "Elite" },
    { id: "2", name: "Cannon and Roses", release: null, rarity: "Epic" },
  ],
  images: { portrait: null, icon: "/visuels/heros/layla/icone.webp", skins: { "2": "/visuels/heros/layla/skins/2.webp" } },
  analysis: null,
};

const ranking = { slug: "layla", name: "Layla", tier: "S", winRate: 53.21, banRate: 1.5, pickRate: 4.2, score: 53.6 };

describe("links", () => {
  it("carry the language prefix and the campaign tags", () => {
    const url = new URL(siteLink(SITE, "fr", "/heroes/layla", "hero"));
    expect(url.pathname).toBe("/fr/heroes/layla");
    expect(url.searchParams.get("utm_source")).toBe("discord");
    expect(url.searchParams.get("utm_medium")).toBe("bot");
    expect(url.searchParams.get("utm_campaign")).toBe("hero");
    expect(siteLink(SITE, "en", "/")).toBe("https://mlbbdex.com/en?utm_source=discord&utm_medium=bot");
  });

  it("only accept site paths or https URLs as images", () => {
    expect(assetUrl(SITE, "/visuels/a b.webp")).toBe("https://mlbbdex.com/visuels/a%20b.webp");
    expect(assetUrl(SITE, "https://cdn.example/x.png")).toBe("https://cdn.example/x.png");
    expect(assetUrl(SITE, "//evil.example/x.png")).toBeUndefined();
    expect(assetUrl(SITE, "javascript:alert(1)")).toBeUndefined();
    expect(assetUrl(SITE, null)).toBeUndefined();
  });

  it("invite with the least-privilege permission bitfield", () => {
    expect(INVITE_PERMISSIONS).toBe(274878286912n);
    const url = new URL(inviteUrl("123456789012345678"));
    expect(url.searchParams.get("permissions")).toBe("274878286912");
    expect(url.searchParams.get("scope")).toBe("bot applications.commands");
  });
});

describe("hero embeds", () => {
  it("show roles, lanes, tier and rates in the reply language, and link to the hero page", () => {
    const json = heroEmbed(fr, layla, ranking, { items: ["Bottes", "Lame"], emblem: "Marksman", spell: "Flicker" }).toJSON();
    expect(json.title).toBe("Layla — Malefic Gunner");
    expect(json.url).toContain("/fr/heroes/layla?utm_source=discord");
    expect(json.thumbnail?.url).toBe("https://mlbbdex.com/visuels/heros/layla/icone.webp");
    const field = (name: string) => json.fields?.find((f) => f.name === name)?.value;
    expect(field("Rôle")).toBe("Tireur");
    expect(field("Lanes")).toBe("Or");
    expect(field("Tier")).toBe("**S**");
    expect(field("Taux de victoire")).toMatch(/53,2\s?%/);
    expect(field("Meilleur build")).toBe("Bottes · Lame");
    expect(field("Compétences")).toBe("Malefic Gun · Void Projectile");
  });

  it("works without a ranking or a build", () => {
    const json = heroEmbed(en, layla, null, null).toJSON();
    expect(json.fields?.map((f) => f.name)).toEqual(["Role", "Lanes", "Skills"]);
  });

  it("has Build, Counters, Skins buttons and a link", () => {
    const row = heroButtons(en, "layla").toJSON();
    const ids = row.components.map((c) => ("custom_id" in c ? c.custom_id : "url" in c ? c.url : null));
    expect(ids.slice(0, 3)).toEqual(["hero:build:layla", "hero:counter:layla", "hero:skins:layla"]);
    expect(String(ids[3])).toContain("/en/heroes/layla");
  });

  it("picks the most played measured build", () => {
    const b = (pick: number) => ({ items: [`i${pick}`], emblem: null, talents: [], spell: null, winRate: 50, pickRate: pick });
    expect(bestBuild({ Gold: { all: [b(2), b(9)] }, Roam: { all: [b(5)] } })?.items).toEqual(["i9"]);
    expect(bestBuild({ Gold: { epic: [b(2)] } })).toBeNull();
    expect(bestBuild(null)).toBeNull();
  });

  it("build and counter embeds say when there is nothing", () => {
    expect(buildEmbed(en, layla, [], null).toJSON().description).toBe("No build measured for this hero yet.");
    expect(counterEmbed(en, layla, { strong: [], weak: [] }).toJSON().description).toBe("No measured counters for this hero yet.");
    const counters = counterEmbed(en, layla, { strong: [{ name: "Chou", advantage: 2.5 }], weak: [{ name: "Saber", advantage: -3 }] }).toJSON();
    expect(counters.fields?.[0]?.value).toBe("Saber `-3.0`");
    expect(counters.fields?.[1]?.value).toBe("Chou `+2.5`");
  });

  it("tier list groups the top tiers and item embeds skip empty fields", () => {
    const tl = tierlistEmbed(en, [ranking, { ...ranking, slug: "chou", name: "Chou", tier: "S+" }, { ...ranking, tier: "C", name: "Zed" }], null, "/tier-list", null).toJSON();
    expect(tl.fields?.map((f) => `${f.name}:${f.value}`)).toEqual(["S+ · 1:Chou", "S · 1:Layla"]);
    const item = itemEmbed(en, { slug: "blade", name: "Blade", summary: null, category: "Attack", price: 2000, bonus: "+60 Physical Attack", unique: null, passive: null, active: null, recipe: [] }).toJSON();
    expect(item.fields?.map((f) => f.name)).toEqual(["Category", "Price", "Stats"]);
  });
});

describe("announcements", () => {
  it("mention only the configured role, never @everyone or @here", () => {
    const msg = announcementMessage(
      "patches",
      { version: "2.1.90", url: "/patch-notes/2.1.90", counts: { buff: 3, nerf: 2, adjust: 1 }, heroes: [] },
      "en",
      ROLE,
      SITE,
    )!;
    expect(msg.content).toBe(`<@&${ROLE}>`);
    expect(msg.allowed_mentions).toEqual({ parse: [], roles: [ROLE], users: [], replied_user: false });
    expect(msg.embeds?.[0]?.title).toBe("New patch: 2.1.90");
    expect(msg.embeds?.[0]?.description).toBe("3 buffs, 2 nerfs, 1 adjustments.");
    expect(msg.embeds?.[0]?.url).toContain("/en/patch-notes/2.1.90?utm_source=discord&utm_medium=bot");
    expect(allowedMentionsFor(null)).toEqual({ parse: [], roles: [], users: [], replied_user: false });
  });

  it("an @everyone in a payload stays inert text", () => {
    const msg = announcementMessage("skins", { hero: "layla", heroName: "@everyone", name: "@here", url: "/skins" }, "en", null, SITE)!;
    expect(msg.content).toBeUndefined();
    expect(msg.allowed_mentions?.parse).toEqual([]);
  });

  it("refuse a payload that does not match its type, or an off-site URL", () => {
    expect(announcementMessage("patches", { version: "2.1.90" }, "en", null, SITE)).toBeNull();
    expect(announcementMessage("events", { month: "2026-11", title: "x", url: "https://evil.example" }, "en", null, SITE)).toBeNull();
    expect(announcementMessage("esports", null, "en", null, SITE)).toBeNull();
  });

  it("are written in the server's language", () => {
    const msg = announcementMessage("advanceServer", { version: "2.2.20", url: "/patch-notes/advance-server/2.2.20" }, "id", null, SITE)!;
    expect(msg.embeds?.[0]?.title).toBe("Advance server: 2.2.20");
    expect(msg.embeds?.[0]?.url).toContain("/id/patch-notes/advance-server/2.2.20");
    expect(testMessage(fr).allowed_mentions?.parse).toEqual([]);
  });
});

describe("daily games", () => {
  const hero = (slug: string, over: Partial<MlbbdleHero> = {}): MlbbdleHero => ({
    slug, name: slug, icon: null, gender: "female", roles: ["Mage"], lanes: ["Mid"], specialties: ["burst"],
    damage: "magic", range: "ranged", resource: "mana", region: "moniyan", year: 2020, ...over,
  });

  it("classic grid shows squares and names to the player, and the solve line", () => {
    const secret = hero("aurora");
    const json = mlbbdleClassicEmbed(en, 65, [hero("chou", { roles: ["Fighter"], year: 2016 }), secret], secret, true).toJSON();
    expect(json.title).toBe("MLBBdle #65 · Classic");
    expect(json.description).toContain("Found: **aurora** in 2 guesses!");
    expect(json.description).toContain("🟩🟥🟩🟩🟩🟩🟩🟩🟥 ⬆️ chou");
    expect(json.description).toContain("🟩🟩🟩🟩🟩🟩🟩🟩🟩 aurora");
  });

  it("quiz rounds become buttons carrying the day and the step", () => {
    const step = {
      kind: "guess" as const,
      round: { type: "item" as const, reponse: "blade", bonus: "+60", prix: 2000, categorie: "Attack", recette: [{ nom: "Dagger" }], passif: null },
      answer: "blade",
      choices: [{ slug: "blade", label: "Blade" }, { slug: "wand", label: "Wand" }],
    };
    expect(quizButtons("2026-11-14", 2, step).toJSON().components.map((c) => ("custom_id" in c ? c.custom_id : ""))).toEqual([
      "quiz:2026-11-14:2:0",
      "quiz:2026-11-14:2:1",
    ]);
    const embed = quizStepEmbed(en, 12, step, 2, 7, "✅ Right!").toJSON();
    expect(embed.author?.name).toBe("Round 3 of 7");
    expect(embed.description).toContain("Price: 2000");
    expect(embed.description).not.toContain("blade");
  });

  it("leaderboards and daily posts escape names and ping nobody", () => {
    const board = leaderboardEmbed(en, "quiz", "week", {
      entries: [{ rank: 1, discordUserId: "123456789012345678", discordUserName: "**bold**", score: 12, plays: 3 }],
    }).toJSON();
    expect(board.description).toBe("🥇 \\*\\*bold\\*\\* — 12 points · 3 plays");
    const post = dailyPost(en, "mlbbdle", "2026-11-14", 65);
    expect(post.allowed_mentions).toEqual({ parse: [] });
    expect(JSON.stringify(post.components)).toContain("daily:mlbbdle:2026-11-14");
  });
});

describe("events announcement", () => {
  it("names the month in the server's language when the site sends no title", () => {
    const msg = announcementMessage("events", { month: "2026-11", url: "/events/2026-11", count: 4 }, "fr", null, SITE)!;
    expect(msg).not.toBeNull();
    expect(msg.embeds?.[0]?.title).toBe("Événements : novembre 2026");
    expect(monthName("2026-11", "en")).toBe("November 2026");
    expect(monthName("soon", "en")).toBe("soon");
  });
});

describe("text a member typed, shown back by the bot", () => {
  // A masked link in the bot's own message reads as the bot vouching for it:
  // "[Free Nitro](https://evil.example)" must show as text, its URL visible.
  const lure = "[Free Nitro](https://evil.example)";
  const rendersAsLink = /(^|[^\\])\[Free Nitro\]\(/;

  it("never renders as a masked link, a heading or a list", () => {
    expect(plain(lure)).toBe("\\[Free Nitro](https://evil.example)");
    expect(plain("# big")).toBe("\\# big");
    expect(plain("- item")).toBe("\\- item");
    expect(plain("**bold**")).toBe("\\*\\*bold\\*\\*");
  });

  it("is escaped in the public not-found reply, cut to 100 characters", () => {
    const embed = notFoundEmbed(en, lure).toJSON();
    expect(embed.description).toContain("\\[Free Nitro](https://evil.example)");
    expect(embed.description).not.toMatch(rendersAsLink);
    expect(notFoundEmbed(en, "x".repeat(300)).toJSON().description).not.toContain("x".repeat(101));
  });

  it("is escaped in display names on leaderboards and solve lines", () => {
    const board = leaderboardEmbed(en, "quiz", "week", {
      entries: [{ rank: 1, discordUserId: "123456789012345678", discordUserName: lure, score: 12, plays: 3 }],
    }).toJSON();
    expect(board.description).not.toMatch(rendersAsLink);
    expect(mlbbdleSolvedPublic(en, lure, "classic", 65, 3, [])).not.toMatch(rendersAsLink);
  });
});

describe("skins announcement", () => {
  it("keeps the gallery anchor of the skin, after the tracking parameters", () => {
    const msg = announcementMessage(
      "skins",
      { hero: "layla", heroName: "Layla", name: "Lumière", url: "/heroes/layla/skins#skin-lumiere" },
      "en",
      null,
      SITE,
    );
    expect(msg).not.toBeNull();
    expect(msg!.embeds?.[0]?.url).toMatch(/\/en\/heroes\/layla\/skins\?utm_source=discord.*#skin-lumiere$/);
  });
});

