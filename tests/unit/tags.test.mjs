import { describe, expect, it } from "vitest";
import { removeTags } from "../../scripts/tags.mjs";

describe("removeTags", () => {
  it("removes tags and keeps the text", () => {
    expect(removeTags("Skin <b>Epic</b><br/> limite")).toBe("Skin Epic limite");
  });

  it("does not let a nested tag re-form", () => {
    for (const trap of ["<scr<b>ipt>alert(1)</script>", "<<x>script>alert(1)", "<<b>img src=x onerror=alert(1)>"]) {
      expect(removeTags(trap)).not.toMatch(/<[a-z/!?]/i);
    }
  });

  it("keeps a literal angle bracket", () => {
    expect(removeTags("PV < 30 % et 2 > 1")).toBe("PV < 30 % et 2 > 1");
  });

  it("accepts a non-string value", () => {
    expect(removeTags(42)).toBe("42");
  });
});
