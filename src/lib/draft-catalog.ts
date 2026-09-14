import statistics from "@/data/game/statistics.json";
import { teammates, allHeroes } from "./data";
import type { DraftHero } from "./draft";
import { rankingFull } from "./tier-list";

/**
 * Reduced profile of each hero, for the draft helper and team analysis.
 * Read server-side only: it pulls the wiki relations and the ranking, which
 * the browser does not need to load.
 */
interface Relation {
  strongAgainst: string[];
  weakAgainst: string[];
  synergies: string[];
}

const relations = statistics.relations as unknown as Record<string, Relation>;

/**
 * Only what the tools use is sent to the client: a hero's full profile carries
 * skills and skins that play no part in the computation and weigh a lot
 * multiplied by 133.
 */
export function draftHeroes(): DraftHero[] {
  const rate = new Map(rankingFull.map((e) => [e.hero.slug, e.winRate]));
  return allHeroes.map((h) => ({
    slug: h.slug,
    name: h.name,
    lanes: h.lanes,
    roles: h.roles,
    icon: h.images.icon ?? h.images.portrait,
    win: rate.get(h.slug) ?? null,
    strongAgainst: relations[h.slug]?.strongAgainst ?? [],
    weakAgainst: relations[h.slug]?.weakAgainst ?? [],
    // Synergies written by the wiki, completed with the teammates who raise
    // the hero's win rate the most in ranked matches.
    synergies: [
      ...new Set([...(relations[h.slug]?.synergies ?? []), ...(teammates[h.slug]?.all ?? []).map((c) => c.slug)]),
    ],
  }));
}
