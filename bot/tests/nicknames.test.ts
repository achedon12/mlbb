import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as bot from "../src/games/nicknames.js";

/**
 * Parity with the site's generator: the bot's copy must style every input
 * exactly like `src/lib/nicknames.ts`. Skipped when the bot is built outside
 * the repository (its Docker image), where the site's file is absent.
 */

const SITE_FILE = fileURLToPath(new URL("../../src/lib/nicknames.ts", import.meta.url));

const SAMPLES = [
  "Achedon12",
  "Hello World",
  "abcdefghijklmnopqrstuvwxyz",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "0123456789",
  "Éléonore_ç ñ",
  "xX_Pro_Xx",
  "名前 Name",
  "  spaced​ outㅤ ",
  "́Leading accent",
  "a".repeat(40),
];

describe.skipIf(!existsSync(SITE_FILE))("nickname parity with the site", async () => {
  const site = (await import(SITE_FILE)) as typeof bot;

  it("has the same styles, in the same order", () => {
    expect(bot.STYLES).toEqual(site.STYLES);
  });

  it("styles every sample identically in every style", () => {
    for (const style of bot.STYLES) {
      for (const text of SAMPLES) expect(bot.stylize(text, style), `${style}: ${text}`).toBe(site.stylize(text, style));
    }
  });

  it("sanitizes and measures identically", () => {
    for (const text of SAMPLES) {
      expect(bot.sanitize(text)).toBe(site.sanitize(text));
      expect(bot.measure(text)).toEqual(site.measure(text));
    }
  });
});

describe("nickname styling", () => {
  it("keeps what has no styled form", () => {
    expect(bot.stylize("Bé!", "bold")).toBe("𝐁é!");
    expect(bot.stylize("ab c", "underline")).toBe("a̲b̲ c̲");
    expect(bot.sanitize("  a​b  ")).toBe("ab");
  });
});
