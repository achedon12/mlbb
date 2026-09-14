import { draftHeroes } from "./draft-catalog";
import { catalogTeam } from "./composition-data";
import type { MetaEntry, SimulationHero } from "./draft-simulation";
import type { MeasuredRank } from "./measured-ranks";
import { rankingOfRank, RANKS_CLASSES } from "./tier-list";

/**
 * Data of the draft simulator, prepared on the server. A rank's measurements
 * (counters, teammates, win rates) come separately, through the same file as
 * the team analyzer (`/composition/<rank>.json`).
 */

const EMPTY_NOTES = { offense: null, durability: null, abilityEffects: null, difficulty: null };

/**
 * The draft record, completed with the damage type and game ratings the team
 * analyzer reads: one roster serves the assistant, the simulator and its
 * summary.
 */
export function simulationHeroes(): SimulationHero[] {
  const team = new Map(catalogTeam().map((h) => [h.slug, h]));
  return draftHeroes().map((h) => ({
    ...h,
    damage: team.get(h.slug)?.damage ?? null,
    notes: team.get(h.slug)?.notes ?? EMPTY_NOTES,
  }));
}

/**
 * Heroes kept from the top of each rank's tier list: enough for ten bans and
 * their replacements, without sending six full rankings.
 */
export const META_SIZE = 30;

/**
 * Top of each rank's tier list, for the bot's bans. The ranking combines win
 * rate and ban rate; heroes played too little, with unstable rates, are left
 * out.
 */
export function metaByRank(): Partial<Record<MeasuredRank, MetaEntry[]>> {
  return Object.fromEntries(
    RANKS_CLASSES.map((rank) => [
      rank,
      rankingOfRank(rank)
        .filter((e) => !e.lowSample)
        .slice(0, META_SIZE)
        .map((e) => ({ slug: e.hero.slug, tier: e.tier, banRate: e.banRate, winRate: e.winRate })),
    ]),
  );
}
