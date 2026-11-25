import type { Page } from "@playwright/test";
import { expect, test } from "./visitor";

/**
 * The hero page, feature by feature, ahead of a redesign: every tab and its
 * anchor, what each tab lets you do, the favourite and its bell, the
 * sub-pages, the error report and the sources. Only roles, labels and
 * accessible names: no class, no layout.
 */

const tabs = (page: Page) => page.getByRole("tablist", { name: /sections de la fiche/i });
const tab = (page: Page, name: RegExp) => tabs(page).getByRole("tab", { name });
const openPanel = (page: Page) => page.getByRole("tabpanel").filter({ visible: true });

/** Clicks a tab once hydrated (a click before that changes nothing). */
async function openTab(page: Page, name: RegExp) {
  await expect(async () => {
    await tab(page, name).click();
    await expect(tab(page, name)).toHaveAttribute("aria-selected", "true", { timeout: 1_000 });
  }).toPass();
}

test.describe("tabs", () => {
  const TABS: [RegExp, string][] = [
    [/^analyse/i, "analysis"],
    [/^histoire/i, "story"],
    [/^comp[ée]tences/i, "skills"],
    [/^contres/i, "counters"],
    [/^builds/i, "builds"],
    [/^stats/i, "stats"],
    [/^apparences/i, "skins"],
  ];

  test("each tab opens its panel and writes its anchor", async ({ page }) => {
    await page.goto("/fr/heroes/masha");
    await expect(tab(page, /^analyse/i)).toHaveAttribute("aria-selected", "true");
    for (const [name, id] of TABS) {
      await openTab(page, name);
      await expect(page).toHaveURL(new RegExp(`/fr/heroes/masha#${id}$`));
      await expect(openPanel(page)).toHaveCount(1);
      await expect(tabs(page).getByRole("tab", { selected: true })).toHaveCount(1);
    }
  });

  test("an anchor opens its tab on arrival, and after a reload", async ({ page }) => {
    await page.goto("/fr/heroes/masha#counters");
    await expect(tab(page, /^contres/i)).toHaveAttribute("aria-selected", "true");
    await openTab(page, /^builds/i);
    await page.reload();
    await expect(tab(page, /^builds/i)).toHaveAttribute("aria-selected", "true");
    await expect(openPanel(page).getByRole("heading", { name: /builds les plus jou[ée]s/i })).toBeVisible();
  });

  test("an anchor from before the rename still opens its tab", async ({ page }) => {
    await page.goto("/fr/heroes/masha#histoire");
    await expect(tab(page, /^histoire/i)).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/#story$/);
  });

  test("the arrow keys move between tabs", async ({ page }) => {
    await page.goto("/fr/heroes/masha");
    await openTab(page, /^analyse/i);
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, /^histoire/i)).toBeFocused();
    await expect(tab(page, /^histoire/i)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tab(page, /^apparences/i)).toHaveAttribute("aria-selected", "true");
  });
});

test("the analysis tab shows the written analysis, strengths and weaknesses", async ({ page }) => {
  await page.goto("/fr/heroes/tigreal");
  const panel = openPanel(page);
  await expect(panel).toContainText("Tigreal fait une chose");
  await expect(panel.getByRole("heading", { name: /forces/i })).toBeVisible();
  await expect(panel.getByRole("heading", { name: /faiblesses/i })).toBeVisible();
});

