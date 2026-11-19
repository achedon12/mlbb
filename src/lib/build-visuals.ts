import visuals from "@/data/game/visuals.json";
import { emblems, slugEmblem, battleSpells } from "@/data/emblems";
import type {
  PackedBuilds,
  ResolvedBuild,
  ResolvedGuide,
  ResolvedItem,
  ResolvedVisual,
} from "@/components/builds-by-rank";
import { itemsFor, type BuildPlayed, type GuidePlayer } from "./data";
import type { MeasuredRank } from "./measured-ranks";
import { itemFinder } from "./item-names";
import { keySearch, mapValues } from "./utils";
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
  if (e) return { name, image: V.emblems[e.key] ?? null, href: `/emblems/${slugEmblem(e)}` };
  return { name, image: name === COMMON_EMBLEM ? (V.emblems["common-emblem"] ?? null) : null };
}

const findItem = itemFinder(itemsFor("en"));

export function visualItem(name: string): ResolvedItem {
  // Boots carrying an enchantment or a blessing ("Swift Boots - Encourage",
  // "Ice Hunter's Tough Boots") show the boots' visual; an old name
  // ("Athena's Shield") the renamed item's. See item-names.ts.
  const o = findItem(name);
  return { name, slug: o?.slug ?? null, image: o ? (V.items[o.slug] ?? null) : null };
}

/**
 * The common emblem: the stats API calls it "All", the emblem every role
 * can take. It has no page of its own.
 */
export const COMMON_EMBLEM = "All";

export function resolveBuild(b: BuildPlayed): ResolvedBuild {
  return {
    items: b.items.map(visualItem),
    emblem: b.emblem ? visualEmblem(b.emblem) : null,
    talents: b.talents.map(visualTalent),
    spell: b.spell ? spellVisual(b.spell) : null,
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
    spell: g.spell ? spellVisual(g.spell) : null,
    author: rank ? { key: rank.key, division: rank.division } : null,
    votes: g.votes,
  };
}

/**
 * Builds as sent to the hero page's `BuildsByRank`: each visual once, in
 * `visuals`, and the builds pointing to it by index. A hero's builds for six
 * ranks and up to two lanes repeat the same dozen items, emblems and
 * talents, each with its name and image path: written out in full, they were
 * the largest prop of the page (some 40 KB of its RSC payload).
 */
export function packBuilds(
  byLane: Partial<Record<string, Partial<Record<MeasuredRank, ResolvedBuild[]>>>>,
  guides: Partial<Record<string, Partial<Record<MeasuredRank, ResolvedGuide>>>>,
): PackedBuilds {
  const visuals: PackedBuilds["visuals"] = [];
  const index = new Map<string, number>();
  const ref = (v: ResolvedVisual | ResolvedItem): number => {
    const k = JSON.stringify(v);
    let i = index.get(k);
    if (i === undefined) {
      i = visuals.push(v) - 1;
      index.set(k, i);
    }
    return i;
  };
  const choices = (b: ResolvedBuild | ResolvedGuide) => ({
    items: b.items.map(ref),
    emblem: b.emblem ? ref(b.emblem) : null,
    talents: b.talents.map(ref),
    spell: b.spell ? ref(b.spell) : null,
  });
  return {
    byLane: mapValues(byLane, (byRank) =>
      mapValues(byRank, (list) => list.map((b) => ({ ...choices(b), win: b.win, selection: b.selection }))),
    ),
    guides: mapValues(guides, (byRank) => mapValues(byRank, (g) => ({ ...choices(g), author: g.author, votes: g.votes }))),
    visuals,
  };
}
