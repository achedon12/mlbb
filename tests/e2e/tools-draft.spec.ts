import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The draft page, both modes: the assistant (who you face, then what to take)
 * and the simulator (a whole draft, here with both sides held by the player so
 * no bot or timer gets in the way). Behaviour only: roles, names, the address.
 */

/** A step of the assistant, found by its heading. */
const step = (page: Page, name: RegExp) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name, level: 2 }) });

/** Opens the hero picker of a lane field and chooses a hero from the whole roster. */
async function chooseHero(page: Page, field: Locator, name: string) {
  const picker = page.getByRole("dialog");
  // The field answers once the page is hydrated.
  await expect(async () => {
    await field.click();
    await expect(picker).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await picker.getByRole("button", { name: /^toutes$/i }).click();
  await picker.getByRole("button", { name, exact: true }).click();
  await expect(picker).toBeHidden();
}

test.describe("draft assistant", () => {
  test("enemy picks bring suggestions, your picks synergies, and clear empties both", async ({ page }) => {
    await page.goto("/fr/draft");
    await expect(page.getByRole("tab", { name: /aide [àa] la draft/i })).toHaveAttribute("aria-selected", "true");
    const enemy = step(page, /qui affrontez-vous/i);
    const yours = step(page, /votre [ée]quipe/i);
    const choose = /^choisir un h[ée]ros$/i;

    // Nothing is suggested before an opponent is known.
    await expect(page.getByRole("list", { name: /suggestions pour la lane/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /tout effacer/i })).toHaveCount(0);

    // An opponent in the first lane (Gold): every free lane gets its answers.
    await chooseHero(page, enemy.getByRole("button", { name: choose }).first(), "Khufra");
    await expect(enemy.getByRole("button", { name: /^retirer khufra$/i })).toBeVisible();
    const roam = page.getByRole("list", { name: /suggestions pour la lane roam/i });
    await expect(roam.getByRole("listitem").first()).toBeVisible();
    await expect(roam.getByRole("button", { name: /^prendre$/i }).first()).toBeVisible();
    await expect(page.getByRole("list", { name: /suggestions pour la lane/i })).not.toHaveCount(0);

    // Taking a suggestion fills your lane: its answers give way to the pick.
    const taken = (await roam.getByRole("listitem").first().getByRole("link").textContent())!.trim();
    await roam.getByRole("button", { name: /^prendre$/i }).first().click();
    await expect(yours.getByRole("button", { name: new RegExp(`^retirer ${taken}$`, "i") })).toBeVisible();
    await expect(roam).toHaveCount(0);
    await expect(enemy.getByText(new RegExp(`pourvue par ${taken}`, "i"))).toBeVisible();

    // Your own pick opens synergies in the other lanes' suggestions.
    await expect(enemy.getByText(new RegExp(`se combine avec .*${taken}`, "i")).first()).toBeVisible();

    // Clearing empties both camps and the suggestions.
    await page.getByRole("button", { name: /tout effacer/i }).click();
    await expect(enemy.getByRole("button", { name: choose })).toHaveCount(5);
    await expect(yours.getByRole("button", { name: choose })).toHaveCount(5);
    await expect(page.getByRole("list", { name: /suggestions pour la lane/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /tout effacer/i })).toHaveCount(0);
  });
});

test.describe("draft simulator", () => {
  /** Opens the simulator settings, both sides held by the player, and starts. */
  async function startBothSides(page: Page) {
    await page.goto("/fr/draft?mode=simulator");
    await expect(page.getByRole("tab", { name: /simulateur/i })).toHaveAttribute("aria-selected", "true");
    const panel = page.getByRole("tabpanel", { name: /simulateur/i });
    await expect(panel.getByRole("heading", { name: /r[ée]glages de la draft/i })).toBeVisible();
    const both = panel.getByRole("group", { name: /votre camp/i }).getByRole("button", { name: /^les deux$/i });
    await expect(async () => {
      await both.click();
      await expect(both).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass();
    await panel.getByRole("button", { name: /lancer la draft/i }).click();
    await expect(panel.getByRole("region", { name: /plateau de la draft/i })).toBeVisible();
    await expect(page).toHaveURL(/mode=simulator.*side=both/);
    return panel;
  }

  /** The board column of one side, named after the side ("Équipe bleue vous"). */
  const side = (panel: Locator, name: RegExp) =>
    panel.getByRole("region", { name: /plateau de la draft/i }).getByRole("region", { name });

  test("a ban, undo, then skipped bans, a pick and restart", async ({ page }) => {
    const panel = await startBothSides(page);
    const blue = side(panel, /^[ée]quipe bleue/i);
    const undo = panel.getByRole("button", { name: /^annuler$/i });
    await expect(undo).toBeDisabled();

    // A ban: the hero shows in the blue column and leaves the roster.
    await panel.getByRole("button", { name: /^bannir khufra$/i }).first().click();
    await expect(blue.getByText(/ban 1 : khufra/i)).toBeAttached();
    await expect(panel.getByRole("button", { name: /khufra : d[ée]j[àa] banni ou choisi/i })).toBeDisabled();
    await expect(page).toHaveURL(/draft=khufra/);

    // Undo takes it back.
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(blue.getByText(/ban 1 : khufra/i)).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /^bannir khufra$/i }).first()).toBeEnabled();
    await expect(page).not.toHaveURL(/draft=/);

    // Every ban left empty, then the first pick.
    const skip = panel.getByRole("button", { name: /laisser ce ban vide/i });
    while (await skip.isVisible()) await skip.click();
    await panel.getByRole("button", { name: /^choisir layla$/i }).first().click();
    await expect(blue.getByText(/pick 1 : layla/i)).toBeAttached();
    await expect(page).toHaveURL(/draft=(_,)+layla/);

    // Restart: a fresh draft, back to the first ban.
    await panel.getByRole("button", { name: /^recommencer$/i }).click();
    await expect(blue.getByText(/pick 1 : layla/i)).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /laisser ce ban vide/i })).toBeVisible();
    await expect(undo).toBeDisabled();
    await expect(page).not.toHaveURL(/draft=/);
  });

  test("a finished draft shows its summary, and its copied link reopens it", async ({ page, context }) => {
    // Ten picks, a summary, then a second page: slow on a busy dev server.
    test.slow();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const panel = await startBothSides(page);

    const skip = panel.getByRole("button", { name: /laisser ce ban vide/i });
    while (await skip.isVisible()) await skip.click();
    // Ten picks, each the first hero still free in the roster.
    const free = panel.getByRole("button", { name: /^choisir /i });
    const summary = panel.getByRole("heading", { name: /bilan de la draft/i });
    for (let i = 0; i < 10; i++) await free.first().click();
    await expect(summary).toBeVisible();
    await expect(panel.getByText(/draft termin[ée]e/i).first()).toBeVisible();

    const address = panel.getByRole("textbox", { name: /adresse de la draft/i });
    await expect(address).toHaveValue(/\/fr\/draft\?mode=simulator.*draft=/);
    const link = await address.inputValue();
    await panel.getByRole("button", { name: /copier le lien/i }).click();
    await expect(panel.getByRole("status").filter({ hasText: /lien copi[ée]/i })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);

    // The link opens straight on the same summary.
    const other = await context.newPage();
    await other.goto(link);
    await expect(other.getByRole("heading", { name: /bilan de la draft/i })).toBeVisible();
    await expect(other.getByRole("textbox", { name: /adresse de la draft/i })).toHaveValue(link);
  });
});
