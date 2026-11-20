import { describe, expect, it } from "vitest";
import { GET as skinsGET } from "@/app/api/v1/skins/route";
import { GET as eventsGET } from "@/app/api/v1/events/route";
import { GET as emblemsGET } from "@/app/api/v1/emblems/route";
import { GET as spellsGET } from "@/app/api/v1/spells/route";
import { GET as itemsGET } from "@/app/api/v1/items/route";
import { itemsFor } from "@/lib/data";
import { eventMonths, referenceDate } from "@/lib/events-server";
import { releasedSkins } from "@/lib/skin-catalog-server";

const read = async <T>(response: Response) => {
  expect(response.status).toBe(200);
  return (await response.json()) as { data: T; total?: number };
};

describe("list API routes read by the Discord bot", () => {
  it("serves the newest released skins, capped by ?limit=", async () => {
    type Skin = { hero: string; id: string; name: string; release: string; rarity: string; image: string | null };
    const ten = await read<Skin[]>(skinsGET(new Request("http://x/api/v1/skins?limit=10")));
    expect(ten.data).toHaveLength(10);
    expect(ten.total).toBe(10);
    const released = new Set(releasedSkins().map((s) => `${s.hero}|${s.id}`));
    expect(ten.data.every((s) => released.has(`${s.hero}|${s.id}`))).toBe(true);
    expect(ten.data.every((s) => s.rarity !== "origin")).toBe(true);
    expect(ten.data.every((s) => s.release <= referenceDate.slice(0, s.release.length))).toBe(true);
    expect(ten.data[0].image).toMatch(/^https:\/\/.+\.webp$/);
    // Default, cap and nonsense.
    expect((await read<Skin[]>(skinsGET(new Request("http://x/api/v1/skins")))).data).toHaveLength(20);
    expect((await read<Skin[]>(skinsGET(new Request("http://x/api/v1/skins?limit=5000")))).data).toHaveLength(100);
    expect((await read<Skin[]>(skinsGET(new Request("http://x/api/v1/skins?limit=abc")))).data).toHaveLength(20);
  });

  it("serves this month's and the announced months' StarLight and Collector skins, in the asked language", async () => {
    type Event = { name: string; kind: string; start: string; end: string; image: string | null; link: string };
    const current = referenceDate.slice(0, 7);
    const months = eventMonths().filter((m) => m.month >= current);
    const expected = months.reduce((n, m) => n + m.starlight.length + m.collector.length, 0);
    const fr = await read<Event[]>(eventsGET(new Request("http://x/api/v1/events?locale=fr")));
    expect(fr.data).toHaveLength(expected);
    for (const e of fr.data) {
      expect(e.start.slice(0, 7) >= current).toBe(true);
      expect(e.end.slice(0, 7)).toBe(e.start.slice(0, 7));
      expect(e.end.endsWith("T23:59:59.999Z")).toBe(true);
      expect(e.link).toMatch(/\/fr\/events\/\d{4}-\d{2}$/);
      expect(e.name).toMatch(e.kind === "starlight" ? /^Skin StarLight : / : /^Skin Collector : /);
    }
    const en = await read<Event[]>(eventsGET(new Request("http://x/api/v1/events?locale=zz")));
    expect(en.data.every((e) => /^(StarLight|Collector) skin: /.test(e.name))).toBe(true);
  });

  it("serves the six emblems under their page slugs, translated", async () => {
    type Entry = { slug: string; name: string; description: string; image: string | null };
    const fr = await read<Entry[]>(emblemsGET(new Request("http://x/api/v1/emblems?locale=fr")));
    const en = await read<Entry[]>(emblemsGET(new Request("http://x/api/v1/emblems")));
    expect(fr.data.map((e) => e.slug)).toEqual(["tank", "fighter", "assassin", "mage", "marksman", "support"]);
    expect(fr.data[0].name).toBe("Emblème de tank");
    expect(en.data[0].name).toBe("Tank Emblem");
    expect(en.data.every((e) => e.description && e.image?.startsWith("https://"))).toBe(true);
  });

  it("serves the battle spells with their cooldown, translated", async () => {
    type Entry = { slug: string; name: string; description: string | null; cooldown: number | null };
    const en = await read<Entry[]>(spellsGET(new Request("http://x/api/v1/spells?locale=en")));
    const flicker = en.data.find((s) => s.slug === "flicker");
    expect(flicker).toMatchObject({ name: "Flicker", cooldown: 120, description: "Teleports the hero a short distance." });
    const fr = await read<Entry[]>(spellsGET(new Request("http://x/api/v1/spells?locale=fr")));
    expect(fr.data.find((s) => s.slug === "flicker")?.description).toBe("Téléporte le héros sur une courte distance.");
  });

  it("serves the items in the asked language, the category filter still applying", async () => {
    type Item = { slug: string; name: string; category: string };
    const fr = await read<Item[]>(itemsGET(new Request("http://x/api/v1/items?locale=fr")));
    expect(fr.data).toEqual(JSON.parse(JSON.stringify(itemsFor("fr"))));
    const en = await read<Item[]>(itemsGET(new Request("http://x/api/v1/items?locale=nope")));
    expect(en.data).toEqual(JSON.parse(JSON.stringify(itemsFor("en"))));
    const category = fr.data[0].category;
    const filtered = await read<Item[]>(itemsGET(new Request(`http://x/api/v1/items?locale=fr&category=${category.toUpperCase()}`)));
    expect(filtered.data.length).toBeGreaterThan(0);
    expect(filtered.data.every((o) => o.category === category)).toBe(true);
  });
});
