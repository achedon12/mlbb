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
      // Without motion: the scroll reveal would leave unseen sections blank.
      await page.emulateMedia({ reducedMotion: "reduce" });
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
      // The elements wider than the screen, to find what scrolls sideways.
      const wide = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const label = (el: Element) => `${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").slice(0, 70)}`;
        const rows = [...document.querySelectorAll("body *")]
          .map((el) => ({ el, right: Math.round(el.getBoundingClientRect().right) }))
          .filter(({ right }) => right > vw + 1)
          // Inside a scrolling or clipping box, a wide child does not widen the page.
          .filter(({ el }) => {
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(p).overflowX)) return false;
            }
            return true;
          })
          .sort((x, y) => y.right - x.right)
          .slice(0, 12)
          .map(({ el, right }) => {
            const chain: string[] = [];
            for (let p = el.parentElement, i = 0; p && i < 4; p = p.parentElement, i++) chain.push(label(p));
            return `${right} ${label(el)}\n    < ${chain.join("\n    < ")}`;
          });
        // Which block widens the page: hide each one in turn and measure.
        const culprits: string[] = [];
        const probe = (root: Element, depth: number) => {
          for (const child of [...root.children]) {
            const el = child as HTMLElement;
            const before = el.style.display;
            el.style.display = "none";
            const fixed = document.documentElement.scrollWidth <= vw + 1;
            el.style.display = before;
            if (fixed) {
              culprits.push(`${"  ".repeat(depth)}${label(el)}`);
              if (depth < 6) probe(el, depth + 1);
              return;
            }
          }
        };
        if (document.documentElement.scrollWidth > vw + 1) probe(document.body, 0);
        return [`scrollWidth=${document.documentElement.scrollWidth} clientWidth=${vw}`, "culprit path:", ...culprits, "widest:", ...rows];
      });
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync("test-results/visual", { recursive: true });
      writeFileSync(`test-results/visual/${name}-${size}-overflow.txt`, wide.join("\n"));
    });
  }
}
