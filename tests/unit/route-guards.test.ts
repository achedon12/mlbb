import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pages outside the build's list are rendered on their first request
 * (src/lib/prerender.ts). A dynamic route must therefore answer an unknown
 * value itself: with `dynamicParams = false`, or by checking it against its
 * data and rendering the 404 page (`<NotFoundPage />`, or `notFound()` in a
 * dynamic page) or redirecting. Otherwise a made-up address
 * renders a real-looking page, which the cache would keep.
 */
const ROOT = join(process.cwd(), "src", "app", "[locale]");

function dynamicPages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return dynamicPages(path);
    return name === "page.tsx" && relative(ROOT, dir).includes("[") ? [path] : [];
  });
}

describe("dynamic routes", () => {
  it("answer an unknown parameter with a 404 or a redirect", () => {
    const unguarded = dynamicPages(ROOT).filter((file) => {
      const source = readFileSync(file, "utf8");
      return !/dynamicParams = false/.test(source) && !/<NotFoundPage \/>|\bnotFound\(\)|\bpermanentRedirect\(|\bredirect\(/.test(source);
    });
    expect(unguarded.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
