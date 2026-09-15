import { expect, test, type ConsoleMessage } from "@playwright/test";
import { PAGES, PLACEHOLDER } from "../../scripts/smoke-check-rules.mjs";

/**
 * Content checks in a real browser, on the pages of the smoke check table
 * marked `browser`. `scripts/smoke-check.mjs` reads the server HTML of the
 * whole table; this spec looks at what the page becomes once hydrated: the
 * text a visitor reads, the title after client navigation code ran, and any
 * console or page error during load (a hydration mismatch shows up there).
 *
 * Only static paths: discovered ones (compare pairs, latest patch) are left to
 * the smoke check, which reads the sitemap.
 */

/** English and French for every page; the other languages on the pages that list them. */
const BROWSER_LOCALES = ["en", "fr"];

const targets = PAGES.filter((page) => page.browser && !page.discover).flatMap((page) =>
  page.locales
    .filter((locale) => BROWSER_LOCALES.includes(locale) || page.path === "")
    .map((locale) => ({ path: `/${locale}${page.path}`, allowed: page.allowedPlaceholders ?? [] })),
);

/**
 * A resource from another origin that fails to load (a remote image, say) is
 * not a regression of the site itself: only same-origin failures count.
 */
function isThirdPartyResourceFailure(message: ConsoleMessage, origin: string): boolean {
  if (!/^Failed to load resource/i.test(message.text())) return false;
  const url = message.location().url;
  return !!url && !url.startsWith(origin);
}

for (const { path, allowed } of targets) {
  test(`content of ${path}`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "http://localhost:3001").origin;
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !isThirdPartyResourceFailure(message, origin)) {
        errors.push(`console: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));

    const response = await page.goto(path, { waitUntil: "load" });
    expect(response?.status(), "status").toBe(200);
    // Give hydration and the requests fired after it a moment to settle.
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    const title = await page.title();
    expect.soft(title.trim(), "title").not.toBe("");
    expect.soft(title, "title").not.toContain("{");

    const text = await page.evaluate(() => document.body.innerText);
    const placeholders = [...new Set(text.match(PLACEHOLDER) ?? [])].filter((p) => !allowed.includes(p));
    expect.soft(placeholders, "placeholders in the visible text").toEqual([]);

    expect(errors, "console and page errors during load").toEqual([]);
  });
}
