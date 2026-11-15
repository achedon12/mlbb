import { describe, expect, it } from "vitest";
import { discordContext } from "@/lib/discord-cta";

describe("discordContext", () => {
  it("picks the invitation that fits the page", () => {
    expect(discordContext("/fr/heroes/ling")).toBe("hero");
    expect(discordContext("/en/heroes/ling/counters")).toBe("hero");
    expect(discordContext("/fil/tier-list/mythic")).toBe("tier");
    expect(discordContext("/en/meta")).toBe("tier");
    expect(discordContext("/id/community/teammates")).toBe("teammates");
    expect(discordContext("/ru/patch-notes/2-2-16")).toBe("patch");
    expect(discordContext("/th/mlbbdle")).toBe("daily");
    expect(discordContext("/pt/esports/m8")).toBe("esports");
  });

  it("falls back to the general invitation elsewhere, the hero list included", () => {
    expect(discordContext("/fr")).toBe("default");
    expect(discordContext("/fr/heroes")).toBe("default");
    expect(discordContext("/en/tools/account-value")).toBe("default");
    expect(discordContext("/")).toBe("default");
  });
});
