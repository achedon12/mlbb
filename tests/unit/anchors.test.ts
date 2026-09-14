import { describe, expect, it } from "vitest";
import { resolveAnchor } from "@/lib/anchors";

describe("resolveAnchor", () => {
  const aliases = { histoire: "story", contres: "counters", "rang-": "rank-" };

  it("maps an old anchor to the current one, with or without #", () => {
    expect(resolveAnchor("#histoire", aliases)).toBe("story");
    expect(resolveAnchor("contres", aliases)).toBe("counters");
  });

  it("maps a prefixed old anchor and keeps its suffix", () => {
    expect(resolveAnchor("#rang-mythic", aliases)).toBe("rank-mythic");
    expect(resolveAnchor("#rang-", aliases)).toBeNull();
  });

  it("leaves current and unknown anchors alone", () => {
    expect(resolveAnchor("#story", aliases)).toBeNull();
    expect(resolveAnchor("#rank-mythic", aliases)).toBeNull();
    expect(resolveAnchor("", aliases)).toBeNull();
    expect(resolveAnchor("#toString", aliases)).toBeNull();
  });
});
