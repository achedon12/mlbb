import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

/**
 * The collection tool, signed out: the browser save, the shortcuts, the
 * backup file both ways, and the inline confirmation that replaced the
 * browser's dialog.
 */
test("the collection tool saves in the browser, exports and imports a backup", async ({ page }) => {
  await page.goto("/en/tools/collection");
  const search = page.getByRole("searchbox", { name: /search a hero or a skin/i });
  await expect(search).toBeVisible();
  // Without a database (or signed out), the collection says where it lives.
  await expect(page.getByRole("status").filter({ hasText: /this browser/i })).toBeVisible();

  // "/" jumps to the search; typing narrows the list to one hero.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await search.fill("Miya");
  await page.getByRole("button", { name: /tick miya and all their skins/i }).click();
  await expect(page.getByRole("progressbar", { name: "Skins" })).not.toHaveAttribute("aria-valuenow", "0");

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mlbbdex:collection") ?? "{}"));
  expect(saved.heros).toEqual(["miya"]);
  expect(saved.skins.length).toBeGreaterThan(3);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const file = await (await download).path();
  const backup = JSON.parse(await readFile(file, "utf8"));
  expect(backup).toMatchObject({ format: "mlbbdex-collection", version: 1, heroes: ["miya"] });

  // Clearing asks inline, then empties the collection.
  await page.getByRole("button", { name: /clear my collection/i }).click();
  await page.getByRole("button", { name: /yes, untick everything/i }).click();
  await expect(page.getByRole("progressbar", { name: "Heroes" })).toHaveAttribute("aria-valuenow", "0");

  // The backup comes back, after the in-page choice.
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByText(/in this file: heroes 1,/i)).toBeVisible();
  await page.getByRole("button", { name: /replace my collection/i }).click();
  await expect(page.getByRole("progressbar", { name: "Heroes" })).toHaveAttribute("aria-valuenow", "1");
});

/**
 * Signed in, against a stand-in for the account route (the game's login
 * cannot run in a test): the first visit merges both copies and saves the
 * union, a tick is sent on its own, and a save refused because another
 * device moved on is merged and sent again.
 */
test("signed in, the collection syncs with the account and merges a conflict", async ({ page }) => {
  let stored = { heroes: ["layla"], skins: ["101811"], updatedAt: "2026-11-14T10:00:00.000Z" };
  const puts: { heroes: string[]; skins: string[]; base: string | null }[] = [];
  let conflictOnce = false;
  let version = 0;
  const next = () => new Date(Date.parse("2026-11-14T10:00:00.000Z") + ++version * 1000).toISOString();

  await page.route("**/api/collection", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({ json: { available: true, connected: true, account: "test-account-key", collection: stored } });
    }
    const body = request.postDataJSON();
    puts.push(body);
    if (conflictOnce) {
      // Another device saved meanwhile: it ticked the second Layla skin.
      conflictOnce = false;
      stored = { heroes: stored.heroes, skins: [...stored.skins, "101812"], updatedAt: next() };
      return route.fulfill({ status: 409, json: { error: "conflict", collection: stored } });
    }
    if (body.base !== stored.updatedAt) return route.fulfill({ status: 409, json: { error: "conflict", collection: stored } });
    stored = { heroes: body.heroes, skins: body.skins, updatedAt: next() };
    return route.fulfill({ json: { collection: stored } });
  });

  // This browser already held a Miya skin before signing in.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("mlbbdex:collection", JSON.stringify({ heros: [], skins: ["012"] }));
      sessionStorage.setItem("seeded", "1");
    }
  });
  await page.goto("/en/tools/collection");
  await expect(page.getByRole("status").filter({ hasText: /saved to your account/i })).toBeVisible();
  await expect(page.getByText(/merged with your account/i)).toBeVisible();
  expect(puts[0]).toEqual({ heroes: ["layla"], skins: ["012", "101811"], base: "2026-11-14T10:00:00.000Z" });
  expect(stored.skins).toEqual(["012", "101811"]);

  // The "heroes I play" filter is offered once signed in.
  await expect(page.getByRole("group", { name: "Heroes" }).getByRole("button", { name: /the ones i play/i })).toBeVisible();

  // A tick is sent after the debounce; this one meets a save from another device.
  conflictOnce = true;
  await page.getByRole("searchbox", { name: /search a hero or a skin/i }).fill("Miya");
  await page.getByRole("checkbox", { name: "Miya", exact: true }).check();
  await expect(page.getByText(/updated on another device/i)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /saved to your account/i })).toBeVisible();
  expect(stored.heroes).toEqual(["layla", "miya"]);
  expect(stored.skins).toEqual(["012", "101811", "101812"]);
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem("mlbbdex:collection") ?? "{}"));
  expect(local).toEqual({ heros: ["layla", "miya"], skins: ["012", "101811", "101812"] });
});
