import { expect, test } from "@playwright/test";

test("l'accueil s'ouvre et mene au catalogue", async ({ page }) => {
  await page.goto("/fr");
  await expect(page).toHaveTitle(/Mobile Legends/i);
  await page.getByRole("link", { name: /parcourir les h[ée]ros/i }).first().click();
  await expect(page).toHaveURL(/\/heroes/);
});

test("le catalogue filtre par la recherche", async ({ page }) => {
  await page.goto("/fr/heroes");
  await page.getByPlaceholder(/rechercher un h[ée]ros/i).fill("khufra");
  const cartes = page.getByRole("heading", { level: 3 });
  await expect(cartes).toHaveCount(1);
  await expect(cartes.first()).toHaveText(/khufra/i);
});

test("la recherche est joignable par l'URL", async ({ page }) => {
  await page.goto("/fr/heroes?q=layla");
  await expect(page.getByPlaceholder(/rechercher un h[ée]ros/i)).toHaveValue("layla");
});

test("une fiche de heros affiche ses competences", async ({ page }) => {
  await page.goto("/fr/heroes/khufra");
  await expect(page.getByRole("heading", { name: "Khufra", level: 1 })).toBeVisible();
  await page.getByRole("tab", { name: /comp[ée]tences/i }).click();
  await expect(page.getByText(/passif/i).first()).toBeVisible();
});

test("le comparateur compare deux heros via l'URL", async ({ page }) => {
  await page.goto("/fr/compare?a=khufra&b=fanny");
  await expect(page.getByText(/^taux de victoire$/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Khufra" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fanny" })).toBeVisible();
});

test("les pages legales sont accessibles", async ({ page }) => {
  await page.goto("/fr/legal");
  await expect(page.getByRole("heading", { name: /mentions l[ée]gales/i })).toBeVisible();
  await page.goto("/fr/privacy");
  await expect(page.getByRole("heading", { name: /confidentialit[ée]/i })).toBeVisible();
});

test("le fil d'Ariane mene de la fiche au catalogue", async ({ page }) => {
  await page.goto("/fr/heroes/khufra");
  const fil = page.getByRole("navigation", { name: /fil d'ariane/i });
  await expect(fil).toContainText("Accueil");
  await fil.getByRole("link", { name: /h[ée]ros/i }).click();
  await expect(page).toHaveURL(/\/heroes$/);
});

test("le site reste consultable hors ligne", async ({ page, context }) => {
  test.skip(!process.env.CI, "le service worker n'est actif qu'en production");
  await page.goto("/fr/heroes");
  // Le service worker doit controler la page avant la suite : sinon la fiche
  // ne passerait pas par lui et ne serait pas gardee.
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 });
  await page.goto("/fr/heroes/khufra");
  await page.waitForFunction(async () => !!(await caches.match(location.href)), null, { timeout: 30_000 });

  await context.setOffline(true);
  await page.goto("/fr/heroes/khufra");
  await expect(page.getByRole("heading", { name: "Khufra", level: 1 })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /hors ligne/i })).toBeVisible();
  // Une fiche jamais consultee mene a la page « hors ligne ».
  await page.goto("/fr/heroes/fanny");
  await expect(page.getByRole("heading", { name: /hors ligne/i, level: 1 })).toBeVisible();
  await context.setOffline(false);
});
