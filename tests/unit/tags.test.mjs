import { describe, expect, it } from "vitest";
import { removeComments, removeTags } from "../../scripts/tags.mjs";

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

describe("removeComments", () => {
  it("removes comments and keeps the rest", () => {
    expect(removeComments("a<!-- x -->b<!--\nmulti\nline-->c")).toBe("abc");
  });

  it("does not let a comment re-form from the pieces of a removed one", () => {
    for (const trap of ["<!<!---->-- x -->", "<!-<!-- a -->- b -->", "<<!-- -->!-- c --><!-- -->"]) {
      expect(removeComments(trap)).not.toContain("<!--");
    }
    expect(removeComments("<!<!---->-- x -->after")).toBe("after");
  });

  it("drops an unclosed comment to the end, as MediaWiki does", () => {
    expect(removeComments("kept <!-- never closed")).toBe("kept ");
  });

  it("leaves text without comments untouched", () => {
    expect(removeComments("HP < 30 -> 40 <!- not a comment")).toBe("HP < 30 -> 40 <!- not a comment");
  });
});
