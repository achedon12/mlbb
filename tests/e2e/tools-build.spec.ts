import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The build and number tools: each journey goes through the visitor's
 * inputs to a computed answer, and where the tool keeps its state in the
 * address, a reload brings the same answer back. Elements are reached by
 * role and accessible name only, so the tests outlive a redesign.
 */

/** A figure as the French interface prints it ("4 448", "66,7"), as a number. */
const figure = (text: string | null) => Number((text ?? "").replace(/[\s  ]/g, "").replace(",", ".").match(/-?\d+(\.\d+)?/)?.[0]);

/** Opens a hero picker (the opener answers once hydrated) and chooses a hero. */
async function chooseHero(page: Page, opener: Locator, name: string) {
  const picker = page.getByRole("dialog");
  await expect(async () => {
    await opener.click();
    await expect(picker).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await picker.getByRole("button", { name, exact: true }).click();
  await expect(picker).toBeHidden();
}

test.describe("build simulator", () => {
  test("a hero, an item, an emblem and a spell update the stats and the address, which a reload restores", async ({ page }) => {
    await page.goto("/fr/tools/build");
    const aside = page.getByRole("complementary", { name: /statistiques calcul[ée]es/i });
    const attack = aside.getByRole("listitem").filter({ hasText: /^attaque physique/i }).first();

    await chooseHero(page, page.getByRole("button", { name: /^choisir un h[ée]ros$/i }), "Layla");
    await expect(aside).toContainText(/layla, niveau 15/i);
    await expect(page).toHaveURL(/[?&]h=layla(&|$)/);
    const bare = figure(await attack.textContent());
    expect(bare).toBeGreaterThan(0);

    // Choosing the hero moves on to the items step.
    const steps = page.getByRole("navigation", { name: /[ée]tapes du build/i });
    await expect(steps.getByRole("button", { name: /^objets$/i })).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: /^emplacement 1 : ajouter/i }).click();
    const items = page.getByRole("dialog", { name: /emplacement 1/i });
    await items.getByRole("searchbox").fill("despair");
    await items.getByRole("button", { name: /^blade of despair/i }).click();
    await expect(items).toBeHidden();
    await expect(page.getByRole("button", { name: /^emplacement 1 : blade of despair/i })).toBeVisible();
    await expect(page.getByRole("list", { name: /^1\/6 objets$/i })).toBeVisible();
    await expect.poll(async () => figure(await attack.textContent())).toBeGreaterThan(bare);
    await expect(page).toHaveURL(/[?&]i=blade-of-despair(&|$)/);

    // A second item takes the next slot.
    await page.getByRole("button", { name: /^emplacement 2 : ajouter/i }).click();
    const second = page.getByRole("dialog", { name: /emplacement 2/i });
    await second.getByRole("searchbox").fill("berserker");
    await second.getByRole("button", { name: /^berserker's fury/i }).click();
    await expect(page.getByRole("list", { name: /^2\/6 objets$/i })).toBeVisible();
    await expect(page).toHaveURL(/[?&]i=blade-of-despair,[a-z0-9-]+(&|$)/);

    // Emblem step: a set is a toggle.
    await steps.getByRole("button", { name: /^embl[èe]me et talents$/i }).click();
    const emblems = page.getByRole("group", { name: /ensemble d'embl[èe]mes/i });
    const emblem = emblems.getByRole("button").first();
    await emblem.click();
    await expect(emblem).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/[?&]e=[a-z0-9-]+/);

    // Spell step.
    await page.getByRole("button", { name: /^[ée]tape suivante$/i }).click();
    const spellStep = page.getByRole("region", { name: /sort de combat/i });
    const spell = spellStep.getByRole("button", { pressed: false }).first();
    const spellName = (await spell.textContent())!.trim();
    await spell.click();
    await expect(spellStep.getByRole("button", { name: spellName })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/[?&]s=[a-z0-9-]+/);

    // The share field carries the same build code as the address.
    const code = new URL(page.url()).search;
    await expect(aside.getByRole("textbox", { name: /lien du build/i })).toHaveValue(new RegExp(`${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    const withItems = figure(await attack.textContent());

    // A reload decodes the build from the address.
    await page.reload();
    await expect(aside).toContainText(/layla, niveau 15/i);
    await expect(page.getByRole("list", { name: /^2\/6 objets$/i })).toBeVisible();
    await expect.poll(async () => figure(await attack.textContent())).toBe(withItems);
    expect(new URL(page.url()).search).toBe(code);
    await steps.getByRole("button", { name: /^sort de combat$/i }).click();
    await expect(page.getByRole("region", { name: /sort de combat/i }).getByRole("button", { name: spellName })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("the level changes the base stats", async ({ page }) => {
    await page.goto("/fr/tools/build?h=layla");
    const aside = page.getByRole("complementary", { name: /statistiques calcul[ée]es/i });
    await expect(aside).toContainText(/layla, niveau 15/i);
    const hp = aside.getByRole("listitem").filter({ hasText: /^pv\s*\d/i }).first();
    const at15 = figure(await hp.textContent());
    await page.getByRole("button", { name: /^h[ée]ros et niveau$/i }).click();
    await page.getByRole("button", { name: /niveau pr[ée]c[ée]dent/i }).click();
    await expect(aside).toContainText(/layla, niveau 14/i);
    await expect(page).toHaveURL(/[?&]l=14(&|$)/);
    await expect.poll(async () => figure(await hp.textContent())).toBeLessThan(at15);
  });

  test("a damaged link says what was dropped", async ({ page }) => {
    await page.goto("/fr/tools/build?h=layla&i=not-an-item");
    await expect(page.getByRole("status").filter({ hasText: /objet/i })).toBeVisible();
    await expect(page.getByRole("complementary", { name: /statistiques calcul[ée]es/i })).toContainText(/layla/i);
  });
});

test("the damage calculator gives the damage of a hit and the hits to kill", async ({ page }) => {
  await page.goto("/fr/tools/damage-calculator");
  const result = page.getByRole("region", { name: /^r[ée]sultat$/i });
  await expect(result).not.toContainText(/coups pour tuer/i);

  await chooseHero(page, page.getByRole("button", { name: /choisir l'attaquant/i }), "Layla");
  await chooseHero(page, page.getByRole("button", { name: /choisir le d[ée]fenseur/i }), "Tigreal");
  const perHit = result.getByRole("paragraph").filter({ hasText: /d[ée]g[âa]ts par coup/i });
  await expect(perHit).toBeVisible();
  const damage = figure(await perHit.textContent());
  expect(damage).toBeGreaterThan(0);
  const hits = figure(await result.getByRole("paragraph").filter({ hasText: /coups pour tuer/i }).textContent());
  expect(hits).toBeGreaterThan(1);

  // Raw damage, typed: the hit grows with it.
  await page.getByRole("group", { name: /^coup$/i }).getByRole("button", { name: /d[ée]g[âa]ts bruts/i }).click();
  const raw = page.getByRole("textbox", { name: /d[ée]g[âa]ts avant d[ée]fense/i });
  await raw.fill("2000");
  await expect.poll(async () => figure(await perHit.textContent())).toBeGreaterThan(damage);
});

test.describe("matchup matrix", () => {
  test("the example fills the matrix, kept in the address across a reload", async ({ page }) => {
    await page.goto("/fr/tools/matchups");
    // The button answers once hydrated; it gives way to the filled lineups.
    const example = page.getByRole("button", { name: /voir un exemple/i });
    await expect(async () => {
      if (await example.isVisible()) await example.click();
      await expect(page).toHaveURL(/[?&]a=/, { timeout: 1_000 });
    }).toPass();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page).toHaveURL(/[?&]a=[a-z-]+.*[?&]?b=[a-z-]+/);
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader")).not.toHaveCount(0);
    await expect(table.getByRole("cell", { name: / contre .*(pts|non mesur)/i }).first()).toBeVisible();
    const url = page.url();
    const rows = await table.getByRole("rowheader").allTextContents();

    await page.reload();
    await expect(page.getByRole("table").getByRole("rowheader")).toHaveText(rows);
    expect(page.url()).toBe(url);
  });

  test("heroes picked by hand and the rank go to the address", async ({ page }) => {
    await page.goto("/fr/tools/matchups");
    const mine = page.getByRole("region", { name: /^vos h[ée]ros$/i });
    const theirs = page.getByRole("region", { name: /^adversaires$/i });
    await chooseHero(page, mine.getByRole("button", { name: /ajouter un h[ée]ros/i }), "Layla");
    await chooseHero(page, theirs.getByRole("button", { name: /ajouter un h[ée]ros/i }), "Tigreal");
    await expect(page).toHaveURL(/a=layla/);
    await expect(page).toHaveURL(/b=tigreal/);
    await expect(page.getByRole("table").getByRole("rowheader", { name: "Layla" })).toBeVisible();
    await expect(page.getByRole("table").getByRole("columnheader", { name: "Tigreal" })).toBeVisible();

    await page.getByRole("group", { name: /^rang$/i }).getByRole("button", { name: /^mythique$/i }).click();
    await expect(page).toHaveURL(/rang=mythic/);
    await page.reload();
    await expect(page.getByRole("group", { name: /^rang$/i }).getByRole("button", { name: /^mythique$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(mine.getByRole("button", { name: /retirer layla/i })).toBeVisible();

    // Swapping the sides swaps the address.
    await page.getByRole("button", { name: /inverser les camps/i }).click();
    await expect(page).toHaveURL(/a=tigreal/);
    await expect(page).toHaveURL(/b=layla/);
  });
});

test.describe("team analysis", () => {
  test("a team from the address is analysed, and a suggestion completes it", async ({ page }) => {
    await page.goto("/fr/tools/team?h=tigreal,layla,eudora&rang=mythic");
    const team = page.getByRole("region", { name: /^votre [ée]quipe$/i });
    await expect(team.getByText(/^3 h[ée]ros sur 5/i)).toBeVisible();
    await expect(team.getByRole("group", { name: /^rang$/i }).getByRole("button", { name: /^mythique$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const analysis = page.getByRole("region", { name: /^analyse$/i });
    await expect(analysis.getByRole("definition").first()).toHaveText(/\d+,\d %/);
    await expect(analysis).toContainText(/3 \/ 5/);

    // A suggested hero for a free lane joins the team and the address.
    const complete = page.getByRole("region", { name: /compl[ée]ter l'[ée]quipe/i });
    await complete.getByRole("button", { name: /^prendre$/i }).first().click();
    await expect(team.getByText(/^4 h[ée]ros sur 5/i)).toBeVisible();
    await expect(page).toHaveURL(/h=tigreal,layla,eudora,[a-z-]+/);

    await page.reload();
    await expect(team.getByText(/^4 h[ée]ros sur 5/i)).toBeVisible();
  });

  test("a hero added by hand goes to the address, and removing it too", async ({ page }) => {
    await page.goto("/fr/tools/team");
    const team = page.getByRole("region", { name: /^votre [ée]quipe$/i });
    await chooseHero(page, team.getByRole("button", { name: /ajouter un h[ée]ros/i }), "Khufra");
    await expect(page).toHaveURL(/h=khufra/);
    await expect(page.getByRole("region", { name: /^analyse$/i })).toBeVisible();
    await team.getByRole("button", { name: /retirer khufra/i }).click();
    await expect(team.getByText(/^0 h[ée]ros sur 5/i)).toBeVisible();
    await expect(page).not.toHaveURL(/h=/);
  });
});

test("the win-rate calculator gives the wins in a row and the games at a steady rate", async ({ page }) => {
  await page.goto("/fr/tools/win-rate");
  const games = page.getByRole("textbox", { name: /^parties jou[ée]es$/i });
  await expect(async () => {
    await games.fill("100");
    await page.getByRole("textbox", { name: /taux de victoire actuel/i }).fill("50");
    await page.getByRole("textbox", { name: /^taux vis[ée]$/i }).fill("60");
    // 50 wins out of 100, 60 % wanted: (0.6 × 100 − 50) ÷ 0.4 = 25.
    await expect(page.getByRole("paragraph").filter({ hasText: /^25\s*victoires d'affil[ée]e$/i })).toBeVisible({ timeout: 1_000 });
  }).toPass();

  // A preset target answers too.
  await page.getByRole("group", { name: /objectifs courants/i }).getByRole("button", { name: /^70 %$/i }).click();
  await expect(page.getByRole("textbox", { name: /^taux vis[ée]$/i })).toHaveValue("70");
  // (0.7 × 100 − 50) ÷ 0.3 = 66.7, rounded up.
  await expect(page.getByRole("paragraph").filter({ hasText: /^67\s*victoires d'affil[ée]e$/i })).toBeVisible();

  await page.getByRole("textbox", { name: /^taux tenu$/i }).fill("80");
  // (0.7 × 100 − 50) ÷ (0.8 − 0.7) = 200 games.
  await expect(page.getByText(/200\s*parties\s*[àa]\s*80\s*%\s*de victoires/i)).toBeVisible();
});

test("the draw calculator gives the chance for a budget and the draws for a chance", async ({ page }) => {
  await page.goto("/fr/tools/draw-calculator");
  const price = page.getByRole("textbox", { name: /^prix d'un tirage/i });
  await expect(async () => {
    await price.fill("10");
    await page.getByRole("textbox", { name: /prix du tirage x10/i }).fill("");
    await page.getByRole("textbox", { name: /chance du lot par tirage/i }).fill("10");
    await page.getByRole("textbox", { name: /garanti au tirage/i }).fill("");
    await page.getByRole("textbox", { name: /^budget/i }).fill("100");
    // 10 draws at 10 %: 1 − 0.9¹⁰ = 65.1 %.
    await expect(page.getByRole("paragraph").filter({ hasText: /^65,1\s*%\s*de chances d'obtenir le lot$/i })).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(page.getByRole("term").filter({ hasText: /^tirages effectu[ée]s$/i })).toBeVisible();

  // A wiki preset fills the fields.
  const presets = page.getByRole("group", { name: /[ée]v[ée]nements relev[ée]s/i });
  await presets.getByRole("button").first().click();
  await expect(presets.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /^50 %$/ }) })).toBeVisible();
});

/*
 * Match-side utilities: the objective timer, the server clock, the nickname
 * generator and the Retribution trainer.
 */

test.describe("objective timer", () => {
  test("starts, shifts by 5 s, records and undoes a kill, and survives a reload", async ({ page }) => {
    await page.goto("/fr/tools/timer");
    const clock = page.getByRole("timer");
    await expect(clock).toHaveText("0:00");
    await expect(page.getByText(/d[ée]marrez l'horloge pour noter les morts/i)).toBeVisible();

    // The start button answers once hydrated.
    const start = page.getByRole("button", { name: /d[ée]marrer [àa] 0:00/i });
    await expect(async () => {
      await start.click();
      await expect(page.getByText(/^en marche$/i)).toBeVisible({ timeout: 1_000 });
    }).toPass();

    // Pause, so the clock no longer moves, then set it from the game's display.
    await page.getByRole("button", { name: /^pause$/i }).click();
    await expect(page.getByText(/^en pause$/i)).toBeVisible();
    await page.getByLabel(/temps affich[ée] en jeu/i).fill("2:05");
    await page.getByRole("button", { name: /^caler$/i }).click();
    // Setting the time keeps the clock paused: the values below are exact.
    await expect(clock).toHaveText("2:05");
    await expect(page.getByText(/^en pause$/i)).toBeVisible();
    const now = async () => {
      const [m, s] = (await clock.textContent())!.split(":").map(Number);
      return m * 60 + s;
    };
    const before = await now();
    await page.getByRole("button", { name: /avancer l'horloge de 5 secondes/i }).click();
    await expect.poll(now).toBe(before + 5);
    await page.getByRole("button", { name: /reculer l'horloge de 5 secondes/i }).click();
    await expect.poll(now).toBe(before);

    // A kill is noted at the current time, then taken back.
    await page.getByRole("button", { name: /noter la mort : tortue/i }).click();
    await expect(page.getByText(/tortue : mort not[ée]e [àa]/i)).toBeVisible();
    await page.getByRole("button", { name: /^annuler$/i }).click();
    await expect(page.getByText(/touchez un objectif [àa] sa mort/i)).toBeVisible();
    await page.getByRole("button", { name: /noter la mort : seigneur/i }).click();
    await expect(page.getByText(/seigneur : mort not[ée]e [àa]/i)).toBeVisible();

    // The match lives in the tab: a reload brings back the clock and the kill.
    const stored = await page.evaluate(() => sessionStorage.getItem("mlbb_timer_match"));
    expect(stored).toBeTruthy();
    const shown = await clock.textContent();
    await page.reload();
    await expect(clock).toHaveText(shown!);
    await expect(page.getByText(/^en pause$/i)).toBeVisible();
    await expect(page.getByText(/seigneur : mort not[ée]e [àa]/i)).toBeVisible();
  });
});

test.describe("server time", () => {
  test("the server clock ticks", async ({ page }) => {
    await page.goto("/fr/tools/server-time");
    const clock = page.getByRole("timer").first();
    // In development, the page compiles on first visit: a longer wait.
    await expect(clock).toHaveText(/^\d{2}:\d{2}:\d{2}$/, { timeout: 20_000 });
    const first = await clock.textContent();
    await expect(clock).not.toHaveText(first!, { timeout: 5_000 });
    await expect(clock).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  });
});

test.describe("nickname generator", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("a style is copied to the clipboard", async ({ page }) => {
    await page.goto("/fr/tools/nickname");
    const field = page.getByLabel(/votre pseudo/i);
    // Mathematical bold: L, e, o.
    const bold = String.fromCodePoint(0x1d400 + 11, 0x1d41a + 4, 0x1d41a + 14);
    const copy = page.getByRole("button", { name: /^copier le style gras$/i });
    await expect(async () => {
      await field.fill("Leo");
      await copy.click();
      await expect(page.getByRole("status").filter({ hasText: /copi[ée]/i })).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expect(page.getByRole("status").filter({ hasText: /copi[ée]/i })).toContainText(bold);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(bold);
  });
});

test.describe("retribution trainer", () => {
  test("a round starts, Space strikes and the score shows", async ({ page }) => {
    await page.goto("/fr/tools/retribution");
    // Easy: the threshold marker and the HP figures are shown, the enemy is slow.
    const easy = page.getByRole("button", { name: /^facile/i });
    await expect(async () => {
      await easy.click();
      await expect(easy).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass();

    const bar = page.getByRole("progressbar", { name: /barre de vie/i });
    await expect(bar).toBeVisible();
    const marker = await page.getByText(/rep[èe]re dor[ée] :/i).textContent();
    const threshold = Number(marker!.replace(/\D/g, ""));
    expect(threshold).toBeGreaterThan(0);

    // Space starts the round from anywhere on the page.
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: /^retribution !$/i })).toBeVisible({ timeout: 10_000 });

    // Strike as soon as the HP fall under the Retribution damage.
    await page.waitForFunction(
      (limit) => {
        const el = document.querySelector('[role="progressbar"]');
        return !!el && Number(el.getAttribute("aria-valuenow")) <= limit;
      },
      threshold,
      { polling: "raf", timeout: 30_000 },
    );
    await page.keyboard.press("Space");

    await expect(page.getByRole("status").filter({ hasText: /s[ée]curis[ée] !/i })).toBeAttached();
    await expect(page.getByRole("paragraph").filter({ hasText: /^s[ée]curis[ée] !$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^manche suivante$/i })).toBeVisible();
    await expect(page.getByRole("list", { name: /manches de la partie/i }).getByRole("listitem").first()).toContainText(
      /s[ée]curis[ée]/i,
    );
    const score = page.getByTestId("retribution-score");
    await expect(score).toHaveText(/^\d[\d\s ]*$/);
    expect(Number((await score.textContent())!.replace(/\D/g, ""))).toBeGreaterThan(0);
  });
});
