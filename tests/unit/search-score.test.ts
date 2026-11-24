import { describe, expect, it } from "vitest";
import names from "@/data/game/names.json";
import items from "@/data/game/items.json";
import visuals from "@/data/game/visuals.json";
import { LOCALES } from "@/i18n/config";
import type { EntrySearch } from "@/lib/search";
import { HERO_ALIASES, ITEM_ALIASES, SPELL_ALIASES, heroAliases } from "@/lib/search-aliases";
import { allowedEdits, closest, distance, normalize, prepare, score, searchIndex, TYPO } from "@/lib/search-score";

/**
 * The global search's scorer and its aliases, on an index shaped like the
 * real one: every hero (with its counters page), the items, the spells and a
 * few skins.
 */
const heroes = Object.entries(names as Record<string, string>);

function index(locale: (typeof LOCALES)[number] = "en"): EntrySearch[] {
  const keywords = (slug: string) => ({ keywords: heroAliases(slug, locale) });
  return [
    ...heroes.map(([slug, name]) => ({ type: "hero" as const, title: name, href: `/heroes/${slug}`, ...keywords(slug) })),
    ...heroes.map(([slug, name]) => ({
      type: "hero" as const,
      title: `${name} · Counters`,
      href: `/heroes/${slug}/counters`,
      ...keywords(slug),
    })),
    ...(items as { slug: string; name: string }[]).map((o) => ({
      type: "item" as const,
      title: o.name,
      href: `/items/${o.slug}`,
      keywords: ITEM_ALIASES[o.slug],
    })),
    ...Object.keys((visuals as unknown as { spells: Record<string, string> }).spells).map((slug) => ({
      type: "spell" as const,
      title: slug.charAt(0).toUpperCase() + slug.slice(1),
      href: `/spells/${slug}`,
      keywords: SPELL_ALIASES[slug],
    })),
    { type: "skin" as const, title: "Sun of the Sky", detail: "Sun", href: "/heroes/sun#skins" },
    { type: "skin" as const, title: "Lightborn Striker", detail: "Layla", href: "/heroes/layla#skins" },
    { type: "page" as const, title: "Tier list", href: "/tier-list" },
  ];
}

const prepared = index().map(prepare);
const first = (query: string, list = prepared) => searchIndex(query, list)[0]?.entries[0]?.href;
const heroes_ = (query: string, list = prepared) =>
  searchIndex(query, list).find((g) => g.type === "hero")?.entries.map((e) => e.href) ?? [];

describe("normalize", () => {
  it("folds case, accents, punctuation and Cyrillic", () => {
    expect(normalize("Chang'e")).toBe("change");
    expect(normalize("X.Borg")).toBe("x borg");
    expect(normalize("Épique  ")).toBe("epique");
    expect(normalize("Popol & Kupa")).toBe("popol and kupa");
    expect(normalize("Лейла")).toBe("leyla");
  });
});

describe("distance", () => {
  it("counts edits, a swap of neighbours as one", () => {
    expect(distance("layla", "layla")).toBe(0);
    expect(distance("lyla", "layla")).toBe(1);
    expect(distance("gusoin", "gusion")).toBe(1);
    expect(distance("kitten", "sitting")).toBe(3);
  });

  it("gives up past the bound", () => {
    expect(distance("abcdef", "uvwxyz", 2)).toBe(3);
    expect(distance("a", "abcdef", 1)).toBe(2);
  });

  it("forgives more on longer queries", () => {
    expect(allowedEdits(2)).toBe(0);
    expect(allowedEdits(4)).toBe(1);
    expect(allowedEdits(7)).toBe(2);
  });
});

describe("score", () => {
  const sun = prepare({ type: "hero", title: "Sun", href: "/heroes/sun" });
  const yss = prepare({ type: "hero", title: "Yi Sun-shin", href: "/heroes/yi-sun-shin", keywords: ["yss"] });

  it("ranks exact before prefix, word, initials and substring", () => {
    expect(score("sun", sun)).toBe(0);
    expect(score("yi", yss)).toBe(2);
    expect(score("sun", yss)).toBe(4);
    expect(score("ysh", yss, false)).toBe(null);
    expect(score("yss", yss)).toBe(1);
    expect(score("unsh", yss)).toBe(6);
  });

  it("finds a typo only as a typo", () => {
    expect(score("yi sin shin", yss)).toBeGreaterThanOrEqual(TYPO);
    expect(score("yi sin shin", yss, false)).toBe(null);
    expect(score("su", prepare({ type: "hero", title: "Zhask", href: "/heroes/zhask" }))).toBe(null);
  });

  it("puts a hero's sub-pages after the hero page", () => {
    const counters = prepare({ type: "hero", title: "Sun · Counters", href: "/heroes/sun/counters" });
    expect(score("sun", counters)!).toBeGreaterThan(score("sun", sun)!);
  });
});

