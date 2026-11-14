import { describe, expect, it } from "vitest";
import { GameData } from "../../bot/src/site/game-data";
import { GET as heroesGET } from "@/app/api/v1/heroes/route";
import { GET as heroGET } from "@/app/api/v1/heroes/[slug]/route";
import { GET as countersGET } from "@/app/api/v1/heroes/[slug]/counters/route";
import { GET as buildsGET } from "@/app/api/v1/heroes/[slug]/builds/route";
import { GET as itemsGET } from "@/app/api/v1/items/route";
import { GET as patchesGET } from "@/app/api/v1/patches/route";
import { GET as patchGET } from "@/app/api/v1/patches/[version]/route";
import { GET as rankingsGET } from "@/app/api/v1/rankings/route";
import { GET as skinsGET } from "@/app/api/v1/skins/route";
import { GET as eventsGET } from "@/app/api/v1/events/route";
import { GET as emblemsGET } from "@/app/api/v1/emblems/route";
import { GET as spellsGET } from "@/app/api/v1/spells/route";
import { counters, patches } from "@/lib/data";

/**
 * The Discord bot reads the public API with its own schemas
 * (`bot/src/site/game-data.ts`). Here the bot's real client talks to the
 * site's real route handlers, through a fetch that dispatches by path: an
 * endpoint the bot asks for and the site does not serve, or a shape that
 * drifted, fails here instead of in production (four lists once answered
 * 404 and the commands silently fell back to links).
 */

/** A route handler, given the request and the path's captured parameter, if any. */
type Handler = (request: Request, param: string) => Response | Promise<Response>;
const slug = (param: string) => ({ params: Promise.resolve({ slug: param }) });

const ROUTES: [RegExp, Handler][] = [
  [/^\/heroes$/, (r) => heroesGET(r)],
  [/^\/heroes\/([^/]+)$/, (r, p) => heroGET(r, slug(p))],
  [/^\/heroes\/([^/]+)\/counters$/, (r, p) => countersGET(r, slug(p))],
  [/^\/heroes\/([^/]+)\/builds$/, (r, p) => buildsGET(r, slug(p))],
  [/^\/items$/, (r) => itemsGET(r)],
  [/^\/patches$/, () => patchesGET()],
  [/^\/patches\/([^/]+)$/, (r, p) => patchGET(r, { params: Promise.resolve({ version: p }) })],
  [/^\/rankings$/, () => rankingsGET()],
  [/^\/skins$/, (r) => skinsGET(r)],
  [/^\/events$/, (r) => eventsGET(r)],
  [/^\/emblems$/, (r) => emblemsGET(r)],
  [/^\/spells$/, (r) => spellsGET(r)],
];

const asked: string[] = [];

async function siteFetch(input: string): Promise<Response> {
  const url = new URL(input);
  const path = url.pathname.replace(/^\/api\/v1/, "");
  asked.push(path);
  for (const [pattern, handler] of ROUTES) {
    const match = pattern.exec(path);
    if (match) return handler(new Request(url), match[1] ?? "");
  }
  return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
}

const data = () => new GameData("https://mlbbdex.com", siteFetch);
const https = /^https:\/\//;

describe("the bot's reading of the public API", () => {
  it("reads the hero list, a hero, the items in every language, the patches and the rankings", async () => {
    const d = data();
    const heroes = await d.heroes();
    expect(heroes.length).toBeGreaterThan(100);
    const hero = await d.hero(heroes[0].slug);
    expect(hero?.slug).toBe(heroes[0].slug);
    const en = await d.items("en");
    const fr = await d.items("fr");
    expect(en.length).toBe(fr.length);
    // `?locale=` is honoured: at least one item reads differently in French.
    expect(fr.some((item, i) => item.name !== en[i].name || item.passive !== en[i].passive)).toBe(true);
    expect((await d.patches()).length).toBeGreaterThan(0);
    expect((await d.rankings()).heroes.length).toBeGreaterThan(0);
  });

  it("reads a hero's counters and builds, and a detailed patch", async () => {
    const d = data();
    const slug = Object.keys(counters)[0];
    expect(await d.counters(slug)).not.toBeNull();
    expect(await d.builds(slug)).not.toBeNull();
    expect((await d.patch(patches[0].version, "fr"))?.version).toBe(patches[0].version);
  });

  it("reads the newest skins, with absolute https artwork", async () => {
    const skins = await data().newestSkins();
    expect(skins).not.toBeNull();
    expect(skins!.length).toBe(10);
    expect(skins!.every((s) => s.hero && s.id && s.name && s.release)).toBe(true);
    const dates = skins!.map((s) => s.release!);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(skins!.filter((s) => s.image).every((s) => https.test(s.image!))).toBe(true);
  });

  it("reads the current and upcoming events, dated and linked", async () => {
    const events = await data().events("fr");
    expect(events).not.toBeNull();
    for (const e of events!) {
      expect(Number.isNaN(Date.parse(e.start!))).toBe(false);
      expect(Date.parse(e.end!)).toBeGreaterThan(Date.parse(e.start!));
      expect(e.link).toMatch(/^https:\/\/.+\/fr\/events\/\d{4}-\d{2}$/);
      if (e.image) expect(e.image).toMatch(https);
    }
  });

  it("reads the emblems and the spells under the slugs of the bot's catalog", async () => {
    const { EMBLEMS, SPELLS } = await import("../../bot/src/catalog");
    const d = data();
    const emblems = await d.emblems("fr");
    const spells = await d.spells("fr");
    expect(emblems).not.toBeNull();
    expect(spells).not.toBeNull();
    const emblemSlugs = new Set(emblems!.map((e) => e.slug));
    const spellSlugs = new Set(spells!.map((s) => s.slug));
    for (const e of EMBLEMS) expect(emblemSlugs.has(e.slug), e.slug).toBe(true);
    for (const s of SPELLS) expect(spellSlugs.has(s.slug), s.slug).toBe(true);
    expect(emblems!.every((e) => e.description)).toBe(true);
    const flicker = spells!.find((s) => s.slug === "flicker")!;
    expect(flicker.cooldown).toBe(120);
    expect(flicker.description).toBeTruthy();
  });

  it("asks only for routes the site serves", async () => {
    asked.length = 0;
    const d = data();
    await d.warm();
    await Promise.all([d.newestSkins(), d.events("en"), d.emblems("en"), d.spells("en")]);
    expect(asked.length).toBeGreaterThan(0);
    for (const path of asked) expect(ROUTES.some(([p]) => p.test(path)), path).toBe(true);
  });
});
