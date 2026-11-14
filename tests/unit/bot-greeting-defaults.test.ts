import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/config";
import { GREETING_DEFAULTS } from "@/lib/bot/greeting-defaults";
import { GREETING_KINDS } from "@/lib/bot/kinds";

/** The dashboard's default texts must be the very ones the bot posts. */
describe("default welcome and goodbye texts", () => {
  it("match the bot's own, in every server language", () => {
    for (const locale of LOCALES) {
      const bot = JSON.parse(readFileSync(join(process.cwd(), "bot", "src", "i18n", `${locale}.json`), "utf8")) as {
        ui: { greetings: Record<string, string> };
      };
      for (const kind of GREETING_KINDS) expect(GREETING_DEFAULTS[locale][kind], `${locale} ${kind}`).toBe(bot.ui.greetings[kind]);
    }
  });
});
