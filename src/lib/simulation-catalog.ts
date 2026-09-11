import { herosDraft } from "./catalogue-draft";
import { catalogueEquipe } from "./composition-donnees";
import type { MetaEntry, SimulationHero } from "./draft-simulation";
import type { RangMesure } from "./rangs-mesure";
import { classementDuRang, RANGS_CLASSES } from "./tier-list";

/**
 * Data of the draft simulator, prepared on the server. A rank's measurements
 * (counters, teammates, win rates) come separately, through the same file as
 * the team analyzer (`/composition/<rank>.json`).
 */

const EMPTY_NOTES = { offensive: null, resistance: null, effets: null, difficulte: null };

/**
 * The draft record, completed with the damage type and game ratings the team
 * analyzer reads: one roster serves the assistant, the simulator and its
 * summary.
 */
export function simulationHeroes(): SimulationHero[] {
  const team = new Map(catalogueEquipe().map((h) => [h.slug, h]));
  return herosDraft().map((h) => ({
    ...h,
    degats: team.get(h.slug)?.degats ?? null,
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
export function metaByRank(): Partial<Record<RangMesure, MetaEntry[]>> {
  return Object.fromEntries(
    RANGS_CLASSES.map((rank) => [
      rank,
      classementDuRang(rank)
        .filter((e) => !e.faibleEchantillon)
        .slice(0, META_SIZE)
        .map((e) => ({ slug: e.heros.slug, tier: e.palier, banRate: e.ban, winRate: e.victoire })),
    ]),
  );
}
