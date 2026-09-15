import { describe, expect, it } from "vitest";
import {
  ENDPOINTS,
  MIN_WORDS,
  PAGES,
  containsPhrase,
  decodeEntities,
  extractDescription,
  extractLang,
  extractTitle,
  findPlaceholders,
  inspectPage,
  resolvePages,
  sitemapPaths,
  visibleText,
} from "../../scripts/smoke-check-rules.mjs";

const words = (n, word = "lorem") => Array.from({ length: n }, () => word).join(" ");

/** A minimal page in the shape Next renders. */
function html({ lang = "en", title = "Khufra: build and counters", description = "Hero page.", main = words(60), extra = "" } = {}) {
  return `<!DOCTYPE html><html lang="${lang}" class="x"><head><meta charSet="utf-8"/><title>${title}</title><meta name="description" content="${description}"/></head><body><header><nav>Heroes Tier list</nav></header><main id="content">${main}</main>${extra}</body></html>`;
}

const page = (path, options = {}) => PAGES.find((p) => p.path === path) ?? { path, locales: ["en"], ...options };
const endpoint = (path) => ENDPOINTS.find((e) => e.path === path);

describe("helpers", () => {
  it("decodes named and numeric entities once", () => {
    expect(decodeEntities("Tom &amp; Jerry &#x27;s &#39;x&#39; &lt;b&gt; &nbsp;&#233;")).toBe("Tom & Jerry 's 'x' <b>  é");
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
    expect(decodeEntities("&unknown;")).toBe("&unknown;");
  });

  it("keeps only visible text", () => {
    const source = `<p>Hello <b>world</b></p><script>self.__next_f.push("Best {plural}")</script><style>.a{color:red}</style><template><p>{hidden}</p></template><!-- {comment} --><span>Fighter&#x27;s</span>`;
    expect(visibleText(source)).toBe("Hello world Fighter's");
  });

  it("finds placeholders, minus the allowed ones", () => {
    expect(findPlaceholders("Best {pluriel} in MLBB, {count} and {count}")).toEqual(["{pluriel}", "{count}"]);
    expect(findPlaceholders("GET /api/v1/heroes/{slug} {pluriel}", ["{slug}"])).toEqual(["{pluriel}"]);
    expect(findPlaceholders("a { b } {1x} {}")).toEqual([]);
    expect(findPlaceholders(null)).toEqual([]);
  });

  it("reads the title, the description and the language", () => {
    const source = html({ lang: "fr-FR", title: "Emblèmes &amp; talents", description: "Mis &#x27;à&#x27; jour" });
    expect(extractTitle(source)).toBe("Emblèmes & talents");
    expect(extractDescription(source)).toBe("Mis 'à' jour");
    expect(extractLang(source)).toBe("fr-FR");
    expect(extractTitle("<html><head></head><body><svg><title>icon</title></svg></body></html>")).toBeNull();
    expect(extractDescription("<head></head>")).toBeNull();
  });

  it("matches phrases as whole words", () => {
    expect(containsPhrase("Origin Common Exquisite", "Exquis")).toBe(false);
    expect(containsPhrase("Origine Commun Exquis Exceptionnel", "Exquis")).toBe(true);
    expect(containsPhrase("Emblème de combattant (Dégâts)", "Emblème de combattant")).toBe(true);
  });

  it("lists sitemap paths whatever the host", () => {
    const xml = "<urlset><url><loc>https://mlbbdex.com/en/heroes</loc></url><url><loc>http://127.0.0.1:3009/fr</loc></url></urlset>";
    expect(sitemapPaths(xml)).toEqual(["/en/heroes", "/fr"]);
  });
});

