import { expect, test, type Page } from "@playwright/test";

/**
 * Feature journeys: each test starts from a fresh page and targets a behavior,
 * not a rendering. French labels are matched with or without accents, as the
 * message catalogs evolve in parallel.
 */

const PHONE = { width: 390, height: 844 };

/** The "Rang" filter group of a hero page (fieldset + legend). */
const pickerRank = (page: Page) => page.getByRole("group", { name: /^rang$/i });

test.describe("hero page", () => {
  test("the rank selector is unique and toggles on click", async ({ page }) => {
    await page.goto("/fr/heroes/khufra");
    await expect(pickerRank(page)).toHaveCount(1);

    const group = pickerRank(page);
    const all = group.getByRole("button", { name: /^tous rangs$/i });
    const mythic = group.getByRole("button", { name: /^mythique$/i });
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(mythic).toHaveAttribute("aria-pressed", "false");

    await mythic.click();
    await expect(mythic).toHaveAttribute("aria-pressed", "true");
    await expect(all).toHaveAttribute("aria-pressed", "false");
    await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
    // Switching tabs does not bring up a second selector.
    await page.getByRole("tab", { name: /builds/i }).click();
    await expect(pickerRank(page)).toHaveCount(1);
  });

  test("the Builds tab shows played builds", async ({ page }) => {
    await page.goto("/fr/heroes/khufra");
    await page.getByRole("tab", { name: /builds/i }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByRole("heading", { name: /builds les plus jou[ée]s/i })).toBeVisible();
    // Each build lists its key items, with their image.
    const build = panel.getByRole("listitem").filter({ hasText: /build 1/i }).first();
    await expect(build).toBeVisible();
    await expect(build.locator("img").first()).toBeVisible();
  });

  test("the Stats tab shows adjustments per patch", async ({ page }) => {
    await page.goto("/fr/heroes/khufra");
    const tab = page.getByRole("tab", { name: /^stats$/i });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: /ajustements par patch/i })).toBeVisible();
  });
});

test.describe("on mobile", () => {
  test.use({ viewport: PHONE });

  test("an item opens in a drawer that closes again", async ({ page }) => {
    await page.goto("/fr/items");
    await page.getByRole("button", { name: /^war axe/i }).click();

    const drawer = page.getByRole("dialog", { name: /war axe/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: /war axe/i })).toBeVisible();
    // Item found in played builds: the sheet lists the heroes who take it.
    await expect(drawer.getByText(/utilis[ée] par/i)).toBeVisible();
    await expect(drawer.getByRole("link").first()).toHaveAttribute("href", /\/heroes\//);

    await drawer.getByRole("button", { name: /fermer/i }).click();
    await expect(drawer).toBeHidden();
  });

  test("a skill opens in a drawer", async ({ page }) => {
    await page.goto("/fr/heroes/belerick");
    await page.getByRole("tab", { name: /comp[ée]tences/i }).click();
    const tiles = page.getByRole("tabpanel").getByRole("button", { expanded: false });
    await tiles.first().click();

    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { level: 3 })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });
});

test("the draft offers the full roster, filters and suggests", async ({ page }) => {
  await page.goto("/fr/draft");
  const enemy = page.locator("section").filter({
    has: page.getByRole("heading", { name: /[ée]quipe adverse/i }),
  });
  await enemy.getByRole("button", { name: /choisir un h[ée]ros/i }).first().click();

  const picker = page.getByRole("dialog");
  await expect(picker).toBeVisible();
  const heroCountLabel = picker.getByText(/^\d+ h[ée]ros$/i);
  const heroCount = async () => Number((await heroCountLabel.textContent())?.match(/\d+/)?.[0]);

  // Opens on a lane; "Toutes" widens to the whole roster.
  const onLane = await heroCount();
  await picker.getByRole("button", { name: /^toutes$/i }).click();
  await expect(picker.getByRole("button", { name: /^toutes$/i })).toHaveAttribute("aria-pressed", "true");
  const all = await heroCount();
  expect(all).toBeGreaterThan(100);
  expect(all).toBeGreaterThan(onLane);

  // The role filter narrows the list.
  await picker.getByRole("button", { name: /^tank$/i }).click();
  await expect.poll(heroCount).toBeLessThan(all);
  await expect.poll(heroCount).toBeGreaterThan(0);

  // Picking an opponent brings up suggestions.
  await picker.getByRole("button", { name: "Khufra" }).click();
  await expect(picker).toBeHidden();
  await expect(enemy.getByText("Khufra")).toBeVisible();
  await expect(page.getByRole("button", { name: /^prendre$/i }).first()).toBeVisible();
});

test("the comparator filters the hero list as you type", async ({ page }) => {
  await page.goto("/fr/compare");
  const field = page.getByRole("combobox", { name: /premier h[ée]ros/i });
  await field.click();
  const list = page.getByRole("listbox", { name: /premier h[ée]ros/i });
  await expect(list).toBeVisible();
  const before = await list.getByRole("option").count();
  expect(before).toBeGreaterThan(100);

  await field.fill("khuf");
  await expect(list.getByRole("option")).toHaveCount(1);
  await expect(list.getByRole("option")).toHaveText(/khufra/i);
  await field.press("Enter");
  await expect(list).toBeHidden();
  await expect(field).toHaveValue("Khufra");
  await expect(page).toHaveURL(/a=khufra/);
});

test.describe("tier list by rank", () => {
  test("leads to the Mythic rank page", async ({ page }) => {
    await page.goto("/fr/tier-list");
    const nav = page.getByRole("navigation", { name: /par rang/i });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: /^mythique$/i }).click();
    // In development, the rank page compiles on first navigation: under the
    // load of several workers, that exceeds the default timeout.
    await expect(page).toHaveURL(/\/fr\/tier-list\/mythic$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/mythique/i);
    await expect(
      page.getByRole("navigation", { name: /par rang/i }).getByRole("link", { name: /^mythique$/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("an unknown rank leads to the 404 page", async ({ page }) => {
    const response = await page.goto("/fr/tier-list/foo");
    expect(response?.status()).toBe(404);
  });
});

test.describe("global search", () => {
  test("Ctrl+K opens search and Enter opens the result", async ({ page }) => {
    await page.goto("/fr");
    // The shortcut is only listened to once the page is hydrated.
    const button = page.getByRole("banner").getByRole("button", { name: /^rechercher$/i });
    await expect(button).toBeVisible();
    const dialog = page.getByRole("dialog", { name: /rechercher/i });
    await expect(async () => {
      await page.keyboard.press("Control+K");
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass();

    const field = dialog.getByRole("combobox");
    await field.fill("khuf");
    await expect(dialog.getByRole("option", { name: /khufra/i }).first()).toBeVisible();
    await field.press("Enter");
    await expect(page).toHaveURL(/\/fr\/heroes\/khufra$/);
    await expect(page.getByRole("heading", { name: "Khufra", level: 1 })).toBeVisible();
  });

  test("the header button opens search", async ({ page }) => {
    await page.goto("/fr/heroes");
    const dialog = page.getByRole("dialog", { name: /rechercher/i });
    await expect(async () => {
      await page.getByRole("banner").getByRole("button", { name: /^rechercher$/i }).click();
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expect(dialog.getByRole("combobox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test("a hero page's share image is a PNG", async ({ request }) => {
  const response = await request.get("/fr/heroes/khufra/opengraph-image");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});

test("the PWA manifest declares a maskable icon", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const { icons } = (await manifest.json()) as {
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(icons).toContainEqual(expect.objectContaining({ sizes: "512x512", purpose: "maskable" }));

  const icon = await request.get("/icons/icon-192.png");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/png");
});
