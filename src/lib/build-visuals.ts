import visuals from "@/data/game/visuals.json";
import { emblems, slugEmblem, battleSpells } from "@/data/emblems";
import type { ResolvedBuild, ResolvedGuide, ResolvedItem, ResolvedVisual } from "@/components/builds-by-rank";
import { itemsFor, type BuildPlayed, type GuidePlayer } from "./data";
import { keySearch } from "./utils";
import { readableRank } from "./ranks";

/**
 * Visuals of a build's choices: items, emblem, talents and spell.
 *
 * Images are stored under the game's English name, slugified.
 */
const V = visuals as unknown as Record<"items" | "emblems" | "talents" | "spells", Record<string, string>>;

const key = (name: string) =>
  keySearch(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Diverging spellings of the same talent. Written builds use the game's
 * English names, like the API: no translation to maintain.
 */
const ALIAS: Record<string, string> = {
  // The API writes "Weapons Master", the wiki "Weapon Master".
  "weapons-master": "weapon-master",
  execution: "execute",
  inspiration: "inspire",
};

/**
 * Unique key of a talent or spell, with diverging spellings merged: the one
 * used by the texts (`emblemData`) and the spell pages.
 */
export function keyChoice(name: string): string {
  const k = key(name);
  return ALIAS[k] ?? k;
}

function resolve(table: Record<string, string>, name: string): ResolvedVisual {
  const k = key(name);
  return { name, image: table[k] ?? table[ALIAS[k]] ?? null };
}

export const visualTalent = (name: string) => resolve(V.talents, name);
/**
 * A spell links to its page when one exists: hand-written spells and spells
 * that played builds name with a visual (see `spellSheets`, src/lib/usage-sheets.ts).
 */
export function spellVisual(name: string): ResolvedVisual {
  const visual = resolve(V.spells, name);
  const k = keyChoice(name);
  return battleSpells.some((s) => s.key === k) || V.spells[k] ? { ...visual, href: `/spells/${k}` } : visual;
}

/** The API names the emblem by its role ("Marksman"), written builds by its full name. */
export function visualEmblem(name: string): ResolvedVisual {
  const e = emblems.find((x) => x.name === name || x.role === name);
  return e ? { name, image: V.emblems[e.key] ?? null, href: `/emblems/${slugEmblem(e)}` } : { name, image: null };
}

const ITEMS_BY_NAME = new Map(itemsFor("en").map((o) => [o.name, o]));

export function visualItem(name: string): ResolvedItem {
  // Boots sometimes carry their enchantment ("Swift Boots - Encourage"):
  // the visual is the boots' one.
  const o = ITEMS_BY_NAME.get(name) ?? ITEMS_BY_NAME.get(name.split(" - ")[0]);
  return { name, slug: o?.slug ?? null, image: o ? (V.items[o.slug] ?? null) : null };
}

export function resolveBuild(b: BuildPlayed): ResolvedBuild {
  return {
    items: b.items.map(visualItem),
    emblem: b.emblem ? visualEmblem(b.emblem) : null,
    talents: b.talents.map(visualTalent),
    sort: b.spell ? spellVisual(b.spell) : null,
    win: b.winRate,
    selection: b.pickRate,
  };
}

export function resolveGuide(g: GuidePlayer): ResolvedGuide {
  const rank = g.authorRank > 0 ? readableRank(g.authorRank) : null;
  return {
    items: g.items.map(visualItem),
    emblem: g.emblem ? visualEmblem(g.emblem) : null,
    talents: g.talents.map(visualTalent),
    sort: g.spell ? spellVisual(g.spell) : null,
    author: rank ? { key: rank.key, division: rank.division } : null,
    votes: g.votes,
  };
}
