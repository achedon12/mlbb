import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audience measurement: what reaches Matomo's queue, and that nothing does
 * when the tracker is not configured. The module reads its settings on
 * import, hence a fresh import per case.
 */
type Queue = unknown[][];

async function load(configured: boolean) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_MATOMO_URL", configured ? "https://stats.example.org/" : "");
  vi.stubEnv("NEXT_PUBLIC_MATOMO_SITE_ID", configured ? "13" : "");
  return import("@/lib/analytics");
}

const queue = () => (globalThis as unknown as { window: { _paq?: Queue } }).window._paq;

beforeEach(() => {
  vi.stubGlobal("window", {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("analytics", () => {
  it("queues nothing when Matomo is not configured", async () => {
    const a = await load(false);
    a.trackPageView({ url: "https://mlbbdex.com/en/heroes", title: "Heroes" });
    a.trackEvent("Favourites", "Add", "layla");
    expect(queue()).toBeUndefined();
  });

  it("sends a client navigation with its address, title and origin", async () => {
    const a = await load(true);
    a.trackPageView({ url: "https://mlbbdex.com/en/items", referrer: "https://mlbbdex.com/en", title: "Items" });
    expect(queue()).toEqual([
      ["setReferrerUrl", "https://mlbbdex.com/en"],
      ["setCustomUrl", "https://mlbbdex.com/en/items"],
      ["setDocumentTitle", "Items"],
      ["trackPageView"],
    ]);
  });

  it("leaves the referrer to Matomo on the landing page", async () => {
    const a = await load(true);
    a.trackPageView({ url: "https://mlbbdex.com/en", title: "Home" });
    expect(queue()?.[0]).toEqual(["setCustomUrl", "https://mlbbdex.com/en"]);
  });

  it("drops the trailing arguments an event does not have", async () => {
    const a = await load(true);
    a.trackEvent("App", "Install");
    a.trackEvent("Favourites", "Add", "layla");
    a.trackEvent("Notifications", "Enable", undefined, 3);
    expect(queue()).toEqual([
      ["trackEvent", "App", "Install"],
      ["trackEvent", "Favourites", "Add", "layla"],
      ["trackEvent", "Notifications", "Enable", "", 3],
    ]);
  });

  it("normalises search terms and skips empty ones", async () => {
    const a = await load(true);
    a.trackSiteSearch("  Flicker ", "spell", 2);
    a.trackSiteSearch("   ", false, 0);
    expect(queue()).toEqual([["trackSiteSearch", "flicker", "spell", 2]]);
  });

  it("files a missing page under Matomo's 404 convention", async () => {
    const a = await load(true);
    expect(a.notFoundTitle("/en/heros", "https://google.com/")).toBe(
      "404/URL = %2Fen%2Fheros/From = https%3A%2F%2Fgoogle.com%2F",
    );
  });
});
