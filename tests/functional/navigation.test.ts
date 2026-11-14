import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { sitemapEntries } from "@/lib/sitemap";
import { FOOTER, navigationHrefs, SECTIONS, sectionOf, TOOL_GROUPS } from "@/lib/sections";
import { site } from "@/lib/site";
import { LOCALES } from "@/i18n/config";

/**
 * Every page stays reachable from the navigation.
 *
 * The header, the tools hub and the footer are the site's map: a page they
 * do not lead to is only found by search engines. Each sitemap address must
 * be one of their links, or sit under one (a hero page under `/heroes`, a
 * tournament under `/esports`), the list pages linking their own detail
 * pages. Each static route of the app, read from the file tree, must be
 * linked directly.
 */
const links = navigationHrefs();

/** Path of a sitemap URL, without the site address and the locale. */
function pathOf(url: string): string {
  const path = url.replace(site.url, "");
  const locale = LOCALES.find((l) => path === `/${l}` || path.startsWith(`/${l}/`));
  return (locale ? path.slice(locale.length + 1) : path) || "/";
}

/** The path itself, then each of its parents, shortest last. */
function ancestors(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  return parts.map((_, i) => `/${parts.slice(0, parts.length - i).join("/")}`);
}

/** Static routes of the app: `page.tsx` files with no `[segment]` in their path. */
function staticRoutes(): string[] {
  const root = join(process.cwd(), "src", "app", "[locale]");
  const found: string[] = [];
  const visit = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) visit(path);
      else if (name === "page.tsx") {
        const route = relative(root, dir).split(sep).filter(Boolean);
        if (!route.some((s) => s.startsWith("["))) found.push(`/${route.join("/")}`);
      }
    }
  };
  visit(root);
  return found.map((r) => (r === "/" ? "/" : r.replace(/\/$/, "")));
}

/**
 * Static pages left out of the navigation on purpose, each with its way in.
 */
const NOT_IN_MENUS: Record<string, string> = {
  "/login": "the account button of the header",
  "/offline": "the service worker, when the network is down",
  "/account/profile": "the account page",
  "/community/moderation": "moderators only, from the forum",
  "/community/search": "the forum's search field",
  "/bot": "the community panel, only when the bot is deployed",
  "/bot/admin": "bot administrators only",
  "/bot/dashboard": "the bot page, once signed in with Discord",
  "/bot/privacy": "the bot page",
  "/bot/terms": "the bot page",
};

describe("navigation", () => {
  it("leads to every sitemap address, directly or through its list page", () => {
    const orphans = [...new Set(sitemapEntries().map((e) => pathOf(String(e.url))))].filter(
      (path) => path !== "/" && !ancestors(path).some((a) => links.has(a)),
    );
    expect(orphans).toEqual([]);
  });

  it("links every static route of the app directly", () => {
    const missing = staticRoutes().filter((r) => !links.has(r) && !(r in NOT_IN_MENUS));
    expect(missing).toEqual([]);
  });

  it("includes the newest pages", () => {
    for (const path of [
      "/tools",
      "/tools/strategy-planner",
      "/tools/account-value",
      "/heroes/free-rotation",
      "/guides",
      "/community",
      "/community/teammates",
      "/esports",
    ]) {
      expect(links.has(path), path).toBe(true);
    }
  });

  it("keeps the header to six sections, each with a hub", () => {
    expect(SECTIONS).toHaveLength(6);
    for (const s of SECTIONS) {
      expect(s.hub.startsWith("/")).toBe(true);
      expect(s.columns.length).toBeGreaterThan(0);
    }
  });

  it("puts every tool of the hub in the header's Tools panel", () => {
    const tools = SECTIONS.find((s) => s.key === "tools")!;
    expect(tools.columns).toBe(TOOL_GROUPS);
  });

  it("finds the section of a page from its address", () => {
    expect(sectionOf("/heroes/layla")).toBe("heroes");
    expect(sectionOf("/tier-list/lane/gold")).toBe("meta");
    expect(sectionOf("/tools/matchups")).toBe("meta");
    expect(sectionOf("/tools/build")).toBe("tools");
    expect(sectionOf("/esports/mpl-id-s15")).toBe("news");
    expect(sectionOf("/community/teammates")).toBe("community");
    expect(sectionOf("/")).toBeNull();
  });

  it("gives every footer column links", () => {
    for (const c of FOOTER) expect(c.links.length).toBeGreaterThan(0);
  });
});
