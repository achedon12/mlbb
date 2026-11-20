import { expect, test, type Page } from "@playwright/test";

/**
 * The strategy planner: heroes placed from the side panel, moved with the
 * keyboard, arrows drawn on the map, a history with Ctrl+Z / Ctrl+Y, and the
 * whole plan kept in the address fragment (`#plan=`). Elements are found by
 * their accessible names, never by how the board is drawn.
 */

const URL = "/fr/tools/strategy-planner";

const board = (page: Page) => page.getByRole("group", { name: /carte du plan/i });
const layla = (page: Page) => board(page).getByRole("button", { name: /^layla \([ée]quipe bleue\)$/i });
const count = (page: Page) => page.getByText(/^\d+ [ée]l[ée]ments sur \d+$/i);

/** Adds Layla to the blue team; retried until the page is hydrated. */
async function addLayla(page: Page) {
  const palette = page.getByRole("complementary", { name: /h[ée]ros et objectifs/i });
  await palette.getByRole("searchbox", { name: /chercher un h[ée]ros/i }).fill("layla");
  const add = palette.getByRole("button", { name: /^ajouter layla \([ée]quipe bleue\)$/i });
  await expect(async () => {
    await add.click();
    await expect(layla(page)).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

async function centre(page: Page, name: RegExp) {
  const box = await board(page).getByRole("button", { name }).boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

test("a hero is placed from the panel and moved with the arrow keys", async ({ page }) => {
  await page.goto(URL);
  await addLayla(page);
  await expect(count(page)).toHaveText(/^1 /);
  // The new token is selected, and the panel button now selects it instead.
  await expect(layla(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^s[ée]lectionner layla .*d[ée]j[àa] sur la carte/i })).toBeVisible();

  await layla(page).focus();
  const before = await centre(page, /^layla /i);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowUp");
  await expect.poll(async () => (await centre(page, /^layla /i)).x).toBeGreaterThan(before.x);
  const after = await centre(page, /^layla /i);
  // Shift moves five times further than a plain arrow.
  expect(before.y - after.y).toBeGreaterThan((after.x - before.x) * 3);
});

test("an arrow is drawn on the map, undone with Ctrl+Z and redone with Ctrl+Y", async ({ page }) => {
  await page.goto(URL);
  await addLayla(page);

  await page.getByRole("toolbar", { name: /outils de dessin/i }).getByRole("button", { name: /^fl[èe]che$/i }).click();
  await board(page).scrollIntoViewIfNeeded();
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.4, { steps: 5 });
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.3, { steps: 5 });
  await page.mouse.up();
  const arrow = board(page).getByRole("button", { name: /^fl[èe]che, couleur or$/i });
  await expect(arrow).toHaveCount(1);
  await expect(count(page)).toHaveText(/^2 /);

  // The shortcuts listen on the planner: focus a button inside it first.
  await page.getByRole("button", { name: /^annuler$/i }).focus();
  await page.keyboard.press("Control+z");
  await expect(arrow).toHaveCount(0);
  await expect(layla(page)).toBeVisible();
  await expect(page.getByRole("button", { name: /^r[ée]tablir$/i })).toBeEnabled();

  await page.keyboard.press("Control+y");
  await expect(arrow).toHaveCount(1);

  // The buttons do the same as the shortcuts.
  await page.getByRole("button", { name: /^annuler$/i }).click();
  await page.getByRole("button", { name: /^annuler$/i }).click();
  await expect(count(page)).toHaveText(/^0 /);
  await expect(page.getByRole("button", { name: /^annuler$/i })).toBeDisabled();
  await page.getByRole("button", { name: /^r[ée]tablir$/i }).click();
  await expect(layla(page)).toBeVisible();
});

test("the plan is kept in #plan= and comes back after a reload", async ({ page }) => {
  // Two full loads of the planner (reload, then a second page).
  test.slow();
  await page.goto(URL);
  await addLayla(page);
  await page.getByRole("button", { name: /^placer : tortue$/i }).click();
  await expect(count(page)).toHaveText(/^2 /);
  await expect(page).toHaveURL(/#plan=.+/);

  await page.reload();
  await expect(layla(page)).toBeVisible();
  await expect(board(page).getByRole("button", { name: /^tortue$/i })).toBeVisible();
  await expect(count(page)).toHaveText(/^2 /);
  await expect(page.getByRole("status").filter({ hasText: /plan partag[ée] charg[ée]/i })).toBeAttached();

  // A fresh page opened on the same address gets the same plan.
  const shared = page.url();
  const other = await page.context().newPage();
  await other.goto(shared);
  await expect(layla(other)).toBeVisible();
});

test("clear empties the map, the fragment, and can be undone", async ({ page }) => {
  await page.goto(URL);
  await addLayla(page);
  await expect(page).toHaveURL(/#plan=/);

  await page.getByRole("button", { name: /^tout effacer$/i }).click();
  await expect(layla(page)).toHaveCount(0);
  await expect(count(page)).toHaveText(/^0 /);
  await expect(page.getByRole("button", { name: /^tout effacer$/i })).toBeDisabled();
  await expect(page).not.toHaveURL(/#plan=/);

  await page.getByRole("button", { name: /^annuler$/i }).click();
  await expect(layla(page)).toBeVisible();
});
