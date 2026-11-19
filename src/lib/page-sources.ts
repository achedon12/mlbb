import itemNames from "@/data/item-names.json";

/**
 * Where the figures of a data page come from, as the sync reads them
 * (`scripts/sync.mjs`):
 *
 * - **the Fandom wiki** (`Module:Hero/data`, `Module:Equipment/data`, each
 *   hero's page for its `{{Ability}}` skills and lore, the `File:` pages of
 *   every visual, `Category:Patch Notes`);
 * - **Liquipedia** (`{{Infobox hero}}` base stats, item pages for the price
 *   and the removed status, the patch list and the notes Fandom lacks);
 * - **the community API arena.rone.dev** (Moonton's official hero sheets for
 *   the skill texts, ranked match rates, counters and played builds);
 * - **the site itself** for what is written by hand (emblem and spell
 *   descriptions in `src/data/emblems.ts`) or computed (the tiers).
 *
 * Pure: the component renders the rows, this module decides them.
 */

export const SOURCE_HOMES = {
  fandom: "https://mobilelegends.fandom.com",
  liquipedia: "https://liquipedia.net/mobilelegends",
  stats: "https://arena.rone.dev",
} as const;

/** Proper names, the same in every language. */
export const SOURCE_NAMES: Record<keyof typeof SOURCE_HOMES, string> = {
  fandom: "MLBB Wiki (Fandom)",
  liquipedia: "Liquipedia",
  stats: "arena.rone.dev",
};

export type SourceKey = keyof typeof SOURCE_HOMES | "site";

/** A page of a wiki, as the sync asks for it: spaces as underscores. */
export const fandomPage = (title: string) => `${SOURCE_HOMES.fandom}/wiki/${encodeURI(title.replace(/ /g, "_"))}`;
export const liquipediaPage = (title: string) => `${SOURCE_HOMES.liquipedia}/${encodeURI(title.replace(/ /g, "_"))}`;

/** Liquipedia's title for an item, under the same table as `scripts/items.mjs`. */
export const liquipediaItemTitle = (name: string): string =>
  (itemNames.liquipediaTitles as Record<string, string>)[name] ?? name;

export interface SourceRef {
  key: SourceKey;
  /** The precise page read for this one, when there is one. */
  page?: { href: string; label: string };
}

export interface SourceRow {
  /** Message key under `pages.sources.rows`: what the row feeds. */
  topic: string;
  sources: SourceRef[];
}

/** Which dates the block gives: last full sync, rate measurement. */
export type SourceDate = "synced" | "measured";

export type PageSources =
  | { kind: "hero"; name: string }
  | { kind: "item"; name: string }
  | { kind: "emblem" }
  | { kind: "spell" }
  | { kind: "ranking" }
  | { kind: "patches" }
  | { kind: "patch" };

export function pageSources(p: PageSources): { rows: SourceRow[]; dates: SourceDate[] } {
  switch (p.kind) {
    case "hero":
      return {
        rows: [
          {
            topic: "heroBase",
            sources: [
              { key: "fandom", page: { href: fandomPage(p.name), label: p.name } },
              { key: "liquipedia", page: { href: liquipediaPage(p.name), label: p.name } },
            ],
          },
          { topic: "heroMeasures", sources: [{ key: "stats" }] },
        ],
        dates: ["synced", "measured"],
      };
    case "item": {
      const lp = liquipediaItemTitle(p.name);
      return {
        rows: [
          {
            topic: "item",
            sources: [
              { key: "fandom", page: { href: fandomPage("Equipment"), label: "Equipment" } },
              { key: "liquipedia", page: { href: liquipediaPage(lp), label: lp } },
            ],
          },
          { topic: "usage", sources: [{ key: "stats" }] },
        ],
        dates: ["synced", "measured"],
      };
    }
    case "emblem":
    case "spell":
      return {
        rows: [
          { topic: "sheet", sources: [{ key: "site" }] },
          { topic: "usage", sources: [{ key: "stats" }] },
          { topic: "icons", sources: [{ key: "fandom" }] },
        ],
        dates: ["synced", "measured"],
      };
    case "ranking":
      return {
        rows: [
          { topic: "rates", sources: [{ key: "stats" }] },
          { topic: "tiers", sources: [{ key: "site" }] },
        ],
        dates: ["measured"],
      };
    case "patches":
      return {
        rows: [
          {
            topic: "patches",
            sources: [
              { key: "liquipedia" },
              { key: "fandom", page: { href: fandomPage("Category:Patch Notes"), label: "Patch Notes" } },
            ],
          },
        ],
        dates: ["synced"],
      };
    case "patch":
      // The patch's own credit (`PatchCredit`) names and links its pages.
      return { rows: [], dates: ["synced"] };
  }
}

/** The licence line applies as soon as a row takes text from a wiki (icons are not text). */
export const fromWikis = (rows: SourceRow[]): boolean =>
  rows.some((r) => r.topic !== "icons" && r.sources.some((s) => s.key === "fandom" || s.key === "liquipedia"));
