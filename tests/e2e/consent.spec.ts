import { expect, test, type Page } from "@playwright/test";

/**
 * The cookie banner: it only exists when Matomo is configured
 * (`NEXT_PUBLIC_MATOMO_URL`), so these tests run against a server started
 * with it — any address will do, the tracker failing to load changes
 * nothing here. Without it, they are skipped.
 */
test.skip(!process.env.NEXT_PUBLIC_MATOMO_URL, "Matomo is not configured: no banner to test");

const banner = (page: Page) => page.getByRole("region", { name: /cookies de mesure d'audience/i });
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("mlbb_consent") ?? "null"));
const matomoCookies = async (page: Page) =>
  (await page.context().cookies()).filter((c) => c.name.startsWith("_pk_") || c.name.startsWith("mtm_"));

test("refusing hides the banner for good and sets no cookie", async ({ page }) => {
  await page.goto("/fr");
  await expect(banner(page)).toBeVisible();
  // Escape is not an answer.
  await page.getByRole("button", { name: "Refuser" }).focus();
  await page.keyboard.press("Escape");
  await expect(banner(page)).toBeVisible();

  await page.getByRole("button", { name: "Refuser" }).click();
  await expect(banner(page)).toBeHidden();
  expect(await stored(page)).toMatchObject({ choice: "denied" });
  expect(await matomoCookies(page)).toEqual([]);

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(banner(page)).toBeHidden();
});

test("accepting is remembered, and the footer reopens the banner to withdraw", async ({ page }) => {
  await page.goto("/fr/heroes");
  await expect(banner(page)).toBeVisible();
  await page.getByRole("button", { name: "Accepter" }).click();
  await expect(banner(page)).toBeHidden();
  expect(await stored(page)).toMatchObject({ choice: "granted" });

  await page.reload();
  await page.getByRole("button", { name: "Gérer les cookies" }).click();
  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText(/cookies acceptés/i);
  await expect(page.getByRole("button", { name: "Refuser" })).toBeFocused();

  await page.getByRole("button", { name: "Refuser" }).click();
  await expect(banner(page)).toBeHidden();
  expect(await stored(page)).toMatchObject({ choice: "denied" });
});

test("the banner links to the cookies section of the privacy page", async ({ page }) => {
  await page.goto("/fr");
  await banner(page).getByRole("link", { name: /en savoir plus/i }).click();
  await expect(page).toHaveURL(/\/fr\/privacy#cookies$/);
  await expect(page.getByRole("heading", { name: "Cookies", level: 2 })).toBeVisible();
});
