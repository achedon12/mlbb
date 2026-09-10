import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  const urls = sitemap().map((e) => String(e.url));

  it("inclut l'accueil et les rubriques principales", () => {
    for (const chemin of ["", "/heroes", "/tier-list", "/compare", "/patch-notes"]) {
      expect(urls.some((u) => u.endsWith(chemin) || u.endsWith(`${chemin}`))).toBe(true);
    }
  });

  it("inclut les pages legales", () => {
    expect(urls.some((u) => u.endsWith("/legal"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/privacy"))).toBe(true);
  });

  it("liste les fiches de heros", () => {
    expect(urls.some((u) => /\/heroes\/[a-z-]+$/.test(u))).toBe(true);
  });

  it("n'expose ni le compte ni la connexion", () => {
    expect(urls.some((u) => u.endsWith("/account"))).toBe(false);
    expect(urls.some((u) => u.endsWith("/login"))).toBe(false);
  });

  it("ne contient pas de doublon", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});
