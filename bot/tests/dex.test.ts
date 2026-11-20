import { EmbedBuilder } from "discord.js";
import { describe, expect, it } from "vitest";
import { aboutEmbed } from "../src/commands/about.js";
import { helpEmbed } from "../src/commands/help.js";
import { profileReply } from "../src/commands/profile.js";
import { testMessage } from "../src/embeds/announcements.js";
import { DEX_NAME, dexNote, errorEmbed, makeView, notFoundEmbed, withDex } from "../src/embeds/common.js";
import { leaderboardEmbed, mlbbdleClassicEmbed, quizFinishedEmbed } from "../src/embeds/daily.js";
import { buildEmbed, compareEmbed, itemEmbed, patchEmbed, tierlistEmbed, unavailableEmbed } from "../src/embeds/game.js";
import { greetingMessage } from "../src/embeds/greetings.js";
import { DEX_POSES, dexImage } from "../src/links.js";
import type { HeroDetail } from "../src/site/game-data.js";
import type { MlbbdleHero } from "../src/site/schemas.js";

const SITE = "https://mlbbdex.com";
const en = makeView("en", SITE, "dex");
const fr = makeView("fr", SITE, "dex");
const dex = (pose: string) => `${SITE}/mascot/dex-${pose}.webp`;

const layla = {
  slug: "layla",
  name: "Layla",
  title: "",
  roles: ["Marksman"],
  lanes: ["Gold"],
  skills: [],
  skins: [],
  images: { icon: "/visuels/heros/layla/icone.webp", portrait: null, skins: {} },
} as unknown as HeroDetail;

const miya: MlbbdleHero = {
  slug: "miya", name: "Miya", icon: null, gender: "female", roles: [], lanes: [], specialties: [], damage: "", range: "", resource: "", region: "", year: 2016,
};

describe("dexImage", () => {
  it("points at the pose served by the site", () => {
    expect(dexImage("victoire", SITE)).toBe(`${SITE}/mascot/dex-victoire.webp`);
    expect(dexImage("salut")).toBe(`${SITE}/mascot/dex-salut.webp`);
  });

  it("follows the configured site, without a doubled slash", () => {
    expect(dexImage("carte", "https://staging.example/")).toBe("https://staging.example/mascot/dex-carte.webp");
    expect(makeView("en", "http://localhost:3001", "x").dex("idee")).toBe("http://localhost:3001/mascot/dex-idee.webp");
  });

  it("has the six poses of the site's mascot", () => {
    expect([...DEX_POSES].sort()).toEqual(["carte", "idee", "reflexion", "salut", "surpris", "victoire"]);
  });
});

describe("withDex", () => {
  it("takes the free thumbnail", () => {
    const json = withDex(en, new EmbedBuilder().setTitle("x"), "idee").toJSON();
    expect(json.thumbnail?.url).toBe(dex("idee"));
    expect(json.author).toBeUndefined();
  });

  it("never replaces a picture that carries the answer: it moves to the author line", () => {
    const json = withDex(en, new EmbedBuilder().setThumbnail("https://cdn.example/hero.webp"), "idee").toJSON();
    expect(json.thumbnail?.url).toBe("https://cdn.example/hero.webp");
    expect(json.author).toEqual({ name: DEX_NAME, icon_url: dex("idee") });
  });

  it("keeps the author text, and an author icon already set", () => {
    const named = withDex(en, new EmbedBuilder().setAuthor({ name: "Round 1" }).setThumbnail("https://a.example/x.png"), "reflexion").toJSON();
    expect(named.author).toEqual({ name: "Round 1", icon_url: dex("reflexion") });
    const iconned = withDex(en, new EmbedBuilder().setAuthor({ name: "A", iconURL: "https://a.example/i.png" }), "salut", "author").toJSON();
    expect(iconned.author?.icon_url).toBe("https://a.example/i.png");
  });
});

