import { expect, test, type Page } from "@playwright/test";

/**
 * Parcours des fonctionnalites : chaque test part d'une page fraiche et vise
 * un comportement, pas un rendu. Les libelles francais sont lus avec ou sans
 * accents, les catalogues de messages evoluant en parallele.
 */

const TELEPHONE = { width: 390, height: 844 };

/** Le groupe de filtres « Rang » d'une fiche heros (fieldset + legend). */
const selecteurRang = (page: Page) => page.getByRole("group", { name: /^rang$/i });

test.describe("fiche heros", () => {
  test("le selecteur de rang est unique et bascule au clic", async ({ page }) => {
    await page.goto("/fr/heroes/khufra");
    await expect(selecteurRang(page)).toHaveCount(1);

    const groupe = selecteurRang(page);
    const tous = groupe.getByRole("button", { name: /^tous rangs$/i });
    const mythique = groupe.getByRole("button", { name: /^mythique$/i });
    await expect(tous).toHaveAttribute("aria-pressed", "true");
    await expect(mythique).toHaveAttribute("aria-pressed", "false");

    await mythique.click();
    await expect(mythique).toHaveAttribute("aria-pressed", "true");
    await expect(tous).toHaveAttribute("aria-pressed", "false");
    await expect(groupe.locator('[aria-pressed="true"]')).toHaveCount(1);
    // Changer d'onglet ne fait pas apparaitre un second selecteur.
    await page.getByRole("tab", { name: /builds/i }).click();
    await expect(selecteurRang(page)).toHaveCount(1);
  });

  test("l'onglet Builds montre les builds joues", async ({ page }) => {
    await page.goto("/fr/heroes/khufra");
    await page.getByRole("tab", { name: /builds/i }).click();
    const panneau = page.getByRole("tabpanel");
    await expect(panneau.getByRole("heading", { name: /builds les plus jou[ée]s/i })).toBeVisible();
    // Chaque build liste ses objets cles, avec leur visuel.
    const build = panneau.getByRole("listitem").filter({ hasText: /build 1/i }).first();
    await expect(build).toBeVisible();
    await expect(build.locator("img").first()).toBeVisible();
  });

  test("l'onglet Stats montre les ajustements par patch", async ({ page }) => {
    await page.goto("/fr/heroes/khufra");
    const onglet = page.getByRole("tab", { name: /^stats$/i });
    await onglet.click();
    await expect(onglet).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: /ajustements par patch/i })).toBeVisible();
  });
});

