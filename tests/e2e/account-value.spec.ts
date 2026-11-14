import { expect, test } from "@playwright/test";

/**
 * The account value estimator counts skins by the Showcase's tiers: the
 * typed counts give back the game's collection points, and a screenshot of
 * the panel fills them in the browser (the real OCR, self-hosted, so this
 * test is slow).
 */
test("typed Showcase counts give back the game's collection points", async ({ page }) => {
  await page.goto("/en/tools/account-value");
  const counts: [RegExp, string][] = [
    [/^Supreme/, "1"],
    [/^Grand/, "12"],
    [/^Exquisite/, "19"],
    [/^Deluxe/, "69"],
    [/^Exceptional/, "130"],
    [/^Common/, "240"],
    [/^Painted skins/, "39"],
  ];
  for (const [label, value] of counts) await page.getByLabel(label).fill(value);
  await expect(page.getByText("157,160", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/s=legend\.1%2Cgrand\.12%2Cexquisite\.19%2Cdeluxe\.69%2Cexceptional\.130%2Ccommon\.240%2Cpainted\.39/);
});

test("a Showcase screenshot fills the counts, read in the browser", async ({ page, baseURL }) => {
  test.slow();
  const outside: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(baseURL!) && !/^(data|blob):/.test(r.url())) outside.push(r.url());
  });
  await page.goto("/en/tools/account-value");
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles("tests/fixtures/showcase/showcase-fr.jpg");
  await expect(page.getByText(/values detected on your screenshot/i)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/the total read \(157,160\) matches/i)).toBeVisible();
  await expect(page.getByLabel(/^Grand/)).toHaveValue("12");
  await expect(page.getByLabel(/^Common/)).toHaveValue("240");
  await expect(page.getByText("157,160", { exact: true })).toBeVisible();
  // The image and the reader stay on the site: nothing is sent elsewhere.
  expect(outside.filter((u) => !u.includes("matomo"))).toEqual([]);
});
