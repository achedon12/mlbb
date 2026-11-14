import { describe, expect, it } from "vitest";
import {
  detect,
  MAX_SKINS,
  pendingTargets,
  plan,
  type Candidate,
  type GuildTarget,
  type Sources,
  type StoredAnnouncement,
} from "@/lib/bot/announcements";
import { announcementSources } from "@/lib/bot/announcement-store";

const TODAY = "2026-11-14";

function sources(): Sources {
  return {
    patches: [
      { version: "2.2.16", title: "Patch Notes 2.2.16", date: "2026-10-03", balance: { buff: 13, nerf: 6, adjust: 5 }, heroes: ["aulus"] },
      { version: "2.2.12", title: "Patch Notes 2.2.12", date: "2026-09-01", balance: { buff: 1, nerf: 1, adjust: 1 }, heroes: [] },
    ],
    skins: [
      { hero: "miya", heroName: "Miya", id: "1", name: "New", release: "2026-11-10", image: null, anchor: "new" },
      { hero: "miya", heroName: "Miya", id: "2", name: "Month only", release: "2026-10", image: null, anchor: "" },
      { hero: "miya", heroName: "Miya", id: "3", name: "Old", release: "2026-09-01", image: null, anchor: "" },
      { hero: "miya", heroName: "Miya", id: "4", name: "Future", release: "2026-12-01", image: null, anchor: "" },
      { hero: "miya", heroName: "Miya", id: "5", name: "Year only", release: "2026", image: null, anchor: "" },
    ],
    months: [
      { month: "2026-12", total: 3, starlight: [] },
      { month: "2026-11", total: 5, starlight: ["Miya — New"] },
      { month: "2026-10", total: 4, starlight: [] },
    ],
    advance: [{ version: "2.2.20", title: "Advance 2.2.20", date: "2026-11-01" }],
    tournaments: [
      { slug: "mpl-id-s18", name: "MPL ID S18", champion: "Bigetron", endDate: "2026-11-08", lastMatch: "2026-11-08" },
      { slug: "msc-2026", name: "MSC 2026", champion: "Team Spirit", endDate: "2026-08-01", lastMatch: "2026-08-01" },
      { slug: "m8", name: "M8", champion: null, endDate: "2027-01-23", lastMatch: null },
    ],
  };
}

const keys = (list: Candidate[], type: string) => list.filter((c) => c.type === type).map((c) => c.key);

describe("announcement detection", () => {
  it("finds the latest patch, recent skins, current months, a test build ahead, fresh champions", () => {
    const found = detect(sources(), TODAY);
    expect(keys(found, "patches")).toEqual(["2.2.16"]);
    expect(keys(found, "skins")).toEqual(["miya:1", "miya:2"]);
    expect(keys(found, "events")).toEqual(["2026-12", "2026-11"]);
    expect(keys(found, "advanceServer")).toEqual(["2.2.20"]);
    expect(keys(found, "esports")).toEqual(["mpl-id-s18:champion"]);
    const patch = found.find((c) => c.type === "patches")!;
    expect(patch.payload).toMatchObject({ url: "/patch-notes/2.2.16", counts: { buff: 13, nerf: 6, adjust: 5 } });
  });

  it("skips an Advance Server build that is not ahead of the live patch", () => {
    const s = sources();
    s.advance = [{ version: "1.8.92", title: "Old", date: "2024-06-15" }];
    expect(keys(detect(s, TODAY), "advanceServer")).toEqual([]);
  });

  it("caps a skin wave", () => {
    const s = sources();
    s.skins = Array.from({ length: 40 }, (_, i) => ({
      hero: "miya", heroName: "Miya", id: String(i), name: `S${i}`, release: "2026-11-01", image: null, anchor: "",
    }));
    expect(keys(detect(s, TODAY), "skins")).toHaveLength(MAX_SKINS);
  });

  it("is idempotent: a second run against the same data inserts nothing", () => {
    // The database, as the unique (type, key) index sees it.
    const stored = new Map<string, boolean>();
    const run = () => {
      const rows = plan(detect(sources(), TODAY), new Set([...stored.keys()].map((k) => k.split("|")[0])));
      let created = 0;
      for (const r of rows) {
        const id = `${r.type}|${r.key}`;
        if (stored.has(id)) continue; // skipDuplicates
        stored.set(id, r.silent);
        created += 1;
      }
      return created;
    };
    expect(run()).toBeGreaterThan(0);
    expect(run()).toBe(0);
    expect(run()).toBe(0);
  });

  it("records a type seen for the first time as a silent baseline, later ones as news", () => {
    const first = plan(detect(sources(), TODAY), new Set());
    expect(first.every((r) => r.silent)).toBe(true);
    const later = plan(detect(sources(), TODAY), new Set(["patches"]));
    expect(later.find((r) => r.type === "patches")!.silent).toBe(false);
    expect(later.find((r) => r.type === "skins")!.silent).toBe(true);
  });

  it("removes duplicates within one detection", () => {
    const c: Candidate = { type: "patches", key: "1", payload: {} };
    expect(plan([c, { ...c }], new Set(["patches"]))).toHaveLength(1);
  });

  it("reads the site's real data without throwing", () => {
    const found = detect(announcementSources(), TODAY);
    expect(found.some((c) => c.type === "patches")).toBe(true);
    for (const c of found) expect(c.key.length).toBeLessThanOrEqual(120);
  });
});

describe("pending deliveries", () => {
  const announcement: StoredAnnouncement = { id: 7, type: "patches", key: "2.2.16", payload: {}, createdAt: new Date("2026-11-10T00:00:00Z") };
  const guild = (id: string, settings: GuildTarget["settings"], joinedAt = "2026-11-01T00:00:00Z"): GuildTarget => ({
    guildId: id,
    locale: "fr",
    joinedAt: new Date(joinedAt),
    settings,
  });

  it("targets servers with a channel for the type, not failing, there before the news, not yet delivered", () => {
    const guilds = [
      guild("1", { patchesChannelId: "c1", patchesRoleId: "r1", patchesFailing: false }),
      guild("2", { patchesChannelId: null }),
      guild("3", { patchesChannelId: "c3", patchesFailing: true }),
      guild("4", { patchesChannelId: "c4" }, "2026-11-12T00:00:00Z"),
      guild("5", { patchesChannelId: "c5", patchesRoleId: null }),
      guild("6", { skinsChannelId: "c6" }),
    ];
    const pending = pendingTargets([announcement], guilds, new Set(["7|5"]));
    expect(pending).toHaveLength(1);
    expect(pending[0].targets).toEqual([{ guildId: "1", channelId: "c1", roleId: "r1", locale: "fr" }]);
  });

  it("caps one answer and leaves out announcements with nobody left", () => {
    const guilds = Array.from({ length: 10 }, (_, i) => guild(String(i), { patchesChannelId: `c${i}` }));
    expect(pendingTargets([announcement], guilds, new Set(), 4)[0].targets).toHaveLength(4);
    const all = new Set(guilds.map((g) => `7|${g.guildId}`));
    expect(pendingTargets([announcement], guilds, all)).toEqual([]);
  });
});
