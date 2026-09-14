import generatedHeroes from "@/data/game/heroes.json";
import visuals from "@/data/game/visuals.json";
import { emblems } from "@/data/emblems";
import { EMBLEM_SETS, TALENT_FIGURES } from "@/data/emblem-attributes";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { CodeCatalog } from "./build-code";
import {
  namesFrom,
  prepareEmblem,
  prepareHero,
  prepareItem,
  prepareTalent,
  type BuildNames,
  type MeasuredCore,
  type SimCatalog,
  type SimulatorData,
} from "./build-simulator";
import { buildsPlayed, allHeroes, itemsFor } from "./data";
import { imageTalent, nameTalent, spellSheets, textChoice } from "./usage-sheets";
import { MEASURED_RANKS } from "./measured-ranks";
import type { GeneratedHero } from "./types";
import { visualItem } from "./build-visuals";

/**
 * Simulator catalog, prepared once on the server: the page hands it to the
 * browser, the community build routes validate every slug against it, and
 * their pages compute stats with it.
 *
 * Offered items: the ones that can be bought. Floryn's items have no price
 * (the hero gives them away) and potions are two-minute consumables - their
 * text says so ("one potion effect at a time").
 */

const V = visuals as unknown as Record<"items" | "emblems", Record<string, string>>;

const isPurchasable = (o: { price: number | null; passive: string | null }) =>
  o.price !== null && !/one potion effect/i.test(o.passive ?? "");

const englishItems = itemsFor("en").filter(isPurchasable);

export const simCatalog: SimCatalog = {
  heroes: new Map((generatedHeroes as unknown as GeneratedHero[]).map((h) => [h.slug, prepareHero(h)])),
  items: new Map(englishItems.map((o) => [o.slug, prepareItem(o)])),
  emblems: new Map(EMBLEM_SETS.map((e) => [e.key, prepareEmblem(e.key, e.attributes)])),
  talents: new Map(TALENT_FIGURES.map((t) => [t.key, prepareTalent(t)])),
};

const tier = (n: 0 | 1 | 2) => new Set(TALENT_FIGURES.filter((t) => t.tier === n).map((t) => t.key));

export const codeCatalog: CodeCatalog = {
  heroes: new Set(simCatalog.heroes.keys()),
  items: new Set(simCatalog.items.keys()),
  emblems: new Set(simCatalog.emblems.keys()),
  tiers: [tier(0), tier(1), tier(2)],
  spells: new Set(spellSheets.map((s) => s.slug)),
};

// -- Names and images, per language -----------------------------------------

/** "tank" to its record in `src/data/emblems.ts`, which carries the image and the translated name. */
const emblemRecord = (key: string) => emblems.find((e) => e.key === `${key}-emblem`);

export function emblemName(t: T, key: string): string {
  const record = emblemRecord(key);
  return record ? textChoice(t, record.key, "name", record.name)! : t("pages.buildSimulator.commonEmblem");
}

export function emblemImage(key: string): string | null {
  const record = emblemRecord(key);
  return record ? (V.emblems[record.key] ?? null) : null;
}

export function spellName(t: T, key: string): string {
  const s = spellSheets.find((x) => x.slug === key);
  return textChoice(t, key, "name", s?.name ?? key)!;
}

export const spellImage = (key: string): string | null => spellSheets.find((x) => x.slug === key)?.image ?? null;
export const itemImage = (slug: string): string | null => V.items[slug] ?? null;
export const talentName = nameTalent;
export const talentImage = imageTalent;

export function simulatorData(locale: Locale, t: T): SimulatorData {
  const translated = new Map(itemsFor(locale).map((o) => [o.slug, o]));
  return {
    heroes: allHeroes
      .filter((h) => simCatalog.heroes.has(h.slug))
      .map((h) => ({
        slug: h.slug,
        name: h.name,
        lanes: h.lanes,
        roles: h.roles,
        icon: h.images.icon,
        sim: simCatalog.heroes.get(h.slug)!,
      })),
    items: [...simCatalog.items.values()].map((o) => {
      const tr = translated.get(o.slug);
      const text = [tr?.bonus, tr?.unique].filter((x) => x && x !== "None").join(", ");
      return { ...o, name: tr?.name ?? o.name, image: itemImage(o.slug), text: text || null };
    }),
    categories: [...new Set(englishItems.map((o) => o.category))],
    emblems: [...simCatalog.emblems.values()].map((e) => ({ ...e, name: emblemName(t, e.key), image: emblemImage(e.key) })),
    talents: [...simCatalog.talents.values()].map((tl) => ({ ...tl, name: nameTalent(t, tl.key), image: imageTalent(tl.key) })),
    spells: spellSheets.map((s) => ({ key: s.slug, name: spellName(t, s.slug), image: s.image })),
  };
}

/** Display names of the whole catalog, for pages that show builds without the simulator. */
export function buildNames(locale: Locale, t: T): BuildNames {
  const translated = new Map(itemsFor(locale).map((o) => [o.slug, o.name]));
  return namesFrom({
    items: [...simCatalog.items.values()].map((o) => ({ slug: o.slug, name: translated.get(o.slug) ?? o.name })),
    emblems: [...simCatalog.emblems.keys()].map((key) => ({ key, name: emblemName(t, key) })),
    talents: [...simCatalog.talents.keys()].map((key) => ({ key, name: nameTalent(t, key) })),
  });
}

// -- Measured builds --------------------------------------------------------

/**
 * Cores actually played by a hero, every lane and rank, items as slugs. An
 * item name the catalog does not know is dropped: the core stays comparable
 * on what is left of it.
 */
export function measuredCores(slug: string): MeasuredCore[] {
  const byLane = buildsPlayed[slug] ?? {};
  return Object.entries(byLane).flatMap(([lane, byRank]) =>
    MEASURED_RANKS.flatMap((rank) =>
      (byRank[rank] ?? []).map((b) => ({
        lane,
        rank,
        items: b.items.flatMap((name) => visualItem(name).slug ?? []),
        winRate: b.winRate,
        pickRate: b.pickRate,
      })),
    ),
  );
}
