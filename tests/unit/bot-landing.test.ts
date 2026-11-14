import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { BOT_CATEGORIES, BOT_COMMANDS, voteUrl } from "@/lib/bot/commands";

/**
 * The /bot landing page: its command list follows the bot's own commands,
 * and every text and screenshot it shows exists.
 */

const botMessages = JSON.parse(readFileSync("bot/src/i18n/en.json", "utf8")) as { commands: Record<string, unknown> };

describe("/bot command list", () => {
  it("lists every command of the bot exactly once", () => {
    const names = BOT_COMMANDS.map((c) => c.name);
    expect([...names].sort()).toEqual(Object.keys(botMessages.commands).sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it("groups them in the bot's six families, none empty", () => {
    for (const category of BOT_CATEGORIES) expect(BOT_COMMANDS.some((c) => c.category === category), category).toBe(true);
  });

  it("has every text in every language", () => {
    for (const locale of LOCALES) {
      const t = createT(locale);
      const keys = [
        ...BOT_COMMANDS.map((c) => `pages.bot.commands.${c.name}`),
        ...BOT_CATEGORIES.map((c) => `pages.bot.categories.${c}`),
        ...["heroes", "builds", "meta", "news", "daily"].flatMap((k) => ["Title", "Text", "Alt"].map((s) => `pages.bot.showcase.${k}${s}`)),
        ...Array.from({ length: 8 }, (_, i) => [`pages.bot.faq${i + 1}q`, `pages.bot.faq${i + 1}a`]).flat(),
        "pages.bot.vote",
        "pages.bot.ctaTitle",
      ];
      for (const key of keys) expect(t(key), `${locale} ${key}`).not.toBe(key);
      // Brand names stay as they are in every language.
      expect(t("pages.bot.add"), locale).toContain("Discord");
      expect(t("pages.bot.title"), locale).toMatch(/Mobile Legends/);
    }
  });
});

describe("/bot visuals and links", () => {
  it("serves the screenshots and the banner it shows", () => {
    for (const name of ["banner", "screenshot-hero", "screenshot-counter", "screenshot-tierlist", "screenshot-patch", "screenshot-mlbbdle"]) {
      expect(existsSync(`public/bot/${name}.webp`), name).toBe(true);
    }
    expect(existsSync("public/bot/banner.png")).toBe(true);
  });

  it("votes on the bot's top.gg page", () => {
    expect(voteUrl("1571083624789581834")).toBe("https://top.gg/bot/1571083624789581834/vote");
  });
});
