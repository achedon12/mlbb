import { expect, test } from "@playwright/test";

test("l'accueil s'ouvre et mene au catalogue", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Mobile Legends/i);
  await page.getByRole("link", { name: /parcourir les heros/i }).first().click();
  await expect(page).toHaveURL(/\/heroes/);
});

test("le catalogue filtre par la recherche", async ({ page }) => {
  await page.goto("/heroes");
  await page.getByPlaceholder(/rechercher un heros/i).fill("khufra");
  const cartes = page.getByRole("heading", { level: 3 });
  await expect(cartes).toHaveCount(1);
  await expect(cartes.first()).toHaveText(/khufra/i);
});

test("la recherche est joignable par l'URL", async ({ page }) => {
  await page.goto("/heroes?q=layla");
  await expect(page.getByPlaceholder(/rechercher un heros/i)).toHaveValue("layla");
});

test("une fiche de heros affiche ses competences", async ({ page }) => {
  await page.goto("/heroes/khufra");
  await expect(page.getByRole("heading", { name: "Khufra", level: 1 })).toBeVisible();
  await page.getByRole("tab", { name: /competences/i }).click();
  await expect(page.getByText(/passif/i).first()).toBeVisible();
});

test("le comparateur compare deux heros via l'URL", async ({ page }) => {
  await page.goto("/compare?a=khufra&b=fanny");
  await expect(page.getByText("Taux de victoire", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Khufra" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fanny" })).toBeVisible();
});

test("les pages legales sont accessibles", async ({ page }) => {
  await page.goto("/legal");
  await expect(page.getByRole("heading", { name: /mentions legales/i })).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /confidentialite/i })).toBeVisible();
});
