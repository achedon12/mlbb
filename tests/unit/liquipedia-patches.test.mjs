import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  change,
  infobox,
  inline,
  liquipediaDetail,
  liquipediaList,
  liquipediaPages,
  liquipediaVersion,
  mergeDetail,
  mergeLists,
  templates,
} from "../../scripts/liquipedia-patches.mjs";
import { baseVersion, compareVersions as compareScripts, readVersion } from "../../scripts/patch-version.mjs";
import { compareVersions, newestFirst } from "@/lib/patch-version";

// Fixtures: Liquipedia patch pages (CC BY-SA 3.0), as `action=query` returns them.
const fixture = (name) => readFileSync(new URL(`../fixtures/liquipedia/${name}`, import.meta.url), "utf8");
const HOTFIX = fixture("patch-2.2.16a.wiki");
const REVAMP = fixture("patch-2.1.95-excerpt.wiki");
const url = (title) => `https://liquipedia.net/mobilelegends/${title.replace(/ /g, "_")}`;

describe("patch versions", () => {
  it("reads a version and its hotfix letter, in lower case", () => {
    expect(readVersion("Patch Notes 2.2.16")).toBe("2.2.16");
    expect(readVersion("Patch 2.2.16a")).toBe("2.2.16a");
    expect(readVersion("Patch 1.9.20B")).toBe("1.9.20b");
    expect(readVersion("Patch Notes 1.8.90 (Advanced Server)")).toBe("1.8.90");
    expect(readVersion("Patch 1.9.06")).toBe("1.9.06");
    expect(readVersion("Patch 1.5.0.2")).toBeNull();
    expect(readVersion("latest")).toBeNull();
    expect(baseVersion("2.2.16a")).toBe("2.2.16");
  });

  it.each([
    ["scripts", compareScripts],
    ["site", compareVersions],
  ])("sorts hotfixes right after their base build (%s)", (_, compare) => {
    const sorted = ["2.1.95a", "2.2.23", "2.2.16", "1.8.100", "2.2.16a", "2.1.95", "1.8.92", "2.2.16b"].sort(compare);
    expect(sorted).toEqual(["1.8.92", "1.8.100", "2.1.95", "2.1.95a", "2.2.16", "2.2.16a", "2.2.16b", "2.2.23"]);
    expect(compare("2.2.16a", "2.2.16A")).toBe(0);
    expect(compare("2.1.88", "1.9.47")).toBeGreaterThan(0);
  });

  it("orders patch objects newest first", () => {
    const list = [{ version: "2.2.16" }, { version: "2.2.23" }, { version: "2.2.16a" }].sort(newestFirst);
    expect(list.map((p) => p.version)).toEqual(["2.2.23", "2.2.16a", "2.2.16"]);
  });

  it("only takes Liquipedia's patch pages", () => {
    expect(liquipediaVersion("Patch 2.2.23")).toBe("2.2.23");
    expect(liquipediaVersion("Patch 1.4.94B")).toBe("1.4.94b");
    expect(liquipediaVersion("Patch Notes 1.4.94B")).toBeNull();
    expect(liquipediaVersion("Patches")).toBeNull();
  });
});

describe("wikitext", () => {
  it("splits templates on their top-level pipes only", () => {
    const [t] = templates("x {{Herobc/New |hero = Kaja |note = A {{HeroIcon|Kaja}} [[Kaja|K]] note |type = buff}} y");
    expect(t.name).toBe("Herobc/New");
    expect(t.params).toEqual({ hero: "Kaja", note: "A {{HeroIcon|Kaja}} [[Kaja|K]] note", type: "buff" });
  });

  it("renders inline wikitext as text or safe HTML", () => {
    expect(inline("{{HeroIcon|Kaja}} [[Kaja]], Nazar King . Bold '''A''' <br>B")).toBe("Kaja, Nazar King. Bold A\nB");
    expect(inline("'''Creep''' {{TextID|nerf}} 2 >> 3 <script>", { html: true })).toBe(
      "<b>Creep</b> <strong>▼ Nerf</strong> 2 → 3 &lt;script&gt;",
    );
  });

  it("splits a change line into before / after", () => {
    expect(change("Cooldown: 14-12s → 15s at all levels")).toEqual({ label: "Cooldown", before: "14-12s", after: "15s at all levels" });
    expect(change("40% → 30%")).toEqual({ label: null, before: "40%", after: "30%" });
    expect(change("DMG +14% → +18%, DMG Taken -8% → -12%")).toEqual({ text: "DMG +14% → +18%, DMG Taken -8% → -12%" });
    expect(change("Reduced the foreswing of the final hit.")).toEqual({ text: "Reduced the foreswing of the final hit." });
  });

  it("reads the infobox", () => {
    expect(infobox(HOTFIX)).toMatchObject({ release: "2026-10-14", previous: "2.2.16", next: "2.2.23", highlights: ["Hero Adjustments"] });
    expect(infobox(REVAMP)?.highlights[0]).toBe(
      "Revamped Hero Kaja, Nazar King. A highly mobile control Support who masters Primal Lightning to soar freely across the battlefield.",
    );
    expect(infobox("{{Infobox patch|release=2026-??-??}}")?.release).toBeNull();
    expect(infobox("no infobox")).toBeNull();
  });
});

