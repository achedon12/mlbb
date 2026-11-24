import { describe, expect, it } from "vitest";
import type { CodeCatalog } from "@/lib/build-code";
import {
  cellsFromEmoji,
  isCanonical,
  parseShareRequest,
  shareQuery,
  sharePath,
  type ShareCatalog,
  type ShareRequest,
} from "@/lib/share-card";

const build: CodeCatalog = {
  heroes: new Set(["aamon", "layla"]),
  items: new Set(["genius-wand", "holy-crystal"]),
  emblems: new Set(["mage"]),
  tiers: [new Set(["rupture"]), new Set(["weapon-master"]), new Set(["killing-spree"])],
  spells: new Set(["flicker"]),
};
const catalog: ShareCatalog = {
  heroes: new Set(["aamon", "layla", "tigreal", "lolita", "miya", "chou", "gusion", "kagura", "franco", "ling"]),
  build,
  versions: new Set(["2.2.23", "2.2.16a"]),
};
const parse = (kind: string, query: string) => parseShareRequest(kind, query, catalog);

describe("share image requests", () => {
  it("reads a build and keeps only known slugs", () => {
    const r = parse("build", "lang=fr&format=portrait&h=aamon&i=genius-wand,holy-crystal&e=mage&t=rupture,,killing-spree&s=flicker");
    expect(r).toEqual({
      locale: "fr",
      format: "portrait",
      card: {
        kind: "build",
        build: { hero: "aamon", level: 15, items: ["genius-wand", "holy-crystal"], emblem: "mage", talents: ["rupture", null, "killing-spree"], spell: "flicker" },
      },
    });
    // An unknown item, a missing hero or no item at all: no image.
    expect(parse("build", "h=aamon&i=genius-wand,unknown")).toBeNull();
    expect(parse("build", "i=genius-wand")).toBeNull();
    expect(parse("build", "h=aamon")).toBeNull();
  });

  it("defaults to English and portrait, refuses other languages and formats", () => {
    expect(parse("tier-list", "")).toEqual({ locale: "en", format: "portrait", card: { kind: "tier-list", rank: "all" } });
    expect(parse("tier-list", "lang=xx")).toBeNull();
    expect(parse("tier-list", "format=square")).toBeNull();
    expect(parse("tier-list", "rank=mythic&format=landscape")?.card).toEqual({ kind: "tier-list", rank: "mythic" });
    expect(parse("tier-list", "rank=bronze")).toBeNull();
  });

  it("refuses an unknown kind, an extra key, a repeated key and a long query", () => {
    expect(parse("hero", "")).toBeNull();
    expect(parse("tier-list", "rank=all&url=https://example.com/a.png")).toBeNull();
    expect(parse("tier-list", "rank=all&rank=epic")).toBeNull();
    expect(parse("recap", `v=2.2.23&${"lang=fr&".repeat(100)}`)).toBeNull();
  });

  it("reads a draft: five distinct heroes a side at most, a bounded estimate", () => {
    const r = parse("draft", "b=aamon,layla,tigreal,lolita,miya&r=chou,gusion,kagura,franco,ling&w=55&rank=mythic");
    expect(r?.card).toEqual({
      kind: "draft",
      blue: ["aamon", "layla", "tigreal", "lolita", "miya"],
      red: ["chou", "gusion", "kagura", "franco", "ling"],
      win: 55,
      rank: "mythic",
    });
    expect(parse("draft", "b=aamon&r=layla")?.card).toMatchObject({ win: null, rank: "all" });
    expect(parse("draft", "b=aamon,aamon&r=layla")).toBeNull();
    expect(parse("draft", "b=aamon&r=aamon")).toBeNull();
    expect(parse("draft", "b=aamon,layla,tigreal,lolita,miya,chou&r=gusion")).toBeNull();
    expect(parse("draft", "b=aamon&r=nobody")).toBeNull();
    expect(parse("draft", "b=aamon&r=layla&w=90")).toBeNull();
    expect(parse("draft", "b=aamon&r=layla&w=5.5")).toBeNull();
    expect(parse("draft", "b=aamon")).toBeNull();
  });

  it("reads an MLBBdle result without its answer", () => {
    const r = parse("mlbbdle", "mode=classic&n=75&g=3&grid=xpxuxxxxx.mpmmxmmmm.mmmmmmmmm&streak=4");
    expect(r?.card).toEqual({
      kind: "mlbbdle",
      mode: "classic",
      number: 75,
      guesses: 3,
      rows: [[..."xpxuxxxxx"], [..."mpmmxmmmm"], [..."mmmmmmmmm"]],
      streak: 4,
    });
    // The last row must be the win; no more rows than guesses; nine cells a row.
    expect(parse("mlbbdle", "mode=classic&n=75&g=2&grid=mmmmmmmmm.xxxxxxxxx")).toBeNull();
    expect(parse("mlbbdle", "mode=classic&n=75&g=1&grid=xxxxxxxxx.mmmmmmmmm")).toBeNull();
    expect(parse("mlbbdle", "mode=classic&n=75&g=1&grid=mmmm")).toBeNull();
    expect(parse("mlbbdle", "mode=classic&n=75&g=1&grid=mmmmmmmmz")).toBeNull();
    expect(parse("mlbbdle", "mode=classic&n=75&g=1")).toBeNull();
    // Skill mode carries no grid.
    expect(parse("mlbbdle", "mode=skill&n=75&g=6")?.card).toMatchObject({ mode: "skill", rows: [], streak: 0 });
    expect(parse("mlbbdle", "mode=skill&n=75&g=6&grid=mmmmmmmmm")).toBeNull();
    expect(parse("mlbbdle", "mode=practice&n=75&g=6")).toBeNull();
    expect(parse("mlbbdle", "mode=skill&n=0&g=6")).toBeNull();
  });

  it("reads a quiz result and its challenge, scores in range", () => {
    expect(parse("quiz", "n=75&p=5&m=7&grid=mxuuu.xxmuu.mmmm.xxxxx.mxm&streak=3")?.card).toEqual({
      kind: "quiz",
      number: 75,
      points: 5,
      max: 7,
      rows: [[..."mxuuu"], [..."xxmuu"], [..."mmmm"], [..."xxxxx"], [..."mxm"]],
      streak: 3,
      duel: false,
    });
    expect(parse("quiz", "n=75&p=5&m=7&vs=1")?.card).toMatchObject({ duel: true, rows: [], streak: 0 });
    expect(parse("quiz", "n=75&p=8&m=7")).toBeNull();
    expect(parse("quiz", "n=0&p=1&m=7")).toBeNull();
    expect(parse("quiz", "n=75&p=1&m=31")).toBeNull();
    expect(parse("quiz", "n=75&p=1&m=7&vs=yes")).toBeNull();
    expect(parse("quiz", "n=75&p=1&m=7&grid=mpx")).toBeNull();
    expect(parse("quiz", "n=75&p=1&m=7&grid=mmmmmmmmm")).toBeNull();
    expect(parse("quiz", "n=75&p=1&m=7&grid=m.m.m.m.m.m.m.m.m")).toBeNull();
    expect(parse("quiz", "n=75&p=1&m=7&name=Leo")).toBeNull();
  });

  it("reads a recap of a known patch only", () => {
    expect(parse("recap", "v=2.2.16a")?.card).toEqual({ kind: "recap", version: "2.2.16a" });
    expect(parse("recap", "v=9.9.99")).toBeNull();
    expect(parse("recap", "v=constructor")).toBeNull();
  });
});

