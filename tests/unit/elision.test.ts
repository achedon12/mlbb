import { describe, expect, it } from "vitest";
import { createTFrom } from "@/i18n/t";
import { createT } from "@/i18n/translations";

describe("French elision in interpolated messages", () => {
  const messages = { a: "Les données de {name}", b: "Voir le détail de {month}", c: "Plus fort que {name}", d: "De {name} à {other}" };

  it("elides de and que before a vowel when asked to", () => {
    const t = createTFrom(messages, undefined, { elide: true });
    expect(t("a", { name: "Aamon" })).toBe("Les données d'Aamon");
    expect(t("b", { month: "octobre 2026" })).toBe("Voir le détail d'octobre 2026");
    expect(t("c", { name: "Esmeralda" })).toBe("Plus fort qu'Esmeralda");
    expect(t("d", { name: "Uranus", other: "Zilong" })).toBe("D'Uranus à Zilong");
  });

  it("keeps de before a consonant, h, y or a number", () => {
    const t = createTFrom(messages, undefined, { elide: true });
    expect(t("a", { name: "Layla" })).toBe("Les données de Layla");
    expect(t("a", { name: "Harith" })).toBe("Les données de Harith");
    expect(t("a", { name: "Yu Zhong" })).toBe("Les données de Yu Zhong");
    expect(t("a", { name: 8 })).toBe("Les données de 8");
  });

  it("leaves other languages alone", () => {
    const t = createTFrom({ a: "Datos de {name}" });
    expect(t("a", { name: "Aamon" })).toBe("Datos de Aamon");
    expect(createT("es")("pages.heroPreview.skins", { name: "Aamon", n: 3 })).not.toContain("d'Aamon");
  });

  it("is on for the French catalogue", () => {
    expect(createT("fr")("pages.heroPreview.skins", { name: "Aamon", n: 3 })).toBe("Skins d'Aamon (3) :");
  });
});
