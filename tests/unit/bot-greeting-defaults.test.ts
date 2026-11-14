import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES as BOT_OWN_LOCALES } from "../../bot/src/i18n/locales";
import { LOCALES } from "@/i18n/config";
import { GREETING_DEFAULTS } from "@/lib/bot/greeting-defaults";
import { BOT_LOCALES, GREETING_KINDS } from "@/lib/bot/kinds";

/** The dashboard's default texts must be the very ones the bot posts. */
describe("default welcome and goodbye texts", () => {
  it("match the bot's own, in every server language", () => {
    for (const locale of BOT_LOCALES) {
      const bot = JSON.parse(readFileSync(join(process.cwd(), "bot", "src", "i18n", `${locale}.json`), "utf8")) as {
        ui: { greetings: Record<string, string> };
      };
      for (const kind of GREETING_KINDS) expect(GREETING_DEFAULTS[locale][kind], `${locale} ${kind}`).toBe(bot.ui.greetings[kind]);
    }
  });

  it("are offered in the bot's languages only, not every site language", () => {
    expect([...BOT_LOCALES].sort()).toEqual([...BOT_OWN_LOCALES].sort());
    expect(Object.keys(GREETING_DEFAULTS).sort()).toEqual([...BOT_LOCALES].sort());
    // The site has more languages than the bot: the dashboard must not offer them.
    expect(LOCALES.filter((l) => !(BOT_LOCALES as readonly string[]).includes(l)).length).toBeGreaterThan(0);
  });
});
