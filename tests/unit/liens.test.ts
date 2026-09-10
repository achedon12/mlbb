import { describe, expect, it } from "vitest";
import { prefixer } from "@/i18n/liens";

describe("prefixer", () => {
  it("ajoute la langue aux adresses du site", () => {
    expect(prefixer("/heroes", "fr")).toBe("/fr/heroes");
    expect(prefixer("/heroes/aamon", "en")).toBe("/en/heroes/aamon");
    expect(prefixer("/items#antique-cuirass", "it")).toBe("/it/items#antique-cuirass");
    expect(prefixer("/compare?a=khufra", "es")).toBe("/es/compare?a=khufra");
  });

  it("renvoie l'accueil de la langue pour la racine", () => {
    expect(prefixer("/", "fr")).toBe("/fr");
  });

  it("laisse les adresses deja prefixees", () => {
    expect(prefixer("/fr/heroes", "en")).toBe("/fr/heroes");
    expect(prefixer("/en", "fr")).toBe("/en");
  });

  it("laisse les adresses hors langue et externes", () => {
    for (const href of ["/api/v1/heros", "/visuels/rangs/epique.webp", "/feed.xml", "/sw.js", "https://github.com/achedon12/mlbb", "//cdn.exemple.fr/a.png", "#contenu"]) {
      expect(prefixer(href, "fr")).toBe(href);
    }
  });

  it("ne confond pas un chemin qui commence comme une langue", () => {
    expect(prefixer("/french-page", "fr")).toBe("/fr/french-page");
  });
});
