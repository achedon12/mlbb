import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./visitor";

/**
 * The catalogues and guides, ahead of a redesign: filters and the address
 * that keeps them, sorting, pagination, the selection that opens a panel,
 * and the keyboard on the map. Roles, labels and accessible names only.
 */

const PHONE = { width: 390, height: 844 };

/** Clicks a filter chip once hydrated, until it reads as pressed. */
async function press(button: Locator) {
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass();
}

const numbers = (texts: string[]) => texts.map((text) => Number(text.match(/(\d+[.,]\d+)\s?%/)?.[1].replace(",", ".")));

test.describe("hero catalogue", () => {
  const cards = (page: Page) => page.getByRole("main").getByRole("link").filter({ has: page.getByRole("heading", { level: 3 }) });

  test("the role and lane filters narrow the list and go into the address", async ({ page }) => {
    await page.goto("/fr/heroes");
    const count = page.getByText(/^\d+ h[ée]ros( sur \d+)?$/);
    await expect(count).toHaveText(/^\d{3} h[ée]ros$/);
    const all = Number((await count.textContent())!.match(/\d+/)![0]);

    await press(page.getByRole("group", { name: /^r[ôo]le$/i }).getByRole("button", { name: /^tank$/i }));
    await expect(page).toHaveURL(/[?&]role=tank/i);
    await expect.poll(async () => Number((await count.textContent())!.match(/\d+/)![0])).toBeLessThan(all);
    for (const card of await cards(page).all()) await expect(card).toContainText(/tank/i);

    await press(page.getByRole("group", { name: /^position$/i }).getByRole("button", { name: /^roam$/i }));
    await expect(page).toHaveURL(/[?&]lane=roam/i);
    for (const card of await cards(page).all()) await expect(card).toContainText(/roam/i);

    // The address alone gives the same list back.
    const filtered = await count.textContent();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("group", { name: /^r[ôo]le$/i }).getByRole("button", { name: /^tank$/i })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: /^position$/i }).getByRole("button", { name: /^roam$/i })).toHaveAttribute("aria-pressed", "true");
    await expect(count).toHaveText(filtered!);

    // A second click on a chip drops it.
    const tank = page.getByRole("group", { name: /^r[ôo]le$/i }).getByRole("button", { name: /^tank$/i });
    await tank.click();
    await expect(tank).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/role=/);
  });

  test("the sort orders the cards by win rate", async ({ page }) => {
    await page.goto("/fr/heroes");
    await expect(cards(page).first().getByRole("heading")).toHaveText("Aamon");
    const sort = page.getByRole("group", { name: /^trier$/i });
    await expect(sort.getByRole("button", { name: "A → Z" })).toHaveAttribute("aria-pressed", "true");
    await press(sort.getByRole("button", { name: /taux de victoire/i }));
    await expect(cards(page).first().getByRole("heading")).not.toHaveText("Aamon");
    const rates = numbers(await cards(page).allInnerTexts());
    expect(rates.length).toBeGreaterThan(10);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
  });

  test("pagination leads to the next page and back", async ({ page }) => {
    await page.goto("/fr/heroes");
    const pager = page.getByRole("navigation", { name: /^pagination$/i });
    await expect(pager.getByRole("link", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    const first = await cards(page).first().getByRole("heading").textContent();
    await pager.getByRole("link", { name: /page suivante/i }).click();
    await expect(page).toHaveURL(/\/fr\/heroes\/page\/2$/);
    await expect(pager.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    await expect(cards(page).first().getByRole("heading")).not.toHaveText(first!);
    await expect(pager).toContainText(/page 2 sur \d+/i);
    await pager.getByRole("link", { name: /page pr[ée]c[ée]dente/i }).click();
    await expect(page).toHaveURL(/\/fr\/heroes(\/page\/1)?$/);
    await expect(cards(page).first().getByRole("heading")).toHaveText(first!);
  });

  test("the second page is a real address", async ({ page }) => {
    const response = await page.goto("/fr/heroes/page/2");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("navigation", { name: /^pagination$/i }).getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("statistics table", () => {
  const table = (page: Page) => page.getByRole("table", { name: /taux de victoire, de ban et de pick/i });
  const header = (page: Page, name: RegExp) => table(page).getByRole("columnheader", { name });
  const firstHero = (page: Page) => table(page).getByRole("rowheader").first().getByRole("link");

  test("a column header sorts, and a second click reverses", async ({ page }) => {
    await page.goto("/fr/statistics");
    await expect(header(page, /trier par victoire/i)).toHaveAttribute("aria-sort", "descending");
    const rates = numbers(await table(page).getByRole("cell", { name: /^\d+,\d %$/ }).allInnerTexts());
    expect(rates.length).toBeGreaterThan(0);

    const byHero = header(page, /trier par h[ée]ros/i);
    await expect(async () => {
      await byHero.getByRole("button").click();
      await expect(byHero).toHaveAttribute("aria-sort", /ascending|descending/, { timeout: 1_000 });
    }).toPass();
    await expect(header(page, /trier par victoire/i)).not.toHaveAttribute("aria-sort", /.+/);
    const order = await byHero.getAttribute("aria-sort");
    const names = async () => (await table(page).getByRole("rowheader").allInnerTexts()).map((n) => n.split("\n")[0].trim());
    const once = await names();
    expect(once).toEqual([...once].sort((a, b) => (order === "ascending" ? a.localeCompare(b, "fr") : b.localeCompare(a, "fr"))));
    await expect(page).toHaveURL(/[?&]tri=/);

    await byHero.getByRole("button").click();
    await expect(byHero).toHaveAttribute("aria-sort", order === "ascending" ? "descending" : "ascending");
    await expect(firstHero(page)).not.toHaveText(once[0]);
  });

  test("the role filter narrows the rows and survives a reload", async ({ page }) => {
    await page.goto("/fr/statistics");
    await press(page.getByRole("group", { name: /^r[ôo]le$/i }).getByRole("button", { name: /^tank$/i }));
    await expect(page).toHaveURL(/[?&]role=tank/i);
    const heroes = table(page).getByRole("rowheader");
    for (const hero of await heroes.all()) await expect(hero).toContainText(/tank/i);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("group", { name: /^r[ôo]le$/i }).getByRole("button", { name: /^tank$/i })).toHaveAttribute("aria-pressed", "true");
    for (const hero of await heroes.all()) await expect(hero).toContainText(/tank/i);
  });

  test("the search keeps one hero", async ({ page }) => {
    await page.goto("/fr/statistics");
    await page.getByRole("searchbox", { name: /rechercher un h[ée]ros/i }).fill("khufra");
    await expect(table(page).getByRole("rowheader")).toHaveCount(1);
    await expect(firstHero(page)).toContainText("Khufra");
    await expect(page).toHaveURL(/[?&]q=khufra/);
  });

  test("the rank links lead to the table of that rank", async ({ page }) => {
    await page.goto("/fr/statistics");
    await page.getByRole("navigation", { name: /^rang$/i }).getByRole("link", { name: /^mythique$/i }).click();
    await expect(page).toHaveURL(/\/fr\/statistics\/mythic/, { timeout: 20_000 });
    await expect(page.getByRole("table", { name: /mythique/i })).toBeVisible();
  });
});

test.describe("items", () => {
  test("an anchor selects the item and opens its sheet", async ({ page }) => {
    await page.goto("/fr/items#blade-of-despair");
    const item = page.getByRole("button", { name: /^blade of despair/i });
    await expect(item).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("complementary").getByRole("heading", { name: "Blade of Despair", level: 2 })).toBeVisible();

    // Choosing another item writes its anchor.
    const other = page.getByRole("button", { name: /^berserker's fury/i });
    await other.click();
    await expect(page).toHaveURL(/#berserker-s-fury$|#berserkers-fury$/);
    await expect(other).toHaveAttribute("aria-pressed", "true");
    await expect(item).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("complementary").getByRole("heading", { name: /berserker's fury/i, level: 2 })).toBeVisible();
  });

  test("the category chips and the search narrow the list", async ({ page }) => {
    await page.goto("/fr/items");
    const count = page.getByText(/^\d+ objets/).first();
    await expect(count).toHaveText(/^\d+ objets$/);
    await page.getByRole("searchbox", { name: /rechercher un objet/i }).fill("blade of despair");
    await expect(page.getByRole("button", { name: /^blade of despair/i })).toBeVisible();
    await expect(count).toContainText(/^1 objet/);
  });

  test.describe("on a phone", () => {
    test.use({ viewport: PHONE });

    test("an anchor opens the item in a drawer", async ({ page }) => {
      await page.goto("/fr/items#blade-of-despair");
      const drawer = page.getByRole("dialog", { name: /blade of despair/i });
      await expect(drawer).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await expect(page).not.toHaveURL(/#blade-of-despair/);
    });
  });
});

test.describe("skins", () => {
  test("the gallery filters by role and search, in the address", async ({ page }) => {
    await page.goto("/fr/skins");
    const gallery = page.getByRole("heading", { level: 3 });
    await expect(gallery.first()).toBeVisible();
    await press(page.getByRole("group", { name: /^r[ôo]le$/i }).getByRole("button", { name: /^tireur$/i }));
    await expect(page).toHaveURL(/[?&]role=marksman/i);
    await expect(gallery.first()).not.toHaveText(/^Aamon/);

    await page.getByRole("searchbox", { name: /rechercher un h[ée]ros/i }).fill("layla");
    await expect(gallery).toHaveCount(1);
    await expect(gallery.first()).toHaveText(/^Layla/);
    await expect(page).toHaveURL(/[?&]q=layla/);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("searchbox", { name: /rechercher un h[ée]ros/i })).toHaveValue("layla");
    await expect(gallery).toHaveCount(1);
  });

  test("the calendar explorer filters by hero and rarity, and clears", async ({ page }) => {
    await page.goto("/fr/skins/calendar");
    const results = page.getByText(/apparences? correspond/i);
    await expect(results).toHaveCount(0);
    const hero = page.getByRole("combobox", { name: /^h[ée]ros$/i });
    await expect(async () => {
      await hero.selectOption({ label: "Layla" });
      await expect(page).toHaveURL(/[?&]heros=layla/, { timeout: 1_000 });
    }).toPass();
    // The full skin list is fetched on the first filter.
    await expect(results).toHaveText(/^\d+ apparences correspondent\.$/, { timeout: 20_000 });
    const forHero = Number((await results.textContent())!.match(/\d+/)![0]);
    expect(forHero).toBeGreaterThan(1);

    await press(page.getByRole("group", { name: /^raret[ée]$/i }).getByRole("button", { name: /^deluxe$/i }));
    await expect(page).toHaveURL(/[?&]rarete=\d/);
    await expect.poll(async () => Number((await results.textContent())!.match(/\d+/)?.[0] ?? 0)).toBeLessThan(forHero);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(hero).toHaveValue(/layla/i);
    await expect(results).toBeVisible();

    await page.getByRole("button", { name: /effacer les filtres/i }).click();
    await expect(results).toHaveCount(0);
    await expect(page).toHaveURL(/\/fr\/skins\/calendar$/);
  });

  test("a month cell of the calendar leads to that month", async ({ page }) => {
    await page.goto("/fr/skins/calendar");
    const cell = page.getByRole("table", { name: /par mois et par ann[ée]e/i }).getByRole("link", { name: /^f[ée]vrier 2026, apparences : \d+/i });
    await expect(cell).toHaveAttribute("href", /2026/);
  });
});

test("the events month page names the month and leads to its neighbours", async ({ page }) => {
  await page.goto("/fr/events/2026-11");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/novembre 2026/i);
  await expect(page.getByRole("heading", { level: 2, name: /starlight/i })).toBeVisible();
  const months = page.getByRole("navigation", { name: /mois pr[ée]c[ée]dent et suivant/i });
  await expect(months.getByRole("link", { name: /tous les mois/i })).toHaveAttribute("href", /\/fr\/events$/);
  await months.getByRole("link", { name: /octobre 2026/i }).click();
  await expect(page).toHaveURL(/\/fr\/events\/2026-10$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/octobre 2026/i);
});

test("an unknown events month is a 404", async ({ page }) => {
  await page.goto("/fr/events/2026-13");
  await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
});

test.describe("lore", () => {
  test("the search narrows the stories", async ({ page }) => {
    await page.goto("/fr/lore");
    const search = page.getByRole("searchbox", { name: /chercher un h[ée]ros, une faction/i });
    await search.fill("masha");
    await expect(page.getByText(/^1 h[ée]ros trouv[ée]/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Masha/ }).last()).toHaveAttribute("href", /\/fr\/heroes\/masha#story$/);
    await search.fill("zzzzzz");
    await expect(page.getByText(/aucun/i).first()).toBeVisible();
  });

  test("a region page lists its heroes", async ({ page }) => {
    await page.goto("/fr/lore");
    await page.getByRole("link", { name: /^vall[ée]e du nord \d+ h[ée]ros$/i }).first().click();
    await expect(page).toHaveURL(/\/fr\/lore\/[a-z-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: /vall[ée]e du nord/i })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /les h[ée]ros de la r[ée]gion/i })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Masha" })).toBeVisible();
  });
});

test("the emblem guide brings the chosen role's entries up, without hiding the rest", async ({ page }) => {
  await page.goto("/fr/emblems");
  const entries = page.getByRole("main").getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) });
  const total = await entries.count();
  await expect(entries.first().getByRole("listitem").filter({ hasText: /^tank$/i })).toHaveCount(0);

  await press(page.getByRole("button", { name: /^tank$/i }).first());
  await expect(entries.first().getByRole("listitem").filter({ hasText: /^tank$/i })).toHaveCount(1);
  // Ordered, not filtered.
  await expect(entries).toHaveCount(total);
  await expect(page.getByRole("link", { name: /tank/i }).filter({ hasText: /→/ })).toHaveAttribute("href", /\/fr\/emblems\//);

  await page.getByRole("button", { name: /^tank$/i }).first().click();
  await expect(page.getByRole("button", { name: /^tank$/i }).first()).toHaveAttribute("aria-pressed", "false");
  await expect(entries.first().getByRole("listitem").filter({ hasText: /^tank$/i })).toHaveCount(0);
});

test("the map guide moves between points with the arrow keys, the card following", async ({ page }) => {
  await page.goto("/fr/map");
  const map = page.getByRole("group", { name: /carte sch[ée]matique/i });
  const turtle = map.getByRole("button", { name: "Tortue" });
  await expect(turtle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Tortue" })).toBeVisible();
  // One tab stop for the whole map.
  await expect(map.locator('[tabindex="0"]')).toHaveCount(1);

  await expect(async () => {
    await turtle.focus();
    await page.keyboard.press("ArrowRight");
    await expect(map.getByRole("button", { name: "Seigneur" })).toBeFocused({ timeout: 1_000 });
  }).toPass();
  await expect(map.getByRole("button", { name: "Seigneur" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Seigneur" })).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(turtle).toBeFocused();
  await expect(page.getByRole("region", { name: "Tortue" })).toBeVisible();
  await page.keyboard.press("ArrowUp");
  await expect(map.getByRole("button").last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(turtle).toBeFocused();

  // The list beside the map selects too.
  await page.getByRole("group", { name: /points d'int[ée]r[êe]t/i }).getByRole("button", { name: "Buff violet" }).click();
  await expect(page.getByRole("region", { name: /buff violet/i })).toBeVisible();
});
