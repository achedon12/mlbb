import { expect, test, type Page } from "@playwright/test";

/**
 * Tier list maker: placing heroes with the keyboard, editing the rows,
 * prefilling from our tier list, sharing by link, the browser save and the
 * confirmed reset. Everything is reached by role and accessible name, so the
 * journeys survive a redesign.
 */

const URL_TOOL = "/fr/tools/tier-list-maker";
const KEY_LIST = "mlbb_tier_liste";

/** Row n (1-based) of the list, named "Rangée n, <name> : k héros". */
const row = (page: Page, n: number) => page.getByRole("list", { name: new RegExp(`^rang[ée]e ${n},`, "i") });
const bench = (page: Page) => page.getByRole("list", { name: /^r[ée]serve$/i });
const hero = (scope: ReturnType<Page["getByRole"]>, name: string) =>
  scope.getByRole("button", { name, exact: true });

/** Opens the tool and waits until it is hydrated: the list is then saved in the browser. */
async function open(page: Page, url = URL_TOOL) {
  await page.goto(url);
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), KEY_LIST)).not.toBeNull();
}

/** Narrows the bench to one hero, so its tile is easy to reach. */
async function find(page: Page, name: string) {
  await page.getByRole("searchbox", { name: /rechercher un h[ée]ros/i }).fill(name);
  const tile = hero(bench(page), name);
  await expect(tile).toBeVisible();
  return tile;
}

test("the keyboard selects a hero, drops it in a row with a digit and sends it back with 0", async ({ page }) => {
  await open(page);
  const miya = await find(page, "Miya");
  await miya.focus();

  // Enter selects: the hero is pressed and the bar to place it appears.
  await page.keyboard.press("Enter");
  await expect(miya).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: /^placer miya$/i })).toBeVisible();

  // A digit drops it into the matching row, and focus follows it.
  await page.keyboard.press("2");
  await expect(row(page, 2)).toHaveAccessibleName(/^rang[ée]e 2, S : 1 h[ée]ros$/i);
  const placed = hero(row(page, 2), "Miya");
  await expect(placed).toBeFocused();
  await expect(hero(bench(page), "Miya")).toHaveCount(0);
  await expect(page.getByRole("region", { name: /^placer miya$/i })).toBeHidden();

  // Another digit moves it from row to row.
  await page.keyboard.press("4");
  await expect(hero(row(page, 4), "Miya")).toBeFocused();
  await expect(row(page, 2)).toHaveAccessibleName(/: 0 h[ée]ros$/i);

  // 0 sends it back to the bench.
  await page.keyboard.press("0");
  await expect(row(page, 4)).toHaveAccessibleName(/: 0 h[ée]ros$/i);
  await expect(hero(bench(page), "Miya")).toBeFocused();
});

