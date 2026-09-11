import { describe, expect, it } from "vitest";
import { retirerBalises } from "../../scripts/balises.mjs";

describe("retirerBalises", () => {
  it("retire les balises et garde le texte", () => {
    expect(retirerBalises("Skin <b>Epic</b><br/> limite")).toBe("Skin Epic limite");
  });

  it("ne laisse pas se reformer une balise imbriquee", () => {
    for (const piege of ["<scr<b>ipt>alert(1)</script>", "<<x>script>alert(1)", "<<b>img src=x onerror=alert(1)>"]) {
      expect(retirerBalises(piege)).not.toMatch(/<[a-z/!?]/i);
    }
  });

  it("garde un chevron de texte", () => {
    expect(retirerBalises("PV < 30 % et 2 > 1")).toBe("PV < 30 % et 2 > 1");
  });

  it("accepte une valeur non textuelle", () => {
    expect(retirerBalises(42)).toBe("42");
  });
});
