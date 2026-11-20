import type { Page } from "@playwright/test";
import { readAuthor, readNote } from "../../src/lib/editorial";
import { expect, test } from "./visitor";

/**
 * The site's frame, ahead of a redesign: the header's sections and panels,
 * the breadcrumb's sibling pages, the filter sheet on a phone, the offline
 * banner, the Discord invitations, the footer, and the machine-readable
 * outputs (feeds, llms.txt, JSON-LD). Roles, labels and accessible names
 * only.
 */

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

const mainNav = (page: Page) => page.getByRole("navigation", { name: /navigation principale/i });

test.describe("header", () => {
  test.use({ viewport: DESKTOP });

  test("the current section is marked, and its panel marks the current page", async ({ page }) => {
    await page.goto("/fr/tier-list");
    const nav = mainNav(page);
    await expect(nav.getByRole("button", { name: /^m[ée]ta$/i })).toHaveAttribute("aria-current", "true");
    await expect(nav.locator('button[aria-current="true"]')).toHaveCount(1);
    await expect(nav.getByRole("button", { name: /^h[ée]ros$/i })).not.toHaveAttribute("aria-current", /.+/);

    await page.goto("/fr/heroes/masha");
    await expect(mainNav(page).getByRole("button", { name: /^h[ée]ros$/i })).toHaveAttribute("aria-current", "true");
    await expect(mainNav(page).getByRole("button", { name: /^m[ée]ta$/i })).not.toHaveAttribute("aria-current", /.+/);

    // The open panel of the section names the page you are on.
    await page.goto("/fr/heroes");
    const heroes = mainNav(page).getByRole("button", { name: /^h[ée]ros$/i });
    await expect(async () => {
      await heroes.click();
      await expect(heroes).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass();
    const panel = page.locator(`[id="${await heroes.getAttribute("aria-controls")}"]`);
    await expect(panel.locator('a[aria-current="page"]').first()).toHaveAttribute("href", /\/fr\/heroes$/);
  });

  test("a panel opens on hover and closes when the pointer leaves", async ({ page }) => {
    await page.goto("/fr/heroes");
    const nav = mainNav(page);
    const guides = nav.getByRole("button", { name: /^guides$/i });
    await expect(async () => {
      await page.mouse.move(0, 400);
      await guides.hover();
      await expect(guides).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass();
    const panel = page.locator(`[id="${await guides.getAttribute("aria-controls")}"]`);
    await expect(panel.getByRole("link").first()).toBeVisible();
    // Moving to another section switches panels.
    await nav.getByRole("button", { name: /^outils$/i }).hover();
    await expect(nav.getByRole("button", { name: /^outils$/i })).toHaveAttribute("aria-expanded", "true");
    await expect(guides).toHaveAttribute("aria-expanded", "false");
    // Leaving the header closes, after a short grace period.
    await page.mouse.move(700, 800);
    await expect(nav.getByRole("button", { name: /^outils$/i })).toHaveAttribute("aria-expanded", "false");
  });

  test("a click toggles a panel, and a click outside closes it", async ({ page }) => {
    await page.goto("/fr/heroes");
    const news = mainNav(page).getByRole("button", { name: /^actus et esport$/i });
    await expect(async () => {
      await news.click();
      await expect(news).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass();
    await page.mouse.click(700, 800);
    await expect(news).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("breadcrumb", () => {
  test("the last crumb lists its sibling pages, with a filter", async ({ page }) => {
    await page.goto("/fr/heroes/masha");
    const trail = page.getByRole("navigation", { name: /fil d'ariane/i });
    const siblings = trail.getByRole("button", { name: /autres pages au m[êe]me niveau que masha/i });
    await expect(siblings).toHaveAttribute("aria-expanded", "false");
    await expect(async () => {
      await siblings.click();
      await expect(siblings).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass();

    const panel = page.locator(`[id="${await siblings.getAttribute("aria-controls")}"]`);
    const filter = panel.getByRole("textbox", { name: /filtrer/i });
    await expect(filter).toBeFocused();
    await expect(panel.getByRole("link", { name: "Masha" })).toHaveAttribute("aria-current", "page");
    expect(await panel.getByRole("link").count()).toBeGreaterThan(100);

    await filter.fill("khuf");
    await expect(panel.getByRole("link")).toHaveCount(1);
    await filter.fill("zzzz");
    await expect(panel.getByRole("link")).toHaveCount(0);
    await filter.fill("khuf");
    await panel.getByRole("link", { name: "Khufra" }).click();
    await expect(page).toHaveURL(/\/fr\/heroes\/khufra$/);
    await expect(page.getByRole("heading", { level: 1, name: "Khufra" })).toBeVisible();
  });

  test("Escape closes the sibling list", async ({ page }) => {
    await page.goto("/fr/heroes/masha/skins");
    const siblings = page.getByRole("navigation", { name: /fil d'ariane/i }).getByRole("button", { name: /autres pages au m[êe]me niveau/i });
    await expect(async () => {
      await siblings.click();
      await expect(siblings).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass();
    const panel = page.locator(`[id="${await siblings.getAttribute("aria-controls")}"]`);
    // The same page of the neighbouring heroes.
    await expect(panel.getByRole("link").first()).toHaveAttribute("href", /\/fr\/heroes\/[a-z-]+\/skins$/);
    await page.keyboard.press("Escape");
    await expect(siblings).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
  });
});

test.describe("filter bar on a phone", () => {
  test.use({ viewport: PHONE });

  test("the filters live in a sheet, and the choice shows in the bar", async ({ page }) => {
    await page.goto("/fr/heroes");
    // The groups stay in the document, but not on screen.
    await expect(page.getByRole("group", { name: /^r[ôo]le$/i })).toBeHidden();
    const open = page.getByRole("button", { name: /^filtrer/i });
    const sheet = page.getByRole("dialog", { name: /^filtrer/i });
    await expect(async () => {
      await open.click();
      await expect(sheet).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await sheet.getByRole("group", { name: /^r[ôo]le$/i }).getByRole("button", { name: /^tank$/i }).click();
    await expect(sheet.getByRole("group", { name: /^r[ôo]le$/i }).getByRole("button", { name: /^tank$/i })).toHaveAttribute("aria-pressed", "true");
    await sheet.getByRole("button", { name: /fermer/i }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/[?&]role=tank/i);

    // The selection is a chip in the bar, one tap drops it.
    const chip = page.getByRole("button", { name: /^tank$/i, pressed: true });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page).not.toHaveURL(/role=/);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(PHONE.width);
  });
});

test("the offline banner shows while the connection is lost", async ({ page, context }) => {
  await page.goto("/fr/heroes");
  await page.waitForLoadState("networkidle");
  const banner = page.getByRole("status").filter({ hasText: /hors ligne/i });
  await expect(banner).toHaveCount(0);
  await context.setOffline(true);
  await expect(banner).toBeVisible();
  await context.setOffline(false);
  await expect(banner).toHaveCount(0);
});

test.describe("Discord invitations", () => {
  /** The invitations only exist with a community invite (`NEXT_PUBLIC_DISCORD_INVITE_URL`). */
  async function skipWithoutInvite(page: Page) {
    const invite = await page.getByRole("banner").getByRole("link", { name: /rejoindre le discord/i }).count();
    test.skip(invite === 0, "no Discord invite configured on this server");
  }
  const popup = (page: Page) =>
    page
      .getByRole("complementary", { name: /invitation au discord/i })
      .filter({ has: page.getByRole("button", { name: /fermer l'invitation/i }) });
  const band = (page: Page) =>
    page.getByRole("complementary", { name: /invitation au discord/i }).filter({ hasNot: page.getByRole("button") });

  test("the card comes on the second page, and a dismissal is remembered", async ({ page, context }) => {
    await page.goto("/fr/legal");
    await skipWithoutInvite(page);
    await page.waitForLoadState("networkidle");
    await expect(popup(page)).toHaveCount(0);

    await page.goto("/fr/privacy");
    await expect(popup(page)).toBeVisible({ timeout: 10_000 });
    await expect(popup(page).getByRole("link", { name: /rejoindre/i })).toHaveAttribute("href", /^https:\/\/discord\.gg\//);
    await popup(page).getByRole("button", { name: /fermer l'invitation/i }).click();
    await expect(popup(page)).toHaveCount(0);
    const memory = await page.evaluate(() => JSON.parse(localStorage.getItem("mlbb_discord_popup") ?? "{}"));
    expect(memory.dismissedUntil).toBeGreaterThan(Date.now());

    // A new tab, so a new session: still nothing, the dismissal holds.
    const other = await context.newPage();
    await other.goto("/fr/legal");
    await other.goto("/fr/privacy");
    await other.waitForLoadState("networkidle");
    await other.waitForTimeout(1_500);
    await expect(popup(other)).toHaveCount(0);
  });

  test("the card never shows on the bot pages", async ({ page }) => {
    await page.goto("/fr/legal");
    await skipWithoutInvite(page);
    await page.goto("/fr/privacy");
    await expect(popup(page)).toBeVisible({ timeout: 10_000 });
    await page.goto("/fr/bot");
    await page.waitForLoadState("networkidle");
    await expect(popup(page)).toHaveCount(0);
  });

  test("the band sits on a strategic page, not on the home page", async ({ page }) => {
    await page.goto("/fr/statistics");
    await skipWithoutInvite(page);
    await expect(band(page)).toBeVisible();
    await expect(band(page).getByRole("link", { name: /rejoindre le serveur/i })).toHaveAttribute("href", /^https:\/\/discord\.gg\//);
    await page.goto("/fr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(band(page)).toHaveCount(0);
  });
});

test.describe("footer", () => {
  test("links to the legal pages", async ({ page }) => {
    await page.goto("/fr");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: /mentions l[ée]gales/i })).toHaveAttribute("href", /\/fr\/legal$/);
    await expect(footer.getByRole("link", { name: /confidentialit[ée]/i }).first()).toHaveAttribute("href", /\/fr\/privacy/);
  });

  test("signs with Dex: his page and the brand kit", async ({ page }) => {
    await page.goto("/fr");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: /qui est dex/i })).toHaveAttribute("href", /\/fr\/dex$/);
    await expect(footer.getByRole("link", { name: /kit de marque/i })).toHaveAttribute("href", /\/fr\/brand$/);
  });
});

test.describe("brand pages", () => {
  test("the Dex page tells his story and shows his six poses", async ({ page }) => {
    await page.goto("/fr/dex");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/dex/i);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2, name: /d'où il vient/i })).toBeVisible();
    const poses = page.locator("#poses").getByRole("heading", { level: 3 });
    await expect(poses).toHaveCount(6);
    await expect(page.locator("#poses").getByRole("link", { name: /kit de marque/i })).toHaveAttribute("href", /\/fr\/brand$/);
  });

  test("the brand kit gives the colour codes, the logo as SVG and Dex as PNG", async ({ page }) => {
    await page.goto("/fr/brand");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Copier #F5C451" })).toBeVisible();
    const downloads = page.getByRole("link", { name: /^t[ée]l[ée]charger dex/i });
    await expect(downloads).toHaveCount(12);
    await expect(downloads.first()).toHaveAttribute("href", "/mascot/dex-salut.png");
    await expect(page.locator('main img[src="/brand/emblem.svg"]')).toHaveCount(1);
    await expect(page.getByRole("link", { name: /t[ée]l[ée]charger le logo/i })).toHaveCount(3);
  });

  test("offers no cookie settings without audience measurement", async ({ page }) => {
    test.skip(!!process.env.NEXT_PUBLIC_MATOMO_URL, "Matomo is configured: consent.spec.ts covers the button");
    await page.goto("/fr");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("contentinfo").getByRole("button", { name: /g[ée]rer les cookies/i })).toHaveCount(0);
  });
});

test.describe("machine-readable outputs", () => {
  /** Parses XML in the browser: a malformed feed yields a `parsererror` document. */
  async function parseXml(page: Page, xml: string) {
    return page.evaluate((text) => {
      const doc = new DOMParser().parseFromString(text, "application/xml");
      if (doc.querySelector("parsererror")) return null;
      return {
        root: doc.documentElement.nodeName,
        title: doc.querySelector("channel > title")?.textContent ?? "",
        items: doc.querySelectorAll("channel > item").length,
        links: [...doc.querySelectorAll("channel > item > link")].map((l) => l.textContent ?? ""),
      };
    }, xml);
  }

  test("the site feed is valid RSS", async ({ page, request }) => {
    const response = await request.get("/feed.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/xml/);
    const feed = await parseXml(page, await response.text());
    expect(feed).not.toBeNull();
    expect(feed!.root).toBe("rss");
    expect(feed!.title).toMatch(/MLBBDex/);
    expect(feed!.items).toBeGreaterThan(0);
  });

  test("a hero's feed is valid RSS about that hero", async ({ page, request }) => {
    const response = await request.get("/fr/heroes/masha/feed.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/xml/);
    const feed = await parseXml(page, await response.text());
    expect(feed).not.toBeNull();
    expect(feed!.root).toBe("rss");
    expect(feed!.title).toMatch(/Masha/);
    // The stats tab links to it.
    await page.goto("/fr/heroes/masha#stats");
    await expect(page.getByRole("link", { name: /suivre en rss/i })).toHaveAttribute("href", /\/fr\/heroes\/masha\/feed\.xml$/);
  });

  test("llms.txt answers", async ({ request }) => {
    const response = await request.get("/llms.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/text\//);
    expect(await response.text()).toMatch(/^# MLBBDex/);
  });

  for (const path of ["/fr", "/fr/heroes/masha", "/fr/tier-list"]) {
    test(`JSON-LD of ${path} is present and parses`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        const data = JSON.parse(block);
        const nodes = Array.isArray(data) ? data : data["@graph"] ?? [data];
        expect(nodes.length).toBeGreaterThan(0);
        for (const node of nodes) expect(node["@type"] ?? node["@context"]).toBeTruthy();
      }
    });
  }
});

test.describe("what the site does itself, and where it comes from", () => {
  test("the home page lists it, each point with the page that shows it", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const why = page.locator("[data-home-why]");
    await expect(why.getByRole("heading", { level: 2, name: /pourquoi mlbbdex/i })).toBeVisible();
    await expect(why.getByRole("link", { name: /^les statistiques/i })).toHaveAttribute("href", /\/fr\/statistics$/);
    await expect(why.getByRole("link", { name: /la r[èe]gle et le classement/i })).toHaveAttribute("href", /\/fr\/tier-list$/);
    await expect(why.getByRole("link", { name: /pr[ée]parer une draft/i })).toHaveAttribute("href", /\/fr\/draft$/);
    await expect(why.getByRole("link", { name: /^l'historique de /i })).toHaveAttribute("href", /\/fr\/heroes\/[a-z-]+#stats$/);
    await expect(why.getByRole("link", { name: /m[ée]thode et sources/i }).first()).toHaveAttribute("href", /\/fr\/methodology$/);
    // Live figures, never a placeholder.
    await expect(why).not.toContainText("{");
  });

  test("the methodology page credits its sources and prints the rules with their figures", async ({ page }) => {
    await page.goto("/fr/methodology");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/m[ée]thode et sources/i);
    for (const name of [/d'o[ùu] viennent les donn[ée]es/i, /ce que le site calcule/i, /traduit automatiquement/i, /signaler une erreur/i]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: /fandom/i }).first()).toHaveAttribute("href", "https://mobilelegends.fandom.com");
    await expect(main.getByRole("link", { name: /liquipedia/i }).first()).toHaveAttribute("href", "https://liquipedia.net/mobilelegends");
    await expect(main).toContainText(/S\+ à partir de \d+/);
    await expect(main).not.toContainText("{");
  });

  test("the footer and the about page lead to it", async ({ page }) => {
    await page.goto("/fr/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("main").getByRole("link", { name: /m[ée]thode et sources/i }).first()).toHaveAttribute("href", /\/fr\/methodology$/);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: /m[ée]thode et sources/i })).toHaveAttribute("href", /\/fr\/methodology$/);
  });
});

test.describe("the author's signed texts", () => {
  // Shown only when content/fr/editorial/ holds a complete text: the pages
  // must match the folder, never show a placeholder.
  test("appear on the tier list, a patch note and the about page only when written", async ({ page }) => {
    await page.goto("/fr");
    const notes = await page.locator("[data-home-why]").getByRole("link", { name: /^les notes du patch/i }).getAttribute("href");
    const version = notes?.split("/").pop() ?? "";
    expect(version).toMatch(/^\d+(\.\d+)+$/);

    await page.goto("/fr/tier-list");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("[data-author-note]")).toHaveCount(readNote("tier-list", version) ? 1 : 0);

    await page.goto(`/fr/patch-notes/${version}`);
    await expect(page.locator("[data-author-note]")).toHaveCount(readNote("patchs", version) ? 1 : 0);

    await page.goto("/fr/about");
    await expect(page.locator("[data-author-profile]")).toHaveCount(readAuthor() ? 1 : 0);
  });

  test("stay in French in another language, marked as such", async ({ page }) => {
    await page.goto("/en/tier-list");
    const note = page.locator("[data-author-note]");
    test.skip((await note.count()) === 0, "no signed text on this patch's tier list yet");
    await expect(note.locator('[lang="fr"]')).toHaveCount(1);
    await expect(note).toContainText(/original french text/i);
  });
});
