import { describe, expect, it } from "vitest";
import { nextTheme } from "@/components/theme-button";

describe("the header's theme button", () => {
  it("turns Auto, Light, Dark, then back to Auto", () => {
    expect(nextTheme("auto")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("auto");
  });
});
