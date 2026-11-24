import { describe, expect, it } from "vitest";
import {
  ANNOUNCE_TITLES,
  KIT_SIZES,
  STORY_SAFE,
  isKitCanonical,
  kitFileName,
  kitPath,
  kitQuery,
  parseKitRequest,
  type KitCatalog,
  type KitRequest,
} from "@/lib/social-kit";

const catalog: KitCatalog = {
  heroes: new Set(["aamon", "layla", "hirara"]),
  versions: new Set(["2.2.23", "2.2.16a"]),
  skins: new Set(["101210", "168"]),
};
const parse = (template: string, query: string) => parseKitRequest(template, query, catalog);

describe("social kit requests", () => {
  it("reads each template with its own keys", () => {
    expect(parse("patch", "lang=fr&format=story&v=2.2.23")).toEqual({ locale: "fr", format: "story", card: { template: "patch", version: "2.2.23" } });
    expect(parse("tier-list", "format=square")).toEqual({ locale: "en", format: "square", card: { template: "tier-list", rank: "all" } });
    expect(parse("tier-list", "rank=mythic")?.card).toEqual({ template: "tier-list", rank: "mythic" });
    expect(parse("hero", "h=hirara&m=new")?.card).toEqual({ template: "hero", hero: "hirara", mode: "new" });
    expect(parse("hero", "h=layla")?.card).toEqual({ template: "hero", hero: "layla", mode: "spotlight" });
    expect(parse("skin", "s=101210")?.card).toEqual({ template: "skin", skin: "101210" });
    for (const title of ANNOUNCE_TITLES) expect(parse("announce", `t=${title}`)?.card).toEqual({ template: "announce", title });
  });

  it("defaults to English and portrait, refuses other languages and formats", () => {
    expect(parse("announce", "t=discord")).toMatchObject({ locale: "en", format: "portrait" });
    expect(parse("announce", "t=discord&lang=xx")).toBeNull();
    expect(parse("announce", "t=discord&format=landscape")).toBeNull();
    expect(parse("announce", "t=discord&format=STORY")).toBeNull();
  });

  it("only names what the catalog knows", () => {
    expect(parse("patch", "v=9.9.9")).toBeNull();
    expect(parse("patch", "")).toBeNull();
    expect(parse("patch", "v=../2.2.23")).toBeNull();
    expect(parse("tier-list", "rank=bronze")).toBeNull();
    expect(parse("hero", "h=unknown")).toBeNull();
    expect(parse("hero", "h=Layla")).toBeNull();
    expect(parse("hero", "")).toBeNull();
    expect(parse("hero", "h=layla&m=old")).toBeNull();
    expect(parse("skin", "s=999")).toBeNull();
    expect(parse("skin", "s=168.0")).toBeNull();
    expect(parse("skin", "s=")).toBeNull();
  });

  it("never takes a free text for an announcement", () => {
    expect(parse("announce", "")).toBeNull();
    expect(parse("announce", "t=Free%20tournament!")).toBeNull();
    expect(parse("announce", "t=discord&title=Hello")).toBeNull();
    expect(parse("announce", "t=constructor")).toBeNull();
    expect(parse("announce", "t=toString")).toBeNull();
  });

  it("refuses an unknown template, an extra key, a repeated key and a long query", () => {
    expect(parse("build", "")).toBeNull();
    expect(parse("__proto__", "")).toBeNull();
    expect(parse("tier-list", "url=https://example.com/a.png")).toBeNull();
    expect(parse("tier-list", "rank=all&rank=epic")).toBeNull();
    expect(parse("hero", "h=layla&v=2.2.23")).toBeNull();
    expect(parse("announce", `t=discord&${"lang=fr&".repeat(30)}`)).toBeNull();
  });

  it("has one canonical address per visual", () => {
    const request: KitRequest = { locale: "fr", format: "story", card: { template: "hero", hero: "hirara", mode: "new" } };
    const query = kitQuery(request);
    expect(query).toBe("lang=fr&format=story&h=hirara&m=new");
    expect(kitPath(request)).toBe(`/api/kit/hero?${query}`);
    expect(parse("hero", query)).toEqual(request);
    expect(isKitCanonical(`?${query}`, request)).toBe(true);
    // Another order, or a default spelled out: valid, but sent to the canonical address.
    expect(isKitCanonical("m=new&h=hirara&lang=fr&format=story", request)).toBe(false);
    const spotlight = parse("hero", "lang=fr&format=portrait&h=layla&m=spotlight")!;
    expect(kitQuery(spotlight)).toBe("lang=fr&format=portrait&h=layla");
    expect(isKitCanonical("lang=fr&format=portrait&h=layla&m=spotlight", spotlight)).toBe(false);
    const tier = parse("tier-list", "rank=all")!;
    expect(kitQuery(tier)).toBe("lang=en&format=portrait");
  });

  it("names the downloaded file after the visual", () => {
    expect(kitFileName({ locale: "fr", format: "square", card: { template: "patch", version: "2.2.16a" } })).toBe("mlbbdex-patch-2-2-16a-square.png");
    expect(kitFileName({ locale: "fr", format: "story", card: { template: "announce", title: "live" } })).toBe("mlbbdex-announce-live-story.png");
  });

  it("draws the three formats, the story keeping clear of the apps' bands", () => {
    expect(KIT_SIZES).toEqual({ square: { width: 1080, height: 1080 }, portrait: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 } });
    expect(STORY_SAFE.top).toBeGreaterThanOrEqual(220);
    expect(STORY_SAFE.bottom).toBeGreaterThanOrEqual(300);
  });
});