test("a row is renamed, another is added, named and removed", async ({ page }) => {
  await open(page);

  await page.getByRole("button", { name: /^r[ée]glages de la rang[ée]e S\+$/i }).click();
  const name = page.getByRole("textbox", { name: /^nom$/i });
  await expect(name).toBeFocused();
  await name.fill("Dieux");
  await expect(row(page, 1)).toHaveAccessibleName(/^rang[ée]e 1, Dieux :/i);
  await page.getByRole("button", { name: /^fermer$/i }).click();
  await expect(name).toBeHidden();

  // A new row lands at the bottom, its settings open on the name.
  await expect(row(page, 7)).toHaveCount(0);
  await page.getByRole("button", { name: /^ajouter une rang[ée]e$/i }).click();
  await expect(row(page, 7)).toHaveAccessibleName(/^rang[ée]e 7, Nouvelle :/i);
  await expect(name).toBeFocused();
  await name.fill("Poubelle");
  await expect(row(page, 7)).toHaveAccessibleName(/^rang[ée]e 7, Poubelle : 0 h[ée]ros$/i);

  // A hero can go straight into it.
  const miya = await find(page, "Miya");
  await miya.focus();
  await page.keyboard.press("7");
  await expect(hero(row(page, 7), "Miya")).toBeVisible();

  // Its settings are still open: removing it sends its heroes back to the bench.
  await expect(page.getByRole("button", { name: /^r[ée]glages de la rang[ée]e Poubelle$/i })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.getByRole("button", { name: /^supprimer la rang[ée]e Poubelle$/i }).click();
  await expect(row(page, 7)).toHaveCount(0);
  await expect(hero(bench(page), "Miya")).toBeVisible();
});

test("our tier list prefills the rows for the chosen rank", async ({ page }) => {
  await open(page);
  await page.getByText(/^partir de notre tier list$/i).click();
  const ranks = page.getByRole("group", { name: /^rang$/i });
  await ranks.getByRole("button", { name: /^mythique$/i }).click();
  await page.getByRole("button", { name: /^charger la tier list mythique$/i }).click();

  await expect(page.getByRole("textbox", { name: /titre de la liste/i })).toHaveValue(/mythique/i);
  // Heroes now sit in the rows: S+ holds some, the bench lost them.
  await expect(row(page, 1)).not.toHaveAccessibleName(/: 0 h[ée]ros$/i);
  expect(await row(page, 1).getByRole("button").count()).toBeGreaterThan(0);
  const count = page.getByText(/^\d+ h[ée]ros sur \d+ [àa] placer$/i);
  const [left, total] = ((await count.textContent()) ?? "").match(/\d+/g)!.map(Number);
  expect(left).toBeLessThan(total);
});

test.describe("sharing by link", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("the copied link opens the same list elsewhere, the visitor's own list kept aside", async ({ page, browser, baseURL }) => {
    // Two browsers, each loading the tool: longer than the default budget under load.
    test.slow();
    await open(page);
    await page.getByRole("textbox", { name: /titre de la liste/i }).fill("Ma liste partagée");
    const miya = await find(page, "Miya");
    await miya.focus();
    await page.keyboard.press("1");
    await expect(hero(row(page, 1), "Miya")).toBeVisible();

    await page.getByRole("button", { name: /^partager le lien$/i }).click();
    await expect(page.getByText(/lien copi[ée]/i)).toBeVisible();
    const link = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    expect(link.pathname).toBe(URL_TOOL);
    expect(link.searchParams.get("l")).toBeTruthy();

    // Another browser, which already holds a list of its own.
    const other = await browser.newContext({ baseURL });
    const visitor = await other.newPage();
    await open(visitor);
    const layla = await find(visitor, "Layla");
    await layla.focus();
    await visitor.keyboard.press("3");
    await expect(hero(row(visitor, 3), "Layla")).toBeVisible();

    await visitor.goto(`${link.pathname}${link.search}`);
    await expect(visitor.getByRole("textbox", { name: /titre de la liste/i })).toHaveValue("Ma liste partagée");
    await expect(hero(row(visitor, 1), "Miya")).toBeVisible();
    await expect(row(visitor, 3)).toHaveAccessibleName(/: 0 h[ée]ros$/i);
    // The address goes back to the tool's own, so a reload keeps the edits.
    await expect(visitor).toHaveURL(new RegExp(`${URL_TOOL}$`));

    // The visitor's list comes back in one click.
    await visitor.getByRole("button", { name: /^revenir [àa] ma liste$/i }).click();
    await expect(hero(row(visitor, 3), "Layla")).toBeVisible();
    await expect(row(visitor, 1)).toHaveAccessibleName(/: 0 h[ée]ros$/i);
    await other.close();
  });
});

test("the list is kept in the browser across a reload", async ({ page }) => {
  await open(page);
  await page.getByRole("textbox", { name: /titre de la liste/i }).fill("Gardée");
  const miya = await find(page, "Miya");
  await miya.focus();
  await page.keyboard.press("2");
  await expect(hero(row(page, 2), "Miya")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: /titre de la liste/i })).toHaveValue("Gardée");
  await expect(hero(row(page, 2), "Miya")).toBeVisible();
  await expect(hero(bench(page), "Miya")).toHaveCount(0);
});

test("starting over asks first, then restores the default rows", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /^ajouter une rang[ée]e$/i }).click();
  await expect(row(page, 7)).toBeVisible();
  const miya = await find(page, "Miya");
  await miya.focus();
  await page.keyboard.press("1");
  await expect(hero(row(page, 1), "Miya")).toBeVisible();

  // Declined: nothing changes.
  page.once("dialog", (d) => {
    expect(d.type()).toBe("confirm");
    expect(d.message()).toMatch(/rang[ée]es par d[ée]faut/i);
    void d.dismiss();
  });
  await page.getByRole("button", { name: /^recommencer$/i }).click();
  await expect(hero(row(page, 1), "Miya")).toBeVisible();
  await expect(row(page, 7)).toBeVisible();

  // Accepted: six default rows, every hero back on the bench.
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: /^recommencer$/i }).click();
  await expect(row(page, 7)).toHaveCount(0);
  await expect(row(page, 1)).toHaveAccessibleName(/^rang[ée]e 1, S\+ : 0 h[ée]ros$/i);
  await expect(hero(bench(page), "Miya")).toBeVisible();
});
