import { describe, expect, it } from "vitest";
import { createT } from "@/i18n/translations";
import { LOCALES } from "@/i18n/config";
import { dexReaction } from "@/lib/dex-reaction";

describe("dexReaction", () => {
  const t = createT("fr");

  it("cheers at the top of the tier list", () => {
    for (const tier of ["S+", "S"] as const) {
      const line = dexReaction(t, "Miya", tier);
      expect(line?.pose).toBe("victoire");
      expect(line?.text).toContain("Miya");
      expect(line?.text).toContain(tier);
    }
  });

  it("worries at its foot", () => {
    const line = dexReaction(t, "Miya", "C");
    expect(line?.pose).toBe("surpris");
    expect(line?.text).toContain("Miya");
  });

  it("stays quiet in between", () => {
    expect(dexReaction(t, "Miya", "A")).toBeNull();
    expect(dexReaction(t, "Miya", "B")).toBeNull();
  });

  it("has its lines in every language, variables kept", () => {
    for (const locale of LOCALES) {
      const tl = createT(locale);
      expect(tl("dex.heroTop", { name: "Miya", tier: "S" })).toMatch(/Miya.*S|S.*Miya/);
      expect(tl("dex.heroLow", { name: "Miya" })).toContain("Miya");
    }
  });
});