describe("searchIndex", () => {
  it("answers the searches seen in the audience reports", () => {
    expect(first("Sun")).toBe("/heroes/sun");
    expect(first("Layla")).toBe("/heroes/layla");
    expect(first("Chou")).toBe("/heroes/chou");
    expect(first("ling")).toBe("/heroes/ling");
    expect(first("nolan")).toBe("/heroes/nolan");
    expect(first("fre")).toBe("/heroes/freya");
    expect(first("dy")).toBe("/heroes/dyrroth");
    expect(first("Dyr")).toBe("/heroes/dyrroth");
    expect(first("Cho")).toBe("/heroes/chou");
    expect(first("Tha")).toBe("/heroes/thamuz");
    expect(first("Alpha")).toBe("/heroes/alpha");
    expect(first("valir")).toBe("/heroes/valir");
    expect(first("selena")).toBe("/heroes/selena");
    expect(first("masha")).toBe("/heroes/masha");
    expect(first("Obsidia")).toBe("/heroes/obsidia");
    expect(first("Miya")).toBe("/heroes/miya");
  });

  it("lists every hero a short prefix opens, hero pages before their sub-pages", () => {
    const found = heroes_("ba");
    for (const slug of ["badang", "balmond", "bane", "barats", "baxia"]) expect(found).toContain(`/heroes/${slug}`);
    const lastPage = Math.max(...found.flatMap((h, i) => (h.endsWith("/counters") ? [] : [i])));
    expect(found.findIndex((h) => h.endsWith("/counters"))).toBeGreaterThan(lastPage);
  });

  it("puts heroes first, then items and spells", () => {
    const groups = searchIndex("flicker", prepared);
    expect(groups.map((g) => g.type)).toEqual(["spell"]);
    expect(groups[0].entries[0].href).toBe("/spells/flicker");
    const types = searchIndex("s", prepared).map((g) => g.type);
    expect(types.indexOf("hero")).toBeLessThan(types.indexOf("item"));
    expect(types.indexOf("item")).toBeLessThan(types.indexOf("spell"));
  });

  it("forgives typos when nothing matches directly", () => {
    expect(first("layal")).toBe("/heroes/layla");
    expect(first("gusoin")).toBe("/heroes/gusion");
    expect(first("hayabsa")).toBe("/heroes/hayabusa");
    expect(first("thamus")).toBe("/heroes/thamuz");
    expect(first("windtalkr")).toBe("/items/windtalker");
  });

  it("keeps typos out when a name matches directly", () => {
    // "lin" starts Ling and Lunox's neighbours are only a typo away: Ling alone.
    expect(heroes_("ling")).toEqual(["/heroes/ling", "/heroes/ling/counters"]);
  });

  it("finds shorthands and several words", () => {
    expect(first("bod")).toBe("/items/blade-of-despair");
    expect(first("retri")).toBe("/spells/retribution");
    expect(first("yss")).toBe("/heroes/yi-sun-shin");
    expect(first("dyr counter")).toBe("/heroes/dyrroth/counters");
    expect(first("chang e")).toBe("/heroes/chang-e");
    expect(first("xborg")).toBe("/heroes/x-borg");
  });

  it("looks in the detail last: a hero's skins", () => {
    const skins = searchIndex("layla", prepared).find((g) => g.type === "skin");
    expect(skins?.entries[0].title).toBe("Lightborn Striker");
  });

  it("returns nothing for an empty query", () => {
    expect(searchIndex("  ", prepared)).toEqual([]);
  });

  it("finds names written in another language", () => {
    const ru = index("ru").map(prepare);
    expect(first("Лейла", ru)).toBe("/heroes/layla");
    expect(first("Чоу", ru)).toBe("/heroes/chou");
    const fr = index("fr").map(prepare);
    expect(first("cyclope", fr)).toBe("/heroes/cyclops");
  });
});

describe("closest", () => {
  it("offers the nearest names when nothing matches", () => {
    expect(searchIndex("ziloooong", prepared)).toEqual([]);
    expect(closest("ziloooong", prepared)[0].href).toBe("/heroes/zilong");
    expect(closest("mathildaaaa", prepared)[0].href).toBe("/heroes/mathilda");
  });

  it("offers nothing for a single letter or a far query", () => {
    expect(closest("q", prepared)).toEqual([]);
    expect(closest("qqqqqqqqqq", prepared)).toEqual([]);
  });
});

describe("aliases", () => {
  const slugs = new Set(Object.keys(names));

  it("name heroes, items and spells that exist", () => {
    for (const slug of Object.keys(HERO_ALIASES)) expect(slugs, slug).toContain(slug);
    const itemSlugs = new Set((items as { slug: string }[]).map((o) => o.slug));
    for (const slug of Object.keys(ITEM_ALIASES)) expect(itemSlugs, slug).toContain(slug);
    const spells = Object.keys((visuals as unknown as { spells: Record<string, string> }).spells);
    for (const slug of Object.keys(SPELL_ALIASES)) expect(spells, slug).toContain(slug);
  });

  it("only use the site's languages", () => {
    const keys = new Set(["all", ...LOCALES]);
    for (const [slug, entry] of Object.entries(HERO_ALIASES)) {
      for (const key of Object.keys(entry)) expect(keys, `${slug}.${key}`).toContain(key);
    }
  });

  // A Cyrillic name may fold back to the Latin one ("Акай"): it is there for
  // the prefixes typed in Cyrillic. A Latin alias equal to the name is noise.
  it("never repeat the hero's own name in Latin script", () => {
    for (const [slug, entry] of Object.entries(HERO_ALIASES)) {
      const own = normalize((names as Record<string, string>)[slug]).replace(/ /g, "");
      for (const alias of [...(entry.all ?? []), ...(entry.fr ?? []), ...(entry.es ?? []), ...(entry.id ?? [])]) {
        expect(normalize(alias).replace(/ /g, ""), `${slug}: ${alias}`).not.toBe(own);
      }
    }
  });

  it("send a nickname to its hero", () => {
    expect(heroAliases("dyrroth", "en")).toContain("dyr");
    expect(heroAliases("layla", "ru")).toContain("Лейла");
    expect(heroAliases("layla", "fr")).not.toContain("Лейла");
    expect(heroAliases("unknown", "en")).toEqual([]);
  });
});
