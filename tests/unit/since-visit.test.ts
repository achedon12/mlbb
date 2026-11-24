import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_GAP_MS, isEmpty, sinceVisit, touchVisit, type SinceDigest } from "@/lib/since-visit";
import { sinceDigest } from "@/lib/since-visit-server";

const digest: SinceDigest = {
  measured: "2026-11-23",
  patches: [
    { version: "2.1.40", date: "2026-11-18" },
    { version: "2.1.30", date: "2026-10-28" },
  ],
  skins: [
    { date: "2026-11-20", name: "Newest", hero: "Layla", href: "/heroes/layla/skins#skin-newest" },
    { date: "2026-11-01", name: "Older", hero: "Miya", href: "/heroes/miya/skins#skin-older" },
  ],
  tiers: [
    { date: "2026-11-22", n: 1, top: [{ slug: "a", name: "A", before: "A", after: "S" }] },
    { date: "2026-11-15", n: 4, top: [{ slug: "b", name: "B", before: "B", after: "S" }] },
    { date: "2026-11-01", n: 9, top: [] },
  ],
  events: [
    { month: "2026-12", date: "2026-11-21", announced: true },
    { month: "2026-11", date: "2026-11-01", announced: false },
  ],
};

describe("sinceVisit", () => {
  it("lists what came out after the last visit", () => {
    const s = sinceVisit(digest, "2026-11-16");
    expect(s.patch).toEqual({ version: "2.1.40" });
    expect(s.skins).toEqual({ n: 1, latest: digest.skins[0] });
    expect(s.tiers?.n).toBe(4);
    expect(s.events).toEqual({ month: "2026-12", announced: true });
  });

  it("counts every skin since a visit further back, the newest first", () => {
    const s = sinceVisit(digest, "2026-10-20");
    expect(s.patch?.version).toBe("2.1.40");
    expect(s.skins?.n).toBe(2);
    expect(s.skins?.latest.name).toBe("Newest");
    // Older than the history kept: the oldest day stands in.
    expect(s.tiers?.n).toBe(9);
  });

  it("says nothing to a visitor already up to date", () => {
    const s = sinceVisit(digest, "2026-11-23");
    expect(isEmpty(s)).toBe(true);
  });
});

describe("touchVisit", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns nothing on a first visit, then the end of the previous visit", () => {
    const t0 = Date.parse("2026-11-20T10:00:00Z");
    expect(touchVisit(t0)).toBeNull();
    // Same visit: still no previous one.
    expect(touchVisit(t0 + 10 * 60_000)).toBeNull();
    const back = t0 + 10 * 60_000 + SESSION_GAP_MS + 1;
    expect(touchVisit(back)).toBe(new Date(t0 + 10 * 60_000).toISOString());
    // Browsing on: the reference does not move.
    expect(touchVisit(back + 60_000)).toBe(new Date(t0 + 10 * 60_000).toISOString());
  });

  it("renders without storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(touchVisit()).toBeNull();
  });
});

describe("sinceDigest", () => {
  it("builds a small digest from the site data", () => {
    const d = sinceDigest();
    expect(d.tiers).toHaveLength(30);
    expect(d.skins.length).toBeLessThanOrEqual(60);
    expect(d.patches.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(d).length).toBeLessThan(20_000);
    for (const s of d.skins) expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
