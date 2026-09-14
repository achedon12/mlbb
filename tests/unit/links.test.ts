import { describe, expect, it } from "vitest";
import { prefix } from "@/i18n/links";

describe("prefix", () => {
  it("adds the locale to site URLs", () => {
    expect(prefix("/heroes", "fr")).toBe("/fr/heroes");
    expect(prefix("/heroes/aamon", "en")).toBe("/en/heroes/aamon");
    expect(prefix("/items#antique-cuirass", "it")).toBe("/it/items#antique-cuirass");
    expect(prefix("/compare?a=khufra", "es")).toBe("/es/compare?a=khufra");
  });

  it("returns the locale home page for the root", () => {
    expect(prefix("/", "fr")).toBe("/fr");
  });

  it("leaves already prefixed URLs untouched", () => {
    expect(prefix("/fr/heroes", "en")).toBe("/fr/heroes");
    expect(prefix("/en", "fr")).toBe("/en");
  });

  it("leaves non-localized and external URLs untouched", () => {
    for (const href of ["/api/v1/heroes", "/visuels/rangs/epique.webp", "/feed.xml", "/sw.js", "https://github.com/achedon12/mlbb", "//cdn.exemple.fr/a.png", "#contenu"]) {
      expect(prefix(href, "fr")).toBe(href);
    }
  });

  it("does not mistake a path that starts like a locale", () => {
    expect(prefix("/french-page", "fr")).toBe("/fr/french-page");
  });
});