describe("inspectPage", () => {
  it("accepts a healthy page", () => {
    expect(inspectPage({ html: html(), status: 200, locale: "en", page: page("/heroes/khufra") })).toEqual([]);
  });

  it("reports a raw placeholder in the title (role tier list bug)", () => {
    const problems = inspectPage({
      html: html({ title: "Best {pluriel} in MLBB" }),
      status: 200,
      locale: "en",
      page: page("/tier-list/role/fighter"),
    });
    expect(problems).toContain('title contains "{": "Best {pluriel} in MLBB"');
  });

  it("reports placeholders in the visible text and the description, not in scripts", () => {
    const problems = inspectPage({
      html: html({
        description: "The {count} best heroes",
        main: `${words(60)} Best {pluriel}`,
        extra: '<script>self.__next_f.push("{ignored}")</script>',
      }),
      status: 200,
      locale: "en",
      page: page("/tier-list"),
    });
    expect(problems).toEqual(["placeholder in meta description: {count}", "placeholder in visible text: {pluriel}"]);
  });

  it("allows the placeholders a page documents on purpose", () => {
    const source = html({ main: `${words(60)} GET /api/v1/heroes/{slug}` });
    expect(inspectPage({ html: source, status: 200, locale: "en", page: page("/api-doc") })).toEqual([]);
    expect(inspectPage({ html: source, status: 200, locale: "en", page: page("/heroes") })).toEqual([
      "placeholder in visible text: {slug}",
    ]);
  });

  it("reports an empty legal page, even with a full navigation", () => {
    const problems = inspectPage({
      html: html({ main: "<h1>Legal notice</h1>", extra: `<footer>${words(400)}</footer>` }),
      status: 200,
      locale: "en",
      page: page("/legal"),
    });
    expect(problems).toEqual(["main content has 2 words, expected at least 150"]);
    expect(inspectPage({ html: html({ main: "" }), status: 200, locale: "en", page: page("/news") })).toEqual([
      `main content has 0 words, expected at least ${MIN_WORDS}`,
    ]);
  });

  it("reports a wrong status, a missing title and a language mismatch", () => {
    const problems = inspectPage({ html: html({ title: " ", lang: "en" }), status: 500, locale: "fr", page: page("/heroes") });
    expect(problems).toEqual(["status 500, expected 200", "missing or empty <title>", '<html lang="en">, expected fr']);
    expect(inspectPage({ html: "", status: 200, locale: "en", page: page("/heroes") })).toEqual(["empty response body"]);
  });

  it("reports untranslated emblem names", () => {
    const emblem = page("/emblems/fighter");
    const english = html({ main: `<h1>Fighter Emblem</h1>${words(60)}` });
    expect(inspectPage({ html: english, status: 200, locale: "en", page: emblem })).toEqual([]);
    expect(inspectPage({ html: html({ lang: "fr-FR", main: `<h1>Fighter Emblem</h1>${words(60)}` }), status: 200, locale: "fr", page: emblem })).toEqual([
      'missing text "Emblème de combattant"',
      'unexpected text "Fighter Emblem" (untranslated?)',
    ]);
    expect(
      inspectPage({ html: html({ lang: "fr-FR", main: `<h1>Emblème de combattant</h1>${words(60)}` }), status: 200, locale: "fr", page: emblem }),
    ).toEqual([]);
  });

  it("reports a French rarity name on another language", () => {
    const skins = page("/heroes/khufra/skins");
    const french = `Origine Commun Exquis Exceptionnel Deluxe ${words(60)}`;
    expect(inspectPage({ html: html({ lang: "es-ES", main: french }), status: 200, locale: "es", page: skins })).toEqual([
      'missing text "Exquisita"',
      'missing text "Excepcional"',
      'unexpected text "Exquis" (untranslated?)',
      'unexpected text "Exceptionnel" (untranslated?)',
    ]);
    expect(inspectPage({ html: html({ lang: "fr-FR", main: french }), status: 200, locale: "fr", page: skins })).toEqual([]);
  });
});

