import { describe, expect, it } from "vitest";
import { advanceDocumented } from "@/lib/advance-fresh";

describe("advanceDocumented", () => {
  const now = Date.parse("2026-11-19");
  it("puts forward a recently documented Advance Server", () => {
    expect(advanceDocumented(now, "2026-10-01")).toBe(true);
  });
  it("hides it once the sources stopped documenting it", () => {
    expect(advanceDocumented(now, "2024-06-15")).toBe(false);
    expect(advanceDocumented(now, "")).toBe(false);
  });
});
