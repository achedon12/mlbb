import { describe, expect, it } from "vitest";
import { celestialLevel } from "@/lib/account-level";

describe("celestialLevel", () => {
  it("is null up to level 30", () => {
    expect(celestialLevel(1)).toBeNull();
    expect(celestialLevel(30)).toBeNull();
  });
  it("counts celestial levels from 1 after level 30", () => {
    expect(celestialLevel(31)).toBe(1);
    expect(celestialLevel(115)).toBe(85);
  });
});
