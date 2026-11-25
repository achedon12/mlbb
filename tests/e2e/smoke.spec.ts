import { expect, test } from "@playwright/test";

test("the home page opens and leads to the catalog", async ({ page }) => {
  await page.goto("/fr");
  await expect(page).toHaveTitle(/Mobile Legends/i);
  await page.getByRole("link", { name: /parcourir les h[ée]ros/i }).first().click();
  await expect(page).toHaveURL(/\/heroes/);
});

test("the home page search leads to the filtered catalog", async ({ page }) => {
  await page.goto("/fr");
  const form = page.getByRole("search");
  await form.getByRole("searchbox", { name: /rechercher un h[ée]ros/i }).fill("khufra");
  await form.getByRole("button", { name: /chercher/i }).click();
  await expect(page).toHaveURL(/\/fr\/heroes\?q=khufra$/);
  await expect(page.getByPlaceholder(/rechercher un h[ée]ros/i)).toHaveValue("khufra");
});

test("the home page button opens the global search", async ({ page }) => {
  await page.goto("/fr");
  const dialog = page.getByRole("dialog", { name: /rechercher/i });
  // The button only answers once the page is hydrated.
  await expect(async () => {
    await page.getByRole("button", { name: /chercher aussi un objet/i }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
});

test("the home page shows the patch's top five and today's games", async ({ page }) => {
  await page.goto("/fr");
  const meta = page.locator("section", { has: page.locator("#home-meta") });
  await expect(meta.getByRole("heading", { level: 3, name: /top 5 du patch/i })).toBeVisible();
  await expect(meta.getByRole("list").first().getByRole("link")).toHaveCount(5);
  const daily = page.locator("section", { has: page.locator("#home-daily") });
  await expect(daily.getByRole("link", { name: /mlbbdle/i })).toHaveAttribute("href", /\/fr\/mlbbdle$/);
  await expect(daily.getByRole("link", { name: /quiz/i })).toHaveAttribute("href", /\/fr\/quiz$/);
});

test("the home page fits a phone screen without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/fr");
  // The search shows on the first screen.
  const search = page.getByRole("searchbox", { name: /rechercher un h[ée]ros/i });
  const box = await search.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(740);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the catalog filters by search", async ({ page }) => {
  await page.goto("/fr/heroes");
  await page.getByPlaceholder(/rechercher un h[ée]ros/i).fill("khufra");
  const cards = page.getByRole("heading", { level: 3 });
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveText(/khufra/i);
});

test("search is reachable through the URL", async ({ page }) => {
  await page.goto("/fr/heroes?q=layla");
  await expect(page.getByPlaceholder(/rechercher un h[ée]ros/i)).toHaveValue("layla");
});

test("a hero page shows its skills", async ({ page }) => {
  await page.goto("/fr/heroes/khufra");
  await expect(page.getByRole("heading", { name: "Khufra", level: 1 })).toBeVisible();
  await page.getByRole("tab", { name: /comp[ée]tences/i }).click();
  await expect(page.getByText(/passif/i).first()).toBeVisible();
});

test("the comparator compares two heroes through the URL", async ({ page }) => {
  await page.goto("/fr/compare?a=khufra&b=fanny");
  await expect(page.getByText(/^taux de victoire$/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Khufra" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fanny" })).toBeVisible();
});

test("legal pages are reachable", async ({ page }) => {
  await page.goto("/fr/legal");
  await expect(page.getByRole("heading", { name: /mentions l[ée]gales/i })).toBeVisible();
  await page.goto("/fr/privacy");
  await expect(page.getByRole("heading", { name: /confidentialit[ée]/i })).toBeVisible();
});

test("the breadcrumb leads from the hero page to the catalog", async ({ page }) => {
  await page.goto("/fr/heroes/khufra");
  const trail = page.getByRole("navigation", { name: /fil d'ariane/i });
  await expect(trail).toContainText("Accueil");
  await trail.getByRole("link", { name: /h[ée]ros/i }).click();
  await expect(page).toHaveURL(/\/heroes$/);
});

test("the site remains browsable offline", async ({ page, context }) => {
  test.skip(!process.env.CI, "the service worker is only active in production");
  await page.goto("/fr/heroes");
  // The service worker must control the page before going on: otherwise the
  // hero page would not go through it and would not be kept.
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 });
  await page.goto("/fr/heroes/khufra");
  await page.waitForFunction(async () => !!(await caches.match(location.href)), null, { timeout: 30_000 });

  await context.setOffline(true);
  await page.goto("/fr/heroes/khufra");
  await expect(page.getByRole("heading", { name: "Khufra", level: 1 })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /hors ligne/i })).toBeVisible();
  // A hero page never visited leads to the "offline" page.
  await page.goto("/fr/heroes/fanny");
  await expect(page.getByRole("heading", { name: /hors ligne/i, level: 1 })).toBeVisible();
  await context.setOffline(false);
});
