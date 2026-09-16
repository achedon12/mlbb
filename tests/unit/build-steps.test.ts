import { describe, expect, it } from "vitest";
import { BUILD_STEPS, isFirstStep, isLastStep, stepBy } from "@/lib/build-steps";

describe("build simulator steps", () => {
  it("asks for the hero first and the battle spell last", () => {
    expect([...BUILD_STEPS]).toEqual(["hero", "items", "emblem", "spell"]);
    expect(isFirstStep("hero")).toBe(true);
    expect(isLastStep("spell")).toBe(true);
    expect(isFirstStep("items")).toBe(false);
    expect(isLastStep("emblem")).toBe(false);
  });

  it("moves one step at a time", () => {
    expect(stepBy("hero", 1)).toBe("items");
    expect(stepBy("items", 1)).toBe("emblem");
    expect(stepBy("emblem", 1)).toBe("spell");
    expect(stepBy("spell", -1)).toBe("emblem");
  });

  it("holds at both ends rather than wrapping around", () => {
    expect(stepBy("hero", -1)).toBe("hero");
    expect(stepBy("spell", 1)).toBe("spell");
  });
});
