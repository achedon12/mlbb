import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  const urls = sitemap().map((e) => String(e.url));

  it("includes the home page and main sections", () => {
    for (const path of ["", "/heroes", "/tier-list", "/compare", "/patch-notes"]) {
      expect(urls.some((u) => u.endsWith(path) || u.endsWith(`${path}`))).toBe(true);
    }
  });

  it("includes legal pages", () => {
    expect(urls.some((u) => u.endsWith("/legal"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/privacy"))).toBe(true);
  });

  it("lists hero pages", () => {
    expect(urls.some((u) => /\/heroes\/[a-z-]+$/.test(u))).toBe(true);
  });

  it("exposes neither the account nor the login page", () => {
    expect(urls.some((u) => u.endsWith("/account"))).toBe(false);
    expect(urls.some((u) => u.endsWith("/login"))).toBe(false);
  });

  it("contains no duplicates", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});
