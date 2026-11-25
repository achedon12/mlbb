import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./visitor";

/**
 * Account and community, signed out, ahead of a redesign. The game's login
 * cannot run in a test (the code is sent by Moonton), so only the first
 * step's checks are covered. The forum and the teammate finder need the
 * bot's database: without one (continuous integration), the pages must say
 * so; with one holding at least a thread and a card, the signed-out views
 * are covered too. Roles, labels and accessible names only.
 */

/** Whether this server has a database: the error reports open with it. */
async function hasDatabase(request: APIRequestContext): Promise<boolean> {
  const response = await request.get("/api/data-reports");
  return response.ok() && (await response.json()).open === true;
}

const unavailable = (page: Page) => page.getByRole("alert").filter({ hasText: /communaut[ée] est momentan[ée]ment indisponible/i });

test.describe("sign-in", () => {
  const playerId = (page: Page) => page.getByRole("textbox", { name: /identifiant de joueur/i });
  const server = (page: Page) => page.getByRole("textbox", { name: /^serveur$/i });
  const send = (page: Page) => page.getByRole("button", { name: /recevoir un code dans le jeu/i });
  // Next's route announcer is an alert too, which may read the page title out: left aside.
  const error = (page: Page) => page.locator("[role=alert]:not(#__next-route-announcer__)").filter({ hasText: /\S/ });

  test("the first step refuses a bad identifier or server, and keeps what was typed", async ({ page }) => {
    await page.goto("/fr/login");
    await expect(page.getByRole("heading", { level: 1, name: /connexion/i })).toBeVisible();

    // A zero is a number, but not an identifier: refused before Moonton is asked.
    await playerId(page).fill("0");
    await server(page).fill("6021");
    await expect(async () => {
      await send(page).click();
      await expect(error(page)).toHaveText(/identifiant invalide/i, { timeout: 2_000 });
    }).toPass();
    await expect(playerId(page)).toHaveValue("0");

    await playerId(page).fill("123456789");
    await server(page).fill("0");
    await send(page).click();
    await expect(error(page)).toHaveText(/serveur invalide/i);
    await expect(server(page)).toHaveValue("0");

    await playerId(page).fill("abc");
    await server(page).fill("6021");
    await send(page).click();
    await expect(error(page)).toHaveText(/saisie invalide/i);
    // Still the first step: no code field.
    await expect(page.getByRole("textbox", { name: /code de v[ée]rification/i })).toHaveCount(0);
  });

  test("the account pages lead a visitor to the sign-in", async ({ page }) => {
    await page.goto("/fr/account");
    await expect(page).toHaveURL(/\/fr\/login\?next=%2Ffr%2Faccount$/);
    await expect(playerId(page)).toBeVisible();
    await page.goto("/fr/account/profile");
    await expect(page).toHaveURL(/\/fr\/login\?next=%2Ffr%2Faccount%2Fprofile$/);
    // The former progress page now points at the account page, which asks to sign in (the section anchor follows).
    await page.goto("/fr/account/progress");
    await expect(page).toHaveURL(/\/fr\/login(\?next=%2Ffr%2Faccount)?(#progress)?$/);
  });

  test("the account pages answer a visitor with a real redirect, before any loading state", async ({ request }) => {
    for (const [path, next] of [
      ["/fr/account", "%2Ffr%2Faccount"],
      ["/fr/account/profile", "%2Ffr%2Faccount%2Fprofile"],
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(response.headers().location, path).toMatch(new RegExp(`/fr/login\\?next=${next}$`));
    }
  });

  test("the former progress page is a permanent redirect to the account page", async ({ request }) => {
    const response = await request.get("/fr/account/progress", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toMatch(/\/fr\/account#progress$/);
  });

  test("the header offers to sign in", async ({ page }) => {
    await page.goto("/fr/heroes");
    await expect(page.getByRole("banner").getByRole("link", { name: /^connexion$/i })).toHaveAttribute("href", /\/fr\/login(\?next=%2Ffr%2Fheroes)?$/);
  });
});

test.describe("community without a database", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(await hasDatabase(request), "this server has a database");
  });

  for (const path of ["/fr/community", "/fr/community/general", "/fr/community/teammates", "/fr/community/search?q=build"]) {
    test(`${path} says the community is unavailable`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(unavailable(page)).toBeVisible();
    });
  }

  test("the forum search form is still there", async ({ page }) => {
    await page.goto("/fr/community");
    const search = page.getByRole("search");
    await search.getByRole("searchbox", { name: /rechercher dans le forum/i }).fill("build");
    await search.getByRole("button", { name: /^rechercher$/i }).click();
    await expect(page).toHaveURL(/\/fr\/community\/search\?q=build/);
  });

  test("an unknown category is a 404", async ({ page }) => {
    await page.goto("/fr/community/zzz");
    await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
  });
});

test.describe("community with a database, signed out", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await hasDatabase(request)), "no database on this server");
  });

  test("the home lists the categories and the latest threads", async ({ page }) => {
    await page.goto("/fr/community");
    await expect(unavailable(page)).toHaveCount(0);
    const categories = page.getByRole("region", { name: /^cat[ée]gories$/i });
    for (const name of [/^g[ée]n[ée]ral/i, /^h[ée]ros et builds/i, /^aide en class[ée]/i, /^esport/i, /^guides de joueurs/i, /^bugs et avis/i]) {
      await expect(categories.getByRole("link", { name })).toBeVisible();
    }
    await categories.getByRole("link", { name: /^g[ée]n[ée]ral/i }).click();
    await expect(page).toHaveURL(/\/fr\/community\/general$/);
    await expect(page.getByRole("heading", { level: 1, name: /g[ée]n[ée]ral/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: /ordre des discussions/i }).getByRole("link")).toHaveCount(2);
  });

  test("a category asks a visitor to sign in before starting a thread", async ({ page, request }) => {
    await page.goto("/fr/community/general");
    await expect(page.getByText(/connectez-vous pour lancer une discussion/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /avec mon compte de jeu/i })).toHaveAttribute("href", /\/fr\/login/);
    // No composer for a visitor, and the route refuses one too.
    await expect(page.getByRole("textbox", { name: /titre/i })).toHaveCount(0);
    const refused = await request.post("/api/community/threads", {
      headers: { origin: new URL(page.url()).origin },
      data: { category: "general", title: "Hello there", body: "Some long enough body" },
    });
    expect(refused.status()).toBe(401);
  });

  test("a thread page shows its opening post, its replies, and asks to sign in to reply", async ({ page }) => {
    await page.goto("/fr/community/general");
    // A thread's address: its category, then its id and slug.
    const thread = page.getByRole("main").locator('a[href*="/community/general/"]').first();
    test.skip((await thread.count()) === 0, "no thread in this database");
    const title = (await thread.textContent())!.trim();
    await thread.click();
    await expect(page).toHaveURL(/\/fr\/community\/general\/\d+-/);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("article", { name: /message d'ouverture/i })).toBeVisible();
    const reply = page.getByRole("region", { name: /^r[ée]pondre$/i });
    await expect(reply.getByText(/connectez-vous pour r[ée]pondre/i)).toBeVisible();
    await expect(reply.getByRole("textbox")).toHaveCount(0);
    await page.getByRole("link", { name: /retour [àa] g[ée]n[ée]ral/i }).click();
    await expect(page).toHaveURL(/\/fr\/community\/general$/);
  });

  test("the teammate finder filters the cards through the address", async ({ page }) => {
    await page.goto("/fr/community/teammates");
    await expect(page.getByRole("region", { name: /votre carte/i }).getByRole("link", { name: /avec mon compte de jeu/i })).toBeVisible();
    const cards = page.getByRole("main").getByRole("article");
    const all = await cards.count();
    test.skip(all === 0, "no teammate card in this database");

    await page.getByRole("combobox", { name: /^r[ée]gion$/i }).selectOption({ label: "Europe" });
    await page.getByRole("button", { name: /^filtrer$/i }).click();
    await expect(page).toHaveURL(/[?&]region=eu/);
    await expect(page.getByRole("combobox", { name: /^r[ée]gion$/i })).toHaveValue("eu");
    for (const card of await cards.all()) await expect(card).toContainText(/europe/i);
    expect(await cards.count()).toBeLessThanOrEqual(all);
    // Contacts stay for signed-in players.
    await expect(cards.first()).toContainText(/pas de contact partag[ée]|connectez-vous/i);

    await page.getByRole("link", { name: /tout afficher/i }).click();
    await expect(page).toHaveURL(/\/fr\/community\/teammates$/);
    await expect(cards).toHaveCount(all);
  });
});

test.describe("Discord bot pages", () => {
  /** Without the bot's variables, every bot page answers 404 (docs/discord-bot.md). */
  for (const path of ["/fr/bot", "/fr/bot/terms", "/fr/bot/privacy"]) {
    test(`${path} renders or is a 404, as configured`, async ({ page, request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      const html = await response.text();
      const notFound = html.includes("data-not-found");
      if (process.env.CI && notFound) expect(response.status()).toBe(404);
      await page.goto(path);
      if (notFound) {
        await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator("[data-not-found]")).toHaveCount(0);
      }
    });
  }
});