describe("endpoints", () => {
  it("reports a session answering with French keys", () => {
    expect(endpoint("/api/session").check({ connecte: false })).toEqual([
      '"connected" is undefined, expected a boolean',
      'unexpected key(s) "connecte"',
    ]);
    expect(endpoint("/api/session").check({ connected: "yes" })).toEqual(['"connected" is "yes", expected a boolean']);
    expect(endpoint("/api/session").check({ connected: false })).toEqual([]);
    expect(endpoint("/api/session").check({ connected: true, pseudo: "Leo" })).toEqual([]);
  });

  it("reports a push key published under another name", () => {
    expect(endpoint("/api/push").check({ cle: "BO0i" })).toEqual(['missing "key"', 'unexpected key(s) "cle"']);
    expect(endpoint("/api/push").check({ key: 12 })).toEqual(['"key" is number, expected a string or null']);
    expect(endpoint("/api/push").check({ key: null })).toEqual([]);
    expect(endpoint("/api/push").check({ key: "BO0i" })).toEqual([]);
  });

  it("checks the measurements file, the hero API and the sitemap", () => {
    expect(endpoint("/composition/mythic.json?v=2").check({ stats: {} })).toEqual(['missing "rank"']);
    expect(endpoint("/composition/mythic.json?v=2").check({ rank: "mythic", stats: {} })).toEqual([]);

    const heroes = Array.from({ length: 120 }, (_, i) => ({ slug: `h${i}`, lanes: ["Gold"] }));
    expect(endpoint("/api/v1/heroes").check({ data: heroes })).toEqual([]);
    expect(endpoint("/api/v1/heroes").check({ data: [...heroes, { lanes: ["Or", "Milieu"] }] })).toEqual([
      'non-English lane(s): "Or", "Milieu"',
    ]);
    expect(endpoint("/api/v1/heroes").check({ data: heroes.slice(0, 3) })).toEqual(["only 3 heroes"]);

    const sitemap = (n) => `<urlset>${"<url><loc>https://mlbbdex.com/en</loc></url>".repeat(n)}</urlset>`;
    expect(endpoint("/sitemap.xml").check(sitemap(1001))).toEqual([]);
    expect(endpoint("/sitemap.xml").check(sitemap(10))).toEqual(["only 10 URLs, expected more than 1000"]);
    expect(endpoint("/llms.txt").placeholders).toBe(false);
  });
});

describe("resolvePages", () => {
  const table = [
    { path: "", locales: ["en"] },
    { path: "/draft", locales: ["en"] },
    { path: "/tools/draft", locales: ["en"] },
    { discover: "latest-patch", path: "/patch-notes/<latest version>", locales: ["en"] },
    { discover: "compare-pair", path: "/compare/<a>-vs-<b>", locales: ["en"] },
  ];

  it("keeps listed paths, picks discovered ones and reports the rest", () => {
    const paths = ["/en", "/fr", "/en/draft", "/en/patch-notes/1.9.47", "/en/patch-notes/2.1.88", "/en/patch-notes/1.10.2", "/en/patch-notes/patch-1-9-40", "/en/compare/aamon-vs-cici"];
    const { pages, problems } = resolvePages(paths, table);
    expect(pages.map((p) => p.path)).toEqual(["", "/draft", "/patch-notes/2.1.88", "/compare/aamon-vs-cici"]);
    expect(problems).toEqual(["/en/tools/draft: not listed in the sitemap (route moved or removed?)"]);
  });

  it("reports a discovery that finds nothing", () => {
    const { problems } = resolvePages(["/en", "/en/draft"], table.slice(3));
    expect(problems).toEqual(["/patch-notes/<latest version>: no matching URL in the sitemap", "/compare/<a>-vs-<b>: no matching URL in the sitemap"]);
  });

  it("covers the required pages in English and French", () => {
    for (const path of ["", "/heroes", "/tier-list", "/emblems/fighter", "/legal", "/privacy", "/about", "/draft"]) {
      const entry = PAGES.find((p) => p.path === path);
      expect(entry?.locales).toEqual(expect.arrayContaining(["en", "fr"]));
    }
  });
});
