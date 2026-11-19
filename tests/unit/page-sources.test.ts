import { describe, expect, it } from "vitest";
import sync from "@/data/game/sync.json";
import { fandomPage, fromWikis, liquipediaItemTitle, liquipediaPage, pageSources, SOURCE_HOMES } from "@/lib/page-sources";
import fr from "@/i18n/messages/fr.json";

describe("page sources", () => {
  it("names the same hosts as the sync metadata", () => {
    expect(Object.values(SOURCE_HOMES).sort()).toEqual([...sync.sources].sort());
  });

  it("builds wiki addresses the way the sync asks for pages", () => {
    expect(fandomPage("Yi Sun-shin")).toBe("https://mobilelegends.fandom.com/wiki/Yi_Sun-shin");
    expect(liquipediaPage("Chang'e")).toBe("https://liquipedia.net/mobilelegends/Chang'e");
    expect(fandomPage("Category:Patch Notes")).toBe("https://mobilelegends.fandom.com/wiki/Category:Patch_Notes");
  });

  it("follows Liquipedia's item titles", () => {
    expect(liquipediaItemTitle("Magic Shoes")).toBe("Magic Boots");
    expect(liquipediaItemTitle("Blade of Despair")).toBe("Blade of Despair");
  });

  it("links a hero to its own wiki and Liquipedia pages, and dates both runs", () => {
    const { rows, dates } = pageSources({ kind: "hero", name: "Gusion" });
    expect(rows[0].sources.map((s) => s.page?.href)).toEqual([
      "https://mobilelegends.fandom.com/wiki/Gusion",
      "https://liquipedia.net/mobilelegends/Gusion",
    ]);
    expect(rows[1].sources).toEqual([{ key: "stats" }]);
    expect(dates).toEqual(["synced", "measured"]);
  });

  it("links an item to its Liquipedia page under Liquipedia's name", () => {
    const { rows } = pageSources({ kind: "item", name: "Magic Shoes" });
    expect(rows[0].sources[1].page?.href).toBe("https://liquipedia.net/mobilelegends/Magic_Boots");
  });

  it("gives rankings the measurement date only, and no wiki licence", () => {
    const { rows, dates } = pageSources({ kind: "ranking" });
    expect(dates).toEqual(["measured"]);
    expect(fromWikis(rows)).toBe(false);
  });

  it("does not count icons as wiki text", () => {
    expect(fromWikis([{ topic: "icons", sources: [{ key: "fandom" }] }])).toBe(false);
    expect(fromWikis(pageSources({ kind: "patches" }).rows)).toBe(true);
  });

  it("has a French message for every row", () => {
    const messages = fr.pages.sources as { rows: Record<string, string> };
    for (const kind of ["hero", "item", "emblem", "spell", "ranking", "patches", "patch"] as const) {
      for (const row of pageSources(kind === "hero" || kind === "item" ? { kind, name: "X" } : { kind }).rows) {
        expect(messages.rows[row.topic]).toBeTruthy();
      }
    }
  });
});
