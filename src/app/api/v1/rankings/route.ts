import { rankingFull, measure } from "@/lib/tier-list";
import { responseApi } from "@/lib/api";

/**
 * Computed ranking.
 *
 * The measurement date comes with the rates: its source can be unavailable
 * while the rest of the site updates, and a figure without a date would
 * suggest it is fresh.
 */
export const dynamic = "force-static";

export function GET() {
  return responseApi(
    {
      measuredAt: measure,
      heroes: rankingFull.map((e) => ({
        slug: e.hero.slug,
        name: e.hero.name,
        tier: e.tier,
        winRate: e.winRate,
        banRate: e.banRate,
        pickRate: e.pickRate,
        score: e.score,
        lowSample: e.lowSample,
      })),
    },
    { total: rankingFull.length },
  );
}
