import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { notFoundMetadata } from "@/i18n/seo";

/**
 * A bare `notFound()` in a prerendered page gives a 404 whose server HTML is
 * Next's empty error shell: such pages return `<NotFoundPage />` instead (see
 * `src/components/not-found-page.tsx`), and their metadata the 404's.
 *
 * Dynamic pages keep the bare call: a dynamic render answers 200 once its
 * shell is out, and their 404 status matters more than the body. Any new
 * page calling `notFound()` lands here.
 */
const ROOT = join(process.cwd(), "src/app/[locale]");

/** Rendered on every request (cookies, `force-dynamic`), see the build's route list. */
const DYNAMIC = ["account/", "bot/admin/", "bot/dashboard/", "builds/", "community/", "login/", "u/"];
/** The language root: an unknown language never gets past the layout's own check. */
const ALLOWED = new Set(["page.tsx"]);

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === "page.tsx" ? [relative(ROOT, path)] : [];
  });
}

const all = pages(ROOT);
const prerendered = all.filter((p) => !ALLOWED.has(p) && !DYNAMIC.some((d) => p.startsWith(d)));

describe("404 pages", () => {
  it("finds the pages", () => {
    expect(prerendered.length).toBeGreaterThan(40);
    expect(prerendered).toContain("heroes/[slug]/page.tsx");
  });

  it("prerendered pages render the 404 page instead of a bare notFound()", () => {
    // A call, not a mention in a comment (`notFound()`).
    const bare = prerendered.filter((p) => /(?<!`)\bnotFound\(\)/.test(readFileSync(join(ROOT, p), "utf8")));
    expect(bare).toEqual([]);
  });

  it("a page rendering the 404 page gives its metadata the 404's", () => {
    const missing = prerendered.filter((p) => {
      const source = readFileSync(join(ROOT, p), "utf8");
      if (!source.includes("<NotFoundPage />")) return false;
      return /export (async )?function generateMetadata/.test(source) && !source.includes("notFoundMetadata(");
    });
    expect(missing).toEqual([]);
  });
});

describe("notFoundMetadata", () => {
  it("is the 404 title in the page's language, noindex, with no canonical nor hreflang", () => {
    expect(notFoundMetadata("fr")).toEqual({
      title: "Page introuvable",
      robots: { index: false, follow: true },
      alternates: { canonical: null, languages: {} },
    });
    expect(notFoundMetadata("it").title).toBe("Pagina non trovata");
  });

  it("is empty for an unknown language", () => {
    expect(notFoundMetadata("xx")).toEqual({});
  });
});