test.describe("sur telephone", () => {
  test.use({ viewport: TELEPHONE });

  test("un objet s'ouvre dans un drawer qui se referme", async ({ page }) => {
    await page.goto("/fr/items");
    await page.getByRole("button", { name: /^war axe/i }).click();

    const tiroir = page.getByRole("dialog", { name: /war axe/i });
    await expect(tiroir).toBeVisible();
    await expect(tiroir.getByRole("heading", { name: /war axe/i })).toBeVisible();
    // Objet present dans les builds joues : la fiche cite les heros qui le prennent.
    await expect(tiroir.getByText(/utilis[ée] par/i)).toBeVisible();
    await expect(tiroir.getByRole("link").first()).toHaveAttribute("href", /\/heroes\//);

    await tiroir.getByRole("button", { name: /fermer/i }).click();
    await expect(tiroir).toBeHidden();
  });

  test("une competence s'ouvre dans un drawer", async ({ page }) => {
    await page.goto("/fr/heroes/belerick");
    await page.getByRole("tab", { name: /comp[ée]tences/i }).click();
    const tuiles = page.getByRole("tabpanel").getByRole("button", { expanded: false });
    await tuiles.first().click();

    const tiroir = page.getByRole("dialog");
    await expect(tiroir).toBeVisible();
    await expect(tiroir.getByRole("heading", { level: 3 })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(tiroir).toBeHidden();
  });
});

test("le draft propose tout le roster, filtre et suggere", async ({ page }) => {
  await page.goto("/fr/draft");
  const adverse = page.locator("section").filter({
    has: page.getByRole("heading", { name: /[ée]quipe adverse/i }),
  });
  await adverse.getByRole("button", { name: /choisir un h[ée]ros/i }).first().click();

  const selecteur = page.getByRole("dialog");
  await expect(selecteur).toBeVisible();
  const compte = selecteur.getByText(/^\d+ h[ée]ros$/i);
  const nombre = async () => Number((await compte.textContent())?.match(/\d+/)?.[0]);

  // Ouvert sur une lane ; « Toutes » elargit au roster entier.
  const surLane = await nombre();
  await selecteur.getByRole("button", { name: /^toutes$/i }).click();
  await expect(selecteur.getByRole("button", { name: /^toutes$/i })).toHaveAttribute("aria-pressed", "true");
  const tous = await nombre();
  expect(tous).toBeGreaterThan(100);
  expect(tous).toBeGreaterThan(surLane);

  // Le filtre de role resserre la liste.
  await selecteur.getByRole("button", { name: /^tank$/i }).click();
  await expect.poll(nombre).toBeLessThan(tous);
  await expect.poll(nombre).toBeGreaterThan(0);

  // Choisir un adversaire fait apparaitre des suggestions.
  await selecteur.getByRole("button", { name: "Khufra" }).click();
  await expect(selecteur).toBeHidden();
  await expect(adverse.getByText("Khufra")).toBeVisible();
  await expect(page.getByRole("button", { name: /^prendre$/i }).first()).toBeVisible();
});

test("le comparateur filtre la liste des heros a la frappe", async ({ page }) => {
  await page.goto("/fr/compare");
  const champ = page.getByRole("combobox", { name: /premier h[ée]ros/i });
  await champ.click();
  const liste = page.getByRole("listbox", { name: /premier h[ée]ros/i });
  await expect(liste).toBeVisible();
  const avant = await liste.getByRole("option").count();
  expect(avant).toBeGreaterThan(100);

  await champ.fill("khuf");
  await expect(liste.getByRole("option")).toHaveCount(1);
  await expect(liste.getByRole("option")).toHaveText(/khufra/i);
  await champ.press("Enter");
  await expect(liste).toBeHidden();
  await expect(champ).toHaveValue("Khufra");
  await expect(page).toHaveURL(/a=khufra/);
});

test.describe("tier list par rang", () => {
  test("mene a la page du rang Mythique", async ({ page }) => {
    await page.goto("/fr/tier-list");
    const nav = page.getByRole("navigation", { name: /par rang/i });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: /^mythique$/i }).click();
    // En developpement, la page du rang se compile a la premiere navigation :
    // sous la charge de plusieurs workers, cela depasse le delai par defaut.
    await expect(page).toHaveURL(/\/fr\/tier-list\/mythic$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/mythique/i);
    await expect(
      page.getByRole("navigation", { name: /par rang/i }).getByRole("link", { name: /^mythique$/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("un rang inconnu mene a la page 404", async ({ page }) => {
    const reponse = await page.goto("/fr/tier-list/foo");
    expect(reponse?.status()).toBe(404);
  });
});

test.describe("recherche globale", () => {
  test("Ctrl+K ouvre la recherche et Entree ouvre le resultat", async ({ page }) => {
    await page.goto("/fr");
    // Le raccourci n'est ecoute qu'une fois la page hydratee.
    const bouton = page.getByRole("banner").getByRole("button", { name: /^rechercher$/i });
    await expect(bouton).toBeVisible();
    const dialogue = page.getByRole("dialog", { name: /rechercher/i });
    await expect(async () => {
      await page.keyboard.press("Control+K");
      await expect(dialogue).toBeVisible({ timeout: 1_000 });
    }).toPass();

    const champ = dialogue.getByRole("combobox");
    await champ.fill("khuf");
    await expect(dialogue.getByRole("option", { name: /khufra/i }).first()).toBeVisible();
    await champ.press("Enter");
    await expect(page).toHaveURL(/\/fr\/heroes\/khufra$/);
    await expect(page.getByRole("heading", { name: "Khufra", level: 1 })).toBeVisible();
  });

  test("le bouton de l'en-tete ouvre la recherche", async ({ page }) => {
    await page.goto("/fr/heroes");
    const dialogue = page.getByRole("dialog", { name: /rechercher/i });
    await expect(async () => {
      await page.getByRole("banner").getByRole("button", { name: /^rechercher$/i }).click();
      await expect(dialogue).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expect(dialogue.getByRole("combobox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialogue).toBeHidden();
  });
});

test("l'image de partage d'une fiche est un PNG", async ({ request }) => {
  const reponse = await request.get("/fr/heroes/khufra/opengraph-image");
  expect(reponse.status()).toBe(200);
  expect(reponse.headers()["content-type"]).toContain("image/png");
});

test("le manifeste PWA declare une icone maskable", async ({ request }) => {
  const manifeste = await request.get("/manifest.webmanifest");
  expect(manifeste.ok()).toBe(true);
  const { icons } = (await manifeste.json()) as {
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(icons).toContainEqual(expect.objectContaining({ sizes: "512x512", purpose: "maskable" }));

  const icone = await request.get("/icons/icon-192.png");
  expect(icone.status()).toBe(200);
  expect(icone.headers()["content-type"]).toContain("image/png");
});
