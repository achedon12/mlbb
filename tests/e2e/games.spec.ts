import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

/**
 * The two browser games, MLBBdle and the quiz, played as a visitor would:
 * the daily puzzle served by the site for today's UTC date, and practice.
 * The answers are read from the puzzle the page itself received and kept in
 * the browser, never from the source: the test plays whatever the server
 * serves. Cells and guesses carry their verdict in `data-verdict`.
 */

const VERDICTS = ["match", "partial", "miss", "unknown"];

/** Hero names by slug, from the site's own search index. */
async function heroNames(request: APIRequestContext): Promise<Map<string, string>> {
  const response = await request.get("/fr/search.json");
  const entries = (await response.json()) as { type: string; title: string; href: string }[];
  return new Map(
    entries.filter((e) => e.type === "hero").map((e) => [e.href.replace(/^\/heroes\//, ""), e.title]),
  );
}

/** A hero to guess wrong: any well-known one that is not the answer. */
function wrongGuess(answers: (string | undefined)[]): string {
  return ["miya", "layla", "tigreal", "balmond"].find((s) => !answers.includes(s))!;
}

/** Types a name in an answer field and picks it from the suggestions. */
async function guess(page: Page, field: Locator, name: string) {
  await field.fill(name);
  await page.getByRole("option", { name, exact: true }).click();
}

function storage<T>(page: Page, key: string): Promise<T | null> {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, key);
}

/** A mode chip, clicked until the hydrated page answers. */
async function choose(group: Locator, name: RegExp) {
  const button = group.getByRole("button", { name });
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass();
}

test.describe("MLBBdle", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  type Puzzle = { day: string; classic: string; skill?: { answer: string } };
  const todaysPuzzle = async (page: Page) => (await storage<{ puzzle: Puzzle }>(page, "mlbbdle_puzzle"))!.puzzle;

  test("classic: a guess fills a grid row, the win is kept with its stats", async ({ page, request }) => {
    const names = await heroNames(request);
    await page.goto("/fr/mlbbdle");
    const field = page.getByRole("combobox", { name: /nom d'un h[ée]ros/i });
    await expect(field).toBeVisible();
    await expect(page.getByRole("heading", { name: /quel est le h[ée]ros du jour/i })).toBeVisible();
    const puzzle = await todaysPuzzle(page);
    const wrong = wrongGuess([puzzle.classic]);

    // A wrong guess: one row, one verdict per trait, not all of them matching.
    await guess(page, field, names.get(wrong)!);
    const grid = page.getByRole("table", { name: /vos essais/i });
    const row = (slug: string) => grid.getByRole("row").filter({ has: page.getByRole("rowheader", { name: names.get(slug) }) });
    await expect(row(wrong)).toHaveCount(1);
    const cells = row(wrong).getByRole("cell");
    await expect(cells).toHaveCount(9);
    const verdicts = await cells.evaluateAll((tds) => tds.map((td) => td.getAttribute("data-verdict")));
    for (const v of verdicts) expect(VERDICTS).toContain(v);
    expect(verdicts.some((v) => v !== "match")).toBe(true);
    await expect(page.getByText(/essais : 1/i).first()).toBeVisible();
    // A hero already played is no longer offered.
    await field.fill(names.get(wrong)!);
    await expect(page.getByRole("option", { name: names.get(wrong), exact: true })).toHaveCount(0);

    // The right one: an all-green row on top, the win panel, the field gone.
    await guess(page, field, names.get(puzzle.classic)!);
    await expect(row(puzzle.classic).getByRole("cell")).toHaveCount(9);
    for (const v of await row(puzzle.classic).getByRole("cell").evaluateAll((tds) => tds.map((td) => td.getAttribute("data-verdict")))) {
      expect(v).toBe("match");
    }
    await expect(grid.getByRole("row").nth(1)).toContainText(names.get(puzzle.classic)!);
    await expect(page.getByRole("heading", { name: /trouv[ée] ! essais : 2/i })).toBeVisible();
    await expect(field).toBeHidden();
    const mode = page.getByRole("group", { name: /^mode$/i });
    await expect(mode.getByRole("button", { name: /classique.*r[ée]solu/i })).toBeVisible();

    // The share copies a grid without any hero name.
    await page.getByRole("button", { name: /partager mon r[ée]sultat/i }).click();
    await expect(page.getByText(/r[ée]sultat copi[ée]/i)).toBeVisible();
    const shared = await page.evaluate(() => navigator.clipboard.readText());
    expect(shared).toMatch(/MLBBdle/);
    expect(shared).not.toContain(names.get(puzzle.classic)!);

    // Stats and guesses live in the browser and survive a reload.
    const stats = await storage<{ joues: number; distribution: Record<string, number> }>(page, "mlbbdle_stats_classic");
    expect(stats?.joues).toBe(1);
    expect(stats?.distribution[2]).toBe(1);
    expect(await storage(page, "mlbbdle_game")).toMatchObject({ day: puzzle.day, classic: [wrong, puzzle.classic] });
    await page.reload();
    await expect(page.getByRole("heading", { name: /trouv[ée] ! essais : 2/i })).toBeVisible();
    await expect(grid.getByRole("row")).toHaveCount(3);
    await expect(page.getByRole("combobox", { name: /nom d'un h[ée]ros/i })).toHaveCount(0);
    await expect(mode.getByRole("button", { name: /classique.*r[ée]solu/i })).toBeVisible();
  });

  test("skill mode: a miss counts down to the next clue, the answer wins", async ({ page, request }) => {
    const names = await heroNames(request);
    await page.goto("/fr/mlbbdle");
    await expect(page.getByRole("combobox", { name: /nom d'un h[ée]ros/i })).toBeVisible();
    await choose(page.getByRole("group", { name: /^mode$/i }), /^comp[ée]tence/i);
    await expect(page.getByRole("heading", { name: /[àa] quel h[ée]ros appartient cette comp[ée]tence/i })).toBeVisible();
    const puzzle = await todaysPuzzle(page);
    test.skip(!puzzle.skill, "no skill puzzle today");
    const answer = puzzle.skill!.answer;
    const field = page.getByRole("combobox", { name: /nom d'un h[ée]ros/i });

    await expect(page.getByRole("img", { name: /noir et blanc/i })).toBeVisible();
    await expect(page.getByText(/couleurs · erreurs restantes avant d[ée]blocage : 2/i)).toBeVisible();
    const first = wrongGuess([answer]);
    await guess(page, field, names.get(first)!);
    const tries = page.getByRole("list", { name: /vos essais/i });
    await expect(tries.getByRole("listitem")).toHaveCount(1);
    await expect(tries.getByRole("listitem").first()).toHaveAttribute("data-verdict", "miss");
    await expect(page.getByText(/couleurs · erreurs restantes avant d[ée]blocage : 1/i)).toBeVisible();

    // The second miss unlocks the colours.
    const second = ["layla", "tigreal", "balmond", "eudora"].find((s) => s !== answer && s !== first)!;
    await guess(page, field, names.get(second)!);
    await expect(page.getByRole("img", { name: /noir et blanc/i })).toHaveCount(0);
    await expect(page.getByText(/l'ic[ôo]ne s'affiche d[ée]sormais en couleur/i)).toBeVisible();

    await guess(page, field, names.get(answer)!);
    await expect(tries.getByRole("listitem").first()).toHaveAttribute("data-verdict", "match");
    await expect(page.getByRole("heading", { name: /trouv[ée] ! essais : 3/i })).toBeVisible();
    await expect(page.getByText(/la comp[ée]tence :/i)).toBeVisible();
    expect((await storage<{ joues: number }>(page, "mlbbdle_stats_skill"))?.joues).toBe(1);
  });

  test("practice: a guess, the reveal and a new hero, in both types", async ({ page, request }) => {
    const names = await heroNames(request);
    await page.goto("/fr/mlbbdle");
    await expect(page.getByRole("combobox", { name: /nom d'un h[ée]ros/i })).toBeVisible();
    await choose(page.getByRole("group", { name: /^mode$/i }), /^entra[îi]nement/i);
    await expect(page.getByText(/entra[îi]nement · h[ée]ros n° 1/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /quel est ce h[ée]ros/i })).toBeVisible();

    // A guess draws its row; the answer is unknown here, so it may even win.
    const field = page.getByRole("combobox", { name: /nom d'un h[ée]ros/i });
    await guess(page, field, names.get("miya")!);
    const grid = page.getByRole("table", { name: /vos essais/i });
    await expect(grid.getByRole("row")).toHaveCount(2);
    const reveal = page.getByRole("button", { name: /r[ée]v[ée]ler la r[ée]ponse/i });
    if (await reveal.isVisible()) {
      await reveal.click();
      await expect(page.getByText(/la r[ée]ponse [ée]tait/i).first()).toBeVisible();
      await expect(field).toBeHidden();
    }
    await page.getByRole("button", { name: /nouveau h[ée]ros/i }).click();
    await expect(page.getByText(/entra[îi]nement · h[ée]ros n° 2/i)).toBeVisible();
    await expect(grid).toHaveCount(0);
    await expect(field).toBeVisible();

    // Skill practice draws a skill from the quiz pool.
    await choose(page.getByRole("group", { name: /^type$/i }), /^comp[ée]tence$/i);
    // The skill pool is fetched on first opening.
    await expect(page.getByRole("img", { name: /ic[ôo]ne de la comp[ée]tence/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /[àa] quel h[ée]ros appartient cette comp[ée]tence/i })).toBeVisible();
    await page.getByRole("button", { name: /r[ée]v[ée]ler la r[ée]ponse/i }).click();
    await expect(page.getByText(/la r[ée]ponse [ée]tait/i).first()).toBeVisible();
    await page.getByRole("button", { name: /nouveau h[ée]ros/i }).click();
    await expect(page.getByRole("button", { name: /r[ée]v[ée]ler la r[ée]ponse/i })).toBeVisible();
  });
});

test.describe("quiz", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  type Pair = { slug: string; victoire: number }[];
  type Round = { type: string; reponse?: string; paires?: Pair[] };

  test("daily: hints after a miss, every round to the summary, stats kept", async ({ page, request }) => {
    const names = await heroNames(request);
    await page.goto("/fr/quiz");
    const steps = page.getByRole("navigation", { name: /manches du d[ée]fi/i });
    await expect(steps).toBeVisible();
    const challenge = (await storage<{ defi: { manches: Round[] } }>(page, "mlbb_quiz_defi"))!.defi;
    const rounds = challenge.manches;
    expect(rounds.length).toBeGreaterThan(1);
    await expect(steps.getByRole("button", { name: /bilan du d[ée]fi/i })).toBeDisabled();

    let points = 0;
    for (const [i, round] of rounds.entries()) {
      await expect(steps.getByRole("button", { name: new RegExp(`^manche ${i + 1}/`, "i") })).toHaveAttribute("aria-current", "step");
      if (round.type === "duel") {
        // Pick the higher win rate of each pair: every pair is a point.
        for (const pair of round.paires!) {
          const best = pair[0].victoire >= pair[1].victoire ? pair[0] : pair[1];
          await page.getByRole("button", { name: new RegExp(`^${names.get(best.slug)}`) }).click();
          points++;
        }
        await expect(page.getByText(/% de victoires/).first()).toBeVisible();
      } else if (i === 0 && round.type !== "item") {
        // A miss unlocks the first hint, then the answer is found.
        const field = page.getByRole("combobox", { name: /nom d'un h[ée]ros/i });
        await expect(page.getByRole("heading", { name: /indices \(0\//i })).toBeVisible();
        await guess(page, field, names.get(wrongGuess([round.reponse]))!);
        await expect(page.getByRole("heading", { name: /indices \(1\//i })).toBeVisible();
        await expect(page.getByText("Essais restants : 4", { exact: true })).toBeVisible();
        await expect(page.getByRole("list", { name: /vos essais/i }).getByRole("listitem")).toHaveCount(1);
        await guess(page, field, names.get(round.reponse!)!);
        await expect(page.getByText(/trouv[ée] ! essais : 2\/5/i)).toBeVisible();
        points++;
      } else {
        await page.getByRole("button", { name: /^passer$/i }).click();
        await expect(page.getByText(/manqu[ée] ! la r[ée]ponse [ée]tait/i)).toBeVisible();
      }
      const last = i === rounds.length - 1;
      await page.getByRole("button", { name: last ? /voir le bilan/i : /manche suivante/i }).click();
    }

    const max = rounds.reduce((n, r) => n + (r.type === "duel" ? r.paires!.length : 1), 0);
    await expect(page.getByRole("heading", { name: `Défi terminé : ${points}/${max}` })).toBeVisible();
    await expect(steps.getByRole("button", { name: /bilan du d[ée]fi/i })).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: /partager mon r[ée]sultat/i }).click();
    await expect(page.getByText(/r[ée]sultat copi[ée]/i)).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`${points}/${max}`);
    expect((await storage<{ joues: number }>(page, "mlbb_quiz_stats"))?.joues).toBe(1);

    // Back on the page, the finished challenge opens on its summary.
    await page.reload();
    await expect(page.getByRole("heading", { name: `Défi terminé : ${points}/${max}` })).toBeVisible();
    await expect(steps.getByRole("button", { name: /^manche 1\/.*trouv[ée]e/i })).toBeVisible();
  });

  test("practice: a question is played and the next one drawn", async ({ page, request }) => {
    const names = await heroNames(request);
    await page.goto("/fr/quiz");
    await expect(page.getByRole("navigation", { name: /manches du d[ée]fi/i })).toBeVisible();
    await choose(page.getByRole("group", { name: /^mode$/i }), /^entra[îi]nement$/i);
    // The practice pool is fetched on first opening.
    await expect(page.getByText(/^question 1 ·/i)).toBeVisible({ timeout: 15_000 });
    const filters = page.getByRole("group", { name: /^[ée]preuves$/i });
    await expect(filters.getByRole("button")).toHaveCount(5);

    const skip = page.getByRole("button", { name: /^passer$/i });
    if (await skip.isVisible()) {
      await skip.click();
      await expect(page.getByText(/manqu[ée] ! la r[ée]ponse [ée]tait/i)).toBeVisible();
    } else {
      // The duel: one pair to settle.
      const escaped = [...names.values()].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      await page.getByRole("button", { name: new RegExp(`^(${escaped.join("|")})$`) }).first().click();
      await expect(page.getByText(/% de victoires/).first()).toBeVisible();
    }
    const record = await storage<{ jouees: number }>(page, "mlbb_quiz_entrainement");
    expect(record?.jouees).toBe(1);

    // A filter narrows the next draws; the last one cannot be switched off.
    await filters.getByRole("button", { name: /^comp[ée]tence$/i }).click();
    await expect(filters.getByRole("button", { name: /^comp[ée]tence$/i })).toHaveAttribute("aria-pressed", "false");
    for (const type of [/^apparence$/i, /^histoire$/i, /^objet$/i, /^duel de taux$/i]) await filters.getByRole("button", { name: type }).click();
    await expect(filters.getByRole("button", { name: /^duel de taux$/i })).toHaveAttribute("aria-pressed", "true");
    await filters.getByRole("button", { name: /^comp[ée]tence$/i }).click();
    await filters.getByRole("button", { name: /^duel de taux$/i }).click();
    await expect(filters.locator('[aria-pressed="true"]')).toHaveCount(1);

    await page.getByRole("button", { name: /question suivante/i }).click();
    await expect(page.getByText(/^question 2 · comp[ée]tence/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /[àa] quel h[ée]ros appartient cette comp[ée]tence/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /indices \(0\//i })).toBeVisible();
  });
});
