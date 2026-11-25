import { test } from "@playwright/test";

/**
 * Full-page screenshots of the main pages at three widths, kept as a CI
 * artifact ("visual-screenshots") so a layout change can be looked at
 * without running the site. Nothing is compared: this only records.
 */
const WIDTHS = [
  { name: "mobile", width: 360, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];
const PAGES = [
  { name: "home", path: "/fr" },
  { name: "home-en", path: "/en" },
];

for (const { name: size, width, height } of WIDTHS) {
  for (const { name, path } of PAGES) {
    test(`screenshot of ${name} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      // Dismiss the consent banner so it does not hide the bottom of the view.
      const refuse = page.getByRole("button", { name: /refuser|decline|reject/i }).first();
      if (await refuse.isVisible().catch(() => false)) await refuse.click();
      // Let lazy images and count-up figures settle.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `test-results/visual/${name}-${size}.png`, fullPage: true });
    });
  }
}
