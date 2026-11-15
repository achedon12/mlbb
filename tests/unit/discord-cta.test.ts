import { describe, expect, it } from "vitest";
import { bandContext, discordContext } from "@/lib/discord-cta";

describe("discordContext", () => {
  it("picks the invitation that fits the page", () => {
    expect(discordContext("/fr/heroes/ling")).toBe("hero");
    expect(discordContext("/en/heroes/ling/counters")).toBe("hero");
    expect(discordContext("/en/heroes/ling/skins")).toBe("skins");
    expect(discordContext("/en/skins")).toBe("skins");
    expect(discordContext("/fil/tier-list/mythic")).toBe("tier");
    expect(discordContext("/en/meta")).toBe("tier");
    expect(discordContext("/id/community/teammates")).toBe("teammates");
    expect(discordContext("/ru/patch-notes/2-2-16")).toBe("patch");
    expect(discordContext("/fr/events")).toBe("patch");
    expect(discordContext("/th/mlbbdle")).toBe("daily");
    expect(discordContext("/pt/esports/m8")).toBe("esports");
    expect(discordContext("/en/tools/nickname")).toBe("nickname");
    expect(discordContext("/en/tools/account-value")).toBe("value");
    expect(discordContext("/en/tools/collection")).toBe("value");
    expect(discordContext("/en/draft")).toBe("tools");
    expect(discordContext("/en/compare/ling-vs-fanny")).toBe("tools");
    expect(discordContext("/en/tools/team")).toBe("tools");
  });

  it("falls back to the general invitation elsewhere, the hero list included", () => {
    expect(discordContext("/fr")).toBe("default");
    expect(discordContext("/fr/heroes")).toBe("default");
    expect(discordContext("/")).toBe("default");
  });
});

describe("bandContext", () => {
  it("shows the band on the strategic pages", () => {
    expect(bandContext("/en/tools/nickname")).toBe("nickname");
    expect(bandContext("/en/heroes/ling/skins")).toBe("skins");
    expect(bandContext("/en/heroes/ling/counters")).toBe("hero");
    expect(bandContext("/en/quiz")).toBe("daily");
    expect(bandContext("/en/draft")).toBe("tools");
    expect(bandContext("/en/statistics")).toBe("tier");
    expect(bandContext("/en/heroes")).toBe("default");
  });

  it("stays away from pages that already invite, and from the others", () => {
    for (const p of ["/en", "/en/heroes/ling", "/en/tier-list", "/en/tier-list/mythic", "/en/mlbbdle", "/en/patch-notes/2-2-16", "/en/community", "/en/bot", "/en/about", "/en/legal"])
      expect(bandContext(p)).toBeNull();
  });
});
