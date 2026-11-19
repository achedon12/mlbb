import { describe, expect, it } from "vitest";
import { locs, problem } from "../../scripts/smoke.mjs";

const page = (inner: string) => `<!DOCTYPE html><html><body>${inner}<template>This page could not be found.</template></body></html>`;

describe("smoke test verdict", () => {
  it("accepts a full page with its expected text", () => {
    expect(problem({ status: 200, body: page("Ling") }, "Ling")).toBeNull();
  });
  it("refuses an error status, a cut page, an error screen or a missing text", () => {
    expect(problem({ status: 500, body: page("") })).toBe("HTTP 500");
    expect(problem({ status: 200, body: "<html><body>Ling" })).toMatch(/cut short/);
    expect(problem({ status: 200, body: page("Application error: a client-side exception") })).toMatch(/error screen/);
    expect(problem({ status: 200, body: page('"digest":"NEXT_HTTP_ERROR_FALLBACK;404"') })).toMatch(/error screen/);
    expect(problem({ status: 200, body: page("Fanny") }, "Ling")).toMatch(/missing/);
  });
  it("reads a sitemap's addresses", () => {
    expect(locs("<urlset><url><loc>https://mlbbdex.com/fr</loc></url><url><loc> https://mlbbdex.com/en </loc></url></urlset>")).toEqual(["https://mlbbdex.com/fr", "https://mlbbdex.com/en"]);
  });
});