describe("canonical address", () => {
  const request: ShareRequest = { locale: "fr", format: "portrait", card: { kind: "draft", blue: ["aamon"], red: ["layla"], win: 52, rank: "all" } };

  it("round-trips through the parser", () => {
    const query = shareQuery(request);
    expect(parse("draft", query)).toEqual(request);
    expect(sharePath(request)).toBe(`/api/share/draft?${query}`);
  });

  it("tells another spelling of the same image apart", () => {
    expect(isCanonical(`?${shareQuery(request)}`, request)).toBe(true);
    expect(isCanonical("?format=portrait&lang=fr&b=aamon&r=layla&w=52", request)).toBe(false);
    expect(isCanonical("?lang=fr&format=portrait&b=aamon&r=layla&w=52", request)).toBe(true);
  });

  it("leaves defaults out", () => {
    expect(shareQuery({ locale: "en", format: "landscape", card: { kind: "tier-list", rank: "all" } })).toBe("lang=en&format=landscape");
    expect(
      shareQuery({ locale: "en", format: "portrait", card: { kind: "mlbbdle", mode: "skill", number: 3, guesses: 2, rows: [], streak: 0 } }),
    ).toBe("lang=en&format=portrait&mode=skill&n=3&g=2");
    const quiz: ShareRequest = {
      locale: "id",
      format: "landscape",
      card: { kind: "quiz", number: 75, points: 5, max: 7, rows: [], streak: 0, duel: true },
    };
    expect(shareQuery(quiz)).toBe("lang=id&format=landscape&n=75&p=5&m=7&vs=1");
    expect(parse("quiz", shareQuery(quiz))).toEqual(quiz);
  });
});

describe("MLBBdle grid", () => {
  it("turns the emoji rows into cells, without the skipped-rows line", () => {
    expect(cellsFromEmoji(["🟥🟧🟥⬛🟥🟥🟥🟥🟥", "⋯ +3", "🟩🟩🟩🟩🟩🟩🟩🟩🟩"])).toEqual([[..."xpxuxxxxx"], [..."mmmmmmmmm"]]);
  });
});