describe("Dex's pose by moment", () => {
  it("is surprised on errors, nothing found and unavailable answers", () => {
    expect(errorEmbed(en, false).toJSON().thumbnail?.url).toBe(dex("surpris"));
    expect(errorEmbed(en, true).toJSON().thumbnail?.url).toBe(dex("surpris"));
    expect(notFoundEmbed(en, "lyla").toJSON().thumbnail?.url).toBe(dex("surpris"));
    expect(unavailableEmbed(en, "/events").toJSON().thumbnail?.url).toBe(dex("surpris"));
    expect(dexNote(en, "x").toJSON().thumbnail?.url).toBe(dex("surpris"));
    expect(tierlistEmbed(en, [], null, "/tier-list", null).toJSON().thumbnail?.url).toBe(dex("surpris"));
    expect(leaderboardEmbed(en, "quiz", "week", { entries: [] }).toJSON().thumbnail?.url).toBe(dex("surpris"));
    const limited = profileReply(en, { reason: "rateLimited" }, { own: true, targetName: "Leo" });
    expect(limited.visibility === "private" && limited.embeds[0]!.toJSON().thumbnail?.url).toBe(dex("surpris"));
  });

  it("speaks in the error texts, in the reader's language", () => {
    expect(notFoundEmbed(fr, "zz").toJSON().description).toContain("Dex n'a rien trouvé pour « zz »");
    expect(errorEmbed(fr, false).toJSON().description).toBe("Oups, Dex a trébuché. Réessaie dans un instant.");
  });

  it("celebrates a solved game, a finished quiz and a working setup", () => {
    expect(mlbbdleClassicEmbed(en, 1, [miya], miya, true).toJSON().thumbnail?.url).toBe(dex("victoire"));
    expect(quizFinishedEmbed(en, 1, 5, 7, null).toJSON().thumbnail?.url).toBe(dex("victoire"));
    expect(testMessage(en).embeds![0]!.thumbnail?.url).toBe(dex("victoire"));
  });

  it("thinks while a game is still open, and on help and about", () => {
    const other = { ...miya, slug: "layla", name: "Layla" };
    expect(mlbbdleClassicEmbed(en, 1, [other], miya, false).toJSON().thumbnail?.url).toBe(dex("reflexion"));
    expect(helpEmbed(en, "overview").toJSON().thumbnail?.url).toBe(dex("reflexion"));
    expect(helpEmbed(en, "games").toJSON().thumbnail?.url).toBe(dex("reflexion"));
    expect(aboutEmbed(en, { version: "1.0.0", servers: 3, startedAt: 0 }).toJSON().thumbnail?.url).toBe(dex("reflexion"));
  });

  it("has an idea on recommendations, beside the hero's or item's own icon", () => {
    const build = buildEmbed(en, layla, [{ items: ["Blade"], emblem: null, spell: null }], null).toJSON();
    expect(build.thumbnail?.url).toBe(`${SITE}/visuels/heros/layla/icone.webp`);
    expect(build.author?.icon_url).toBe(dex("idee"));
    const item = itemEmbed(en, { slug: "blade-of-despair", name: "Blade of Despair", summary: null, category: "Attack", price: 3010, bonus: null, unique: null, passive: null, active: null, recipe: [] }).toJSON();
    expect(item.thumbnail?.url).toBe(`${SITE}/visuels/objets/blade-of-despair.webp`);
    expect(item.author?.icon_url).toBe(dex("idee"));
    expect(compareEmbed(en, { hero: layla, ranking: null }, { hero: { ...layla, slug: "miya", name: "Miya" }, ranking: null }, "/compare").toJSON().thumbnail?.url).toBe(dex("idee"));
  });

  it("holds the map on news and the meta", () => {
    const patch = patchEmbed(en, { version: "2.1.90", title: "Patch 2.1.90", link: "" }, null, true).toJSON();
    expect(patch.thumbnail?.url).toBe(dex("carte"));
    expect(patch.author?.name).toBe("Latest patch");
  });

  it("waves on greetings from the author line, leaving the member's avatar", () => {
    const message = greetingMessage(
      en,
      "welcome",
      { member: { id: "1", username: "Leo", avatarUrl: "https://cdn.discordapp.com/avatars/x.png" }, guildName: "S", memberCount: 2, custom: null },
      { ping: false },
    );
    const embed = message.embeds![0]!;
    expect(embed.thumbnail?.url).toBe("https://cdn.discordapp.com/avatars/x.png");
    expect(embed.author?.icon_url).toBe(dex("salut"));
  });
});
