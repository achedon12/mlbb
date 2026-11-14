/**
 * Web app manifest screenshots (the richer install dialog of Chrome and
 * Edge), taken from the live site with Playwright's Chromium.
 *
 *   node scripts/app-screenshots.mjs [--base https://mlbbdex.com]
 *
 * Writes `public/screenshots/<page>-narrow.webp` (1080x1920) and
 * `<page>-wide.webp` (1920x1080), English pages. The audience measurement
 * requests are blocked: the captures must not count as visits.
 *
 * The pages list is mirrored in `src/app/manifest.ts` (SCREENSHOTS): run
 * again after a redesign, then commit the images.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const i = process.argv.indexOf("--base");
const BASE = (i > -1 && process.argv[i + 1] ? process.argv[i + 1] : "https://mlbbdex.com").replace(/\/$/, "");

const PAGES = [
  { name: "home", path: "" },
  { name: "tier-list", path: "/tier-list" },
  { name: "hero", path: "/heroes/layla" },
  { name: "builds", path: "/builds" },
  { name: "mlbbdle", path: "/mlbbdle" },
];

const FORMATS = [
  { form: "narrow", viewport: { width: 360, height: 640 }, scale: 3 },
  { form: "wide", viewport: { width: 1280, height: 720 }, scale: 1.5 },
];

const browser = await chromium.launch();
try {
  await mkdir("public/screenshots", { recursive: true });
  for (const format of FORMATS) {
    for (const { name, path } of PAGES) {
      // A fresh context per page: a first visit, without the Discord
      // invitation that shows from the second page on.
      const context = await browser.newContext({
        viewport: format.viewport,
        deviceScaleFactor: format.scale,
        isMobile: format.form === "narrow",
        hasTouch: format.form === "narrow",
        colorScheme: "dark",
        locale: "en",
      });
      await context.route(/matomo|piwik/i, (route) => route.abort());
      const page = await context.newPage();
      await page.goto(`${BASE}/en${path}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const png = await page.screenshot({ type: "png" });
      await sharp(png).webp({ quality: 78 }).toFile(`public/screenshots/${name}-${format.form}.webp`);
      console.log(`  ${name} (${format.form})`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log("Screenshots written.");