test("without a written analysis, the tab opens on the measured essentials", async ({ page }) => {
  await page.goto("/fr/heroes/hirara");
  const panel = openPanel(page);
  await expect(panel.getByRole("heading", { name: /^l'essentiel$/i })).toBeVisible();
  await expect(panel).toContainText(/contré par/i);
  await expect(panel).not.toContainText(/pas encore d'analyse écrite/i);
  // The missing analysis is a footnote with its way to help, not the title.
  await expect(panel.getByRole("link", { name: /contribuer/i })).toHaveAttribute("href", /\/contribute$/);
});

test("the story tab shows the hand-written French text", async ({ page }) => {
  await page.goto("/fr/heroes/masha#story");
  const panel = openPanel(page);
  // The French override of the wiki's tagline, not its translation.
  await expect(panel.getByText("Gardienne des Direbears.")).toBeVisible();
  await expect(panel.getByRole("heading", { name: /le r[ée]cit/i })).toBeVisible();
  await expect(panel.getByRole("complementary").getByRole("heading", { name: "Masha" })).toBeVisible();
});

test("a skill tile opens its detail", async ({ page }) => {
  await page.goto("/fr/heroes/masha#skills");
  const panel = openPanel(page);
  const tile = panel.getByRole("button", { name: /claw strike/i });
  await expect(tile).toHaveAttribute("aria-expanded", "false");
  await expect(async () => {
    await tile.click();
    await expect(tile).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
  }).toPass();
  const detail = page.locator(`[id="${await tile.getAttribute("aria-controls")}"]`);
  await expect(detail.getByRole("heading", { name: "Claw Strike" })).toBeVisible();
  // One skill open at a time.
  await expect(panel.getByRole("button", { expanded: true })).toHaveCount(1);
  await panel.getByRole("button", { name: /savage maul/i }).click();
  await expect(panel.getByRole("button", { name: /savage maul/i })).toHaveAttribute("aria-expanded", "true");
  await expect(tile).toHaveAttribute("aria-expanded", "false");
});

test("the counters tab lists measured counters and leads to the full page", async ({ page }) => {
  await page.goto("/fr/heroes/masha#counters");
  const panel = openPanel(page);
  await expect(panel.getByRole("heading", { name: /^fort contre$/i })).toBeVisible();
  await expect(panel.getByRole("heading", { name: /^en difficult[ée] contre$/i })).toBeVisible();
  await expect(panel.getByRole("link", { name: /[+-]\d+\.\d pts/ }).first()).toHaveAttribute("href", /\/fr\/heroes\//);
  await panel.getByRole("link", { name: /page compl[èe]te des contres/i }).click();
  await expect(page).toHaveURL(/\/fr\/heroes\/masha\/counters$/);
});

test("the builds tab switches lane for a hero played in two", async ({ page }) => {
  await page.goto("/fr/heroes/chou#builds");
  const panel = openPanel(page);
  const lanes = panel.getByRole("group", { name: /^position$/i });
  const exp = lanes.getByRole("button", { name: /^exp$/i });
  const roam = lanes.getByRole("button", { name: /^roam$/i });
  await expect(exp).toHaveAttribute("aria-pressed", "true");
  const firstBuild = panel.getByRole("listitem").filter({ hasText: /build 1/i }).first();
  const before = await firstBuild.innerText();
  await expect(async () => {
    await roam.click();
    await expect(roam).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass();
  await expect(exp).toHaveAttribute("aria-pressed", "false");
  await expect(firstBuild).not.toHaveText(before);
});

test("the stats tab switches the measured rate and the period", async ({ page }) => {
  await page.goto("/fr/heroes/masha#stats");
  const panel = openPanel(page);
  const chart = panel.getByRole("img", { name: /^taux de /i }).first();
  await expect(chart).toHaveAccessibleName(/^taux de victoire/i);

  const rate = panel.getByRole("group", { name: /^taux$/i });
  await rate.getByRole("button", { name: /^ban$/i }).click();
  await expect(rate.getByRole("button", { name: /^ban$/i })).toHaveAttribute("aria-pressed", "true");
  await expect(chart).toHaveAccessibleName(/^taux de ban/i);

  const period = panel.getByRole("group", { name: /^p[ée]riode$/i });
  await expect(period.getByRole("button", { name: /^30 j$/i })).toHaveAttribute("aria-pressed", "true");
  const thirty = await chart.getAttribute("aria-label");
  await period.getByRole("button", { name: /^7 j$/i }).click();
  await expect(period.getByRole("button", { name: /^7 j$/i })).toHaveAttribute("aria-pressed", "true");
  await expect(chart).not.toHaveAccessibleName(thirty!);
  await expect(panel).not.toContainText(/NaN/);
});

test("choosing a skin in the showcase changes the header portrait", async ({ page }) => {
  await page.goto("/fr/heroes/masha#skins");
  const panel = openPanel(page);
  const portrait = page.getByRole("img", { name: /^Masha — / });
  await expect(portrait).toHaveAccessibleName("Masha — Wild-oats Fist");
  const skin = panel.getByRole("button", { name: "Winter Guard" });
  await expect(async () => {
    await skin.click();
    await expect(skin).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass();
  await expect(panel.getByRole("heading", { name: "Winter Guard", level: 3 })).toBeVisible();
  await expect(portrait).toHaveAccessibleName("Masha — Winter Guard");
  await expect(panel.getByRole("button", { name: "Wild-oats Fist" })).toHaveAttribute("aria-pressed", "false");
});

test.describe("favourite", () => {
  const favourite = (page: Page) => page.getByRole("button", { name: /ajouter aux favoris|dans mes favoris/i });
  const bell = (page: Page) => page.getByRole("button", { name: /me pr[ée]venir quand mes favoris changent/i });

  test("toggles, and is kept after a reload", async ({ page }) => {
    await page.goto("/fr/heroes/masha");
    await expect(favourite(page)).toHaveAttribute("aria-pressed", "false");
    await expect(async () => {
      await favourite(page).click();
      await expect(favourite(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass();
    await expect(favourite(page)).toHaveText(/dans mes favoris/i);
    expect(await page.evaluate(() => localStorage.getItem("mlbb_favoris"))).toContain("masha");

    await page.reload();
    await expect(favourite(page)).toHaveAttribute("aria-pressed", "true");
    await favourite(page).click();
    await expect(favourite(page)).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect(favourite(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("without push configured, no bell is offered", async ({ page }) => {
    await page.route("**/api/push", (route) => route.fulfill({ json: { key: null } }));
    await page.addInitScript(() => localStorage.setItem("mlbb_favoris", JSON.stringify(["masha"])));
    await page.goto("/fr/heroes/masha");
    await expect(favourite(page)).toHaveAttribute("aria-pressed", "true");
    await page.waitForLoadState("networkidle");
    await expect(bell(page)).toHaveCount(0);
  });

  test("with push configured, a favourite gets its bell", async ({ page }) => {
    // Any public key will do: the bell only asks for one before showing.
    await page.route("**/api/push", (route) => route.fulfill({ json: { key: "BTestPublicKeyOnlyUsedToShowTheBell" } }));
    await page.goto("/fr/heroes/masha");
    await expect(bell(page)).toHaveCount(0);
    await expect(async () => {
      await favourite(page).click();
      await expect(favourite(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass();
    await expect(bell(page)).toBeVisible();
    await expect(bell(page)).toHaveAttribute("aria-pressed", "false");
    await favourite(page).click();
    await expect(bell(page)).toHaveCount(0);
  });
});

test.describe("sub-pages", () => {
  test("the counters page lists counters, by rank", async ({ page }) => {
    await page.goto("/fr/heroes/masha/counters");
    await expect(page.getByRole("heading", { level: 1, name: /contres de masha/i })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /les meilleurs contres de masha/i })).toBeVisible();
    const table = page.getByRole("table").first();
    await expect(table.getByRole("row").nth(1)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /contres rang par rang/i })).toBeVisible();
  });

  test("the duos page lists partners", async ({ page }) => {
    await page.goto("/fr/heroes/masha/duos");
    await expect(page.getByRole("heading", { level: 1, name: /meilleurs duos avec masha/i })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /meilleurs partenaires pour masha/i })).toBeVisible();
    await expect(page.getByRole("table").first().getByRole("row").nth(1)).toBeVisible();
  });

  test("the skins page shows every skin", async ({ page }) => {
    await page.goto("/fr/heroes/masha/skins");
    await expect(page.getByRole("heading", { level: 1, name: /apparences de masha/i })).toBeVisible();
    for (const name of ["Wild-oats Fist", "Winter Guard", "Mai Shiranui"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
  });
});

test.describe("report an error", () => {
  const open = (page: Page) => page.getByRole("button", { name: /signaler une erreur/i });

  test("without a database, the report button is not offered", async ({ page }) => {
    await page.route("**/api/data-reports", (route) => route.fulfill({ json: { open: false } }));
    await page.goto("/fr/heroes/masha");
    await page.waitForLoadState("networkidle");
    await expect(open(page)).toHaveCount(0);
  });

  test("opens, checks its fields, then sends", async ({ page }) => {
    const posted: Record<string, unknown>[] = [];
    await page.route("**/api/data-reports", (route) => {
      const request = route.request();
      if (request.method() === "GET") return route.fulfill({ json: { open: true } });
      posted.push(request.postDataJSON());
      return route.fulfill({ status: 201, json: { ok: true } });
    });
    await page.goto("/fr/heroes/masha");
    await expect(open(page)).toHaveAttribute("aria-expanded", "false");
    await open(page).click();
    await expect(open(page)).toHaveAttribute("aria-expanded", "true");

    const text = page.getByRole("textbox", { name: /ce qui est faux/i });
    await expect(text).toBeVisible();
    const send = page.getByRole("button", { name: /envoyer le signalement/i });

    // An empty description does not even leave the browser.
    await send.click();
    expect(await text.evaluate((field: HTMLTextAreaElement) => field.validity.valid)).toBe(false);
    expect(posted).toEqual([]);

    // A source that is not an address is refused by the browser too.
    await text.fill("Le taux de victoire affiché est faux.");
    const source = page.getByRole("textbox", { name: /une source/i });
    await source.fill("pas une adresse");
    await send.click();
    expect(await source.evaluate((field: HTMLInputElement) => field.validity.valid)).toBe(false);
    expect(posted).toEqual([]);

    await source.fill("https://example.com/source");
    await page.getByRole("textbox", { name: /la bonne valeur/i }).fill("57,9 %");
    await send.click();
    await expect(page.getByRole("status").filter({ hasText: /merci/i })).toBeVisible();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      path: "/heroes/masha",
      locale: "fr",
      text: "Le taux de victoire affiché est faux.",
      correction: "57,9 %",
      source: "https://example.com/source",
    });
    expect(posted[0]).not.toHaveProperty("website");
  });

  test("shows the server's refusal", async ({ page }) => {
    await page.route("**/api/data-reports", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: { open: true } })
        : route.fulfill({ status: 422, json: { error: "links" } }),
    );
    await page.goto("/fr/heroes/masha");
    await open(page).click();
    await page.getByRole("textbox", { name: /ce qui est faux/i }).fill("Voir www.example.com pour la bonne valeur.");
    await page.getByRole("button", { name: /envoyer le signalement/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /pas de lien/i })).toBeVisible();
    // Cancel closes the form.
    await page.getByRole("button", { name: /^annuler$/i }).click();
    await expect(page.getByRole("textbox", { name: /ce qui est faux/i })).toBeHidden();
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /** A section's own header, a button that folds it. */
  const header = (page: Page, name: RegExp) =>
    page.getByRole("heading", { level: 2, name }).first().getByRole("button");
  const chips = (page: Page) => page.getByRole("navigation", { name: /aller [àa] une section/i });

  test("the sections are stacked, the first ones open, the others folded", async ({ page }) => {
    await page.goto("/fr/heroes/masha");
    await expect(tabs(page)).toBeHidden();
    await expect(header(page, /^analyse/i)).toHaveAttribute("aria-expanded", "true");
    await expect(header(page, /^comp[ée]tences/i)).toHaveAttribute("aria-expanded", "true");
    await expect(header(page, /^builds/i)).toHaveAttribute("aria-expanded", "false");
    await expect(header(page, /^apparences/i)).toHaveAttribute("aria-expanded", "false");
    // A folded section keeps its text in the page.
    const builds = page.locator(`[id="${await header(page, /^builds/i).getAttribute("aria-controls")}"]`);
    await expect(builds).toBeHidden();
    await expect(builds).toContainText(/build/i);

    await expect(async () => {
      await header(page, /^builds/i).click();
      await expect(header(page, /^builds/i)).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass();
    await expect(builds.getByRole("heading", { name: /builds les plus jou[ée]s/i })).toBeVisible();
    await header(page, /^builds/i).click();
    await expect(header(page, /^builds/i)).toHaveAttribute("aria-expanded", "false");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });

  test("the chip row opens a folded section and marks it", async ({ page }) => {
    await page.goto("/fr/heroes/masha");
    const stats = chips(page).getByRole("button", { name: /^stats$/i });
    await expect(async () => {
      await stats.click();
      await expect(header(page, /^stats$/i)).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass();
    await expect(page).toHaveURL(/#stats$/);
    await expect(stats).toHaveAttribute("aria-current", "true");
    await expect(chips(page)).toBeInViewport();
  });

  test("an anchor unfolds its section on arrival", async ({ page }) => {
    await page.goto("/fr/heroes/masha#counters");
    await expect(header(page, /^contres/i)).toHaveAttribute("aria-expanded", "true");
  });

  test("the summary under the poster leads to the builds", async ({ page }) => {
    await page.goto("/fr/heroes/masha");
    const glance = page.getByRole("region", { name: /^en bref$/i });
    await expect(glance).toBeVisible();
    await expect(glance).toContainText(/victoire/i);
    await expect(async () => {
      await glance.getByRole("link", { name: /^builds/i }).last().click();
      await expect(header(page, /^builds/i)).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass();
    await expect(page).toHaveURL(/#builds$/);
  });
});

test("the sources block names the wikis and the data dates", async ({ page }) => {
  await page.goto("/fr/heroes/masha");
  const sources = page.getByRole("complementary", { name: /^sources$/i });
  await expect(sources).toBeVisible();
  await expect(sources.getByRole("link", { name: /mlbb wiki/i })).toHaveAttribute("href", /fandom\.com/);
  await expect(sources.getByRole("link", { name: "Masha" }).first()).toHaveAttribute("href", /\/wiki\/Masha$/);
  await expect(sources.locator("time").first()).toHaveAttribute("datetime", /\d{4}-\d{2}-\d{2}/);
});