describe("Liquipedia patch page", () => {
  const hotfix = liquipediaDetail(HOTFIX, { version: "2.2.16a", title: "Patch 2.2.16a", link: url("Patch 2.2.16a") });
  const revamp = liquipediaDetail(REVAMP, { version: "2.1.95", title: "Patch 2.1.95", link: url("Patch 2.1.95") });

  it("gives the release date and credits Liquipedia", () => {
    expect(hotfix).toMatchObject({ version: "2.2.16a", date: "2026-10-14", source: "liquipedia", liquipedia: url("Patch 2.2.16a") });
  });

  it("extracts hero adjustments in the Fandom notes' shape", () => {
    const aulus = hotfix.adjustments.find((a) => a.name === "Aulus");
    expect(aulus).toMatchObject({ type: "nerf", intro: "Reduced Aulus's sustainability while retaining his early-to-mid game burst potential." });
    expect(aulus.sections.map((s) => [s.category, s.name, s.type])).toEqual([
      ["Passive", "Fighting Spirit", "nerf"],
      ["Skill 1", "Aulus, Charge!", "nerf"],
      ["Ultimate", "Undying Fury", "buff"],
    ]);
    expect(aulus.sections[1].changes).toEqual([{ label: "Cooldown", before: "14-12s", after: "15s at all levels" }]);
    expect(aulus.sections[2].changes.at(-1)).toEqual({ text: "Reduced the foreswing of the final hit." });
    expect(hotfix.balance).toEqual({
      buff: hotfix.adjustments.filter((a) => a.type === "buff").length,
      nerf: hotfix.adjustments.filter((a) => a.type === "nerf").length,
      adjust: hotfix.adjustments.filter((a) => a.type === "adjust").length,
    });
    expect(hotfix.sections.find((s) => s.role === "adjustments")).toMatchObject({ title: "I. Hero Adjustments", html: "" });
  });

  it("turns a revamp into a showcase, not an adjustment", () => {
    expect(revamp.newHeroes).toHaveLength(1);
    expect(revamp.newHeroes[0]).toMatchObject({
      name: "Kaja",
      epithet: "Nazar King",
      feature: "A highly mobile control Support who masters Primal Lightning to soar freely across the battlefield.",
    });
    expect(revamp.newHeroes[0].skills.map((s) => [s.role, s.name])).toEqual([
      ["Passive", "Wings of Lightning"],
      ["Skill 1", "Ring of Order v2"],
      ["Skill 2", "Soaring Wings"],
      ["Ultimate", "Divine Binding"],
    ]);
    expect(revamp.adjustments.map((a) => a.name)).toEqual(["Gord", "Novaria"]);
  });

  it("keeps the designers' note and the free sections, with their sub-headings", () => {
    const titles = revamp.sections.map((s) => [s.title, s.role]);
    expect(titles).toEqual([
      [null, null],
      ["From The Designers", null],
      ["I. Revamped Hero", "newHeroes"],
      ["II. Hero Adjustments", "adjustments"],
      ["III. Hero Adjustments", null],
      ["IV. System Adjustments", null],
    ]);
    expect(revamp.sections[1].html).toContain("<p>In this patch, we focused on adjusting the strength of some heroes in Brawl");
    // A section with no hero block keeps its text: the bug fix is not lost.
    expect(revamp.sections[4].html).toContain('<h4 id="bug-fixes">Bug Fixes</h4>');
    expect(revamp.sections[4].html).toContain("Fixed an issue where using Purify");
    expect(revamp.toc).toContainEqual({ level: 3, title: "A. Highlight Icons", anchor: "a-highlight-icons" });
  });

  it("hides an unclosed comment to the end of the page, as the wiki does", () => {
    const d = liquipediaDetail(`${REVAMP}\n<!--==V. Mode Adjustments==\nDraft`, { version: "2.1.95", title: "Patch 2.1.95", link: "" });
    expect(d.sections.map((s) => s.title)).not.toContain("V. Mode Adjustments");
    expect(JSON.stringify(d)).not.toContain("&lt;!--");
  });
});

