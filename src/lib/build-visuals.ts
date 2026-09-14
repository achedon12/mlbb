import visuals from "@/data/game/visuals.json";
import { emblems, slugEmblem, battleSpells } from "@/data/emblems";
import type { ResolvedBuild, ResolvedGuide, ResolvedItem, ResolvedVisual } from "@/components/builds-by-rank";
import { itemsFor, type BuildPlayed, type GuidePlayer } from "./data";
import { keySearch } from "./utils";
import { readableRank } from "./ranks";

/**
 * Visuels des choix d'un build : objets, embleme, talents et sort.
 *
 * Les images sont rangees sous le nom anglais du jeu, passe en slug.
 */
const V = visuals as unknown as Record<"items" | "emblems" | "talents" | "spells", Record<string, string>>;

const key = (name: string) =>
  keySearch(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Graphies divergentes d'un meme talent. Les builds rediges emploient les noms
 * anglais du jeu, comme l'API : pas de traduction a tenir.
 */
const ALIAS: Record<string, string> = {
  // L'API ecrit « Weapons Master », le wiki « Weapon Master ».
  "weapons-master": "weapon-master",
  execution: "execute",
  inspiration: "inspire",
};

/**
 * Cle unique d'un talent ou d'un sort, graphies divergentes rapprochees : celle
 * des textes (`emblemData`) et des pages de sorts.
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
 * Un sort mene a sa page quand elle existe : sorts decrits a la main et sorts
 * que les builds joues citent avec un visuel (voir `sortsFiches`, src/lib/usage-sheets.ts).
 */
export function spellVisual(name: string): ResolvedVisual {
  const visual = resolve(V.spells, name);
  const k = keyChoice(name);
  return battleSpells.some((s) => s.key === k) || V.spells[k] ? { ...visual, href: `/spells/${k}` } : visual;
}

/** L'API nomme l'embleme par son role (« Marksman »), les builds rediges en toutes lettres. */
export function visualEmblem(name: string): ResolvedVisual {
  const e = emblems.find((x) => x.name === name || x.role === name);
  return e ? { name, image: V.emblems[e.key] ?? null, href: `/emblems/${slugEmblem(e)}` } : { name, image: null };
}

const ITEMS_BY_NAME = new Map(itemsFor("en").map((o) => [o.name, o]));

export function visualItem(name: string): ResolvedItem {
  // Les bottes portent parfois leur enchantement (« Swift Boots - Encourage ») :
  // le visuel est celui des bottes.
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
