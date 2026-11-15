import { expect, test } from "@playwright/test";

/**
 * The 404 page in the server HTML, as a crawler without JavaScript gets it:
 * the localized view inside the site's layout, never Next's empty error shell
 * (`src/components/not-found-page.tsx`). The status is only checked against a
 * production server (continuous integration): the development server renders
 * every page on demand, where the 404 signal cannot change the status.
 */
const ADDRESSES = [
  "/fr/heroes/zzz",
  "/fr/heroes/zzz/skins",
  "/fr/patch-notes/zzz",
  "/fr/esports/players/zzz",
  "/fr/compare/zzz-vs-yyy",
  "/fr/unknown/address",
];

for (const address of ADDRESSES) {
  test(`404 page in the server HTML: ${address}`, async ({ request }) => {
    const response = await request.get(address);
    if (process.env.CI) expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).not.toContain("__next_error__");
    expect(html).toContain("<title>Page introuvable — MLBBDex</title>");
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain("data-not-found");
    expect(html).toMatch(/<header[\s>]/);
    expect(html).toMatch(/<footer[\s>]/);
  });
}

test("the 404 page is in the visitor's language", async ({ request }) => {
  const html = await (await request.get("/it/heroes/zzz")).text();
  expect(html).toContain("<title>Pagina non trovata — MLBBDex</title>");
  expect(html).toContain('lang="it-IT"');
});

test("in the browser, the 404 page stays one page, without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/fr/heroes/zzz");
  await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-not-found]")).toHaveCount(1);
  await expect(page.locator("header").first()).toBeVisible();
  expect(errors).toEqual([]);
});