describe("patch list", () => {
  const pages = [
    { title: "Patch 2.2.23", release: "2026-11-11" },
    { title: "Patch 2.2.16a", release: "2026-10-14" },
    { title: "Patch 2.2.16", release: "2026-09-16" },
    { title: "Patch 2.1.95a", release: "2026-08-26" },
    { title: "Patch 2.1.95", release: "2026-08-04" },
    { title: "Patch 2.1.90", release: "2026-07-02" },
    // Announced, not out yet; and a page with no date.
    { title: "Patch 2.2.30", release: "2026-12-09" },
    { title: "Patch 2.2.29", release: null },
  ];
  const lp = liquipediaList(pages, { today: "2026-11-19", url });

  it("lists released patches only, newest first", () => {
    expect(lp.map((p) => [p.version, p.date])).toEqual([
      ["2.2.23", "2026-11-11"],
      ["2.2.16a", "2026-10-14"],
      ["2.2.16", "2026-09-16"],
      ["2.1.95a", "2026-08-26"],
      ["2.1.95", "2026-08-04"],
      ["2.1.90", "2026-07-02"],
    ]);
  });

  it("merges with the Fandom list without dropping anything", () => {
    const fandom = [
      { version: "2.2.16", title: "Patch Notes 2.2.16", link: "https://fandom/2.2.16" },
      { version: "2.1.90", title: "Patch Notes 2.1.90", link: "https://fandom/2.1.90" },
      { version: "1.0.0", title: "Patch Notes 1.0.0", link: "https://fandom/1.0.0" },
    ];
    const previous = [{ version: "0.9.0", title: "Patch Notes 0.9.0", link: "https://fandom/0.9.0" }, fandom[1]];
    const merged = mergeLists(fandom, lp, previous);
    expect(merged.map((p) => p.version)).toEqual(["2.2.23", "2.2.16a", "2.2.16", "2.1.95a", "2.1.95", "2.1.90", "1.0.0", "0.9.0"]);
    // Fandom keeps its page, takes Liquipedia's date.
    expect(merged[2]).toEqual({ ...fandom[0], date: "2026-09-16", liquipedia: url("Patch 2.2.16") });
    // Liquipedia only: its page.
    expect(merged[0]).toEqual({ version: "2.2.23", title: "Patch 2.2.23", link: url("Patch 2.2.23"), date: "2026-11-11", liquipedia: url("Patch 2.2.23") });
    expect(merged.find((p) => p.version === "1.0.0")).toMatchObject({ date: null, liquipedia: null });
  });

  it("reads only the pages that changed since the cache", async () => {
    const requests = [];
    const client = {
      api: async (params) => {
        requests.push(params.action);
        return {
          query: {
            pages: [
              { title: "Patch 2.2.16a", revisions: [{ revid: 2 }] },
              { title: "Patch 2.2.16", revisions: [{ revid: 1 }] },
              { title: "Patch Notes 1.4.94B", revisions: [{ revid: 9 }] },
            ],
          },
        };
      },
      contents: async (titles) => {
        requests.push(...titles);
        return new Map(titles.map((t) => [t, { revid: 2, text: HOTFIX }]));
      },
    };
    const cache = { version: 1, pages: { "Patch 2.2.16": { revid: 1, release: "2026-09-16" } } };
    const result = await liquipediaPages(client, cache);
    expect(requests).toEqual(["query", "Patch 2.2.16a"]);
    expect(result).toEqual([
      { title: "Patch 2.2.16a", release: "2026-10-14" },
      { title: "Patch 2.2.16", release: "2026-09-16" },
    ]);
    expect(Object.keys(cache.pages)).toEqual(["Patch 2.2.16a", "Patch 2.2.16"]);
  });
});

describe("merge of the notes", () => {
  const lpDetail = liquipediaDetail(HOTFIX, { version: "2.2.16a", title: "Patch 2.2.16a", link: url("Patch 2.2.16a") });
  const fandom = {
    version: "2.2.16a",
    title: "Patch Notes 2.2.16a",
    date: "2026-10-20",
    link: "https://fandom/2.2.16a",
    toc: [{ level: 2, title: "Battlefield", anchor: "battlefield" }],
    sections: [{ anchor: "battlefield", title: "Battlefield", html: "<p>x</p>", role: null }],
    newHeroes: [],
    adjustments: [],
    balance: { buff: 0, nerf: 0, adjust: 0 },
  };

  it("keeps the Fandom notes and takes Liquipedia's release date", () => {
    const withHeroes = { ...fandom, adjustments: [{ name: "Aulus", slug: "aulus", type: "buff", intro: "", sections: [] }] };
    const merged = mergeDetail(withHeroes, lpDetail);
    expect(merged).toMatchObject({ source: "fandom", date: "2026-10-14", link: "https://fandom/2.2.16a", liquipedia: url("Patch 2.2.16a") });
    expect(merged.adjustments).toBe(withHeroes.adjustments);
    expect(merged.adjustmentsSource).toBeUndefined();
  });

  it("fills hero changes a Fandom page lacks", () => {
    const merged = mergeDetail(fandom, lpDetail);
    expect(merged.adjustments).toBe(lpDetail.adjustments);
    expect(merged.adjustmentsSource).toBe("liquipedia");
    expect(merged.sections.at(-1)).toMatchObject({ role: "adjustments", html: "" });
    expect(merged.toc.at(-1)).toMatchObject({ level: 2, title: "I. Hero Adjustments" });
  });

  it("uses Liquipedia alone when Fandom has no page, Fandom alone otherwise", () => {
    expect(mergeDetail(undefined, lpDetail)).toBe(lpDetail);
    expect(mergeDetail(fandom, undefined)).toMatchObject({ source: "fandom", date: "2026-10-20", liquipedia: null });
    expect(mergeDetail(undefined, undefined)).toBeNull();
  });
});
