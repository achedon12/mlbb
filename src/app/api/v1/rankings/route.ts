import { classementComplet, mesureLe } from "@/lib/tier-list";
import { reponseApi } from "@/lib/api";

/**
 * Classement calcule.
 *
 * La date du releve accompagne les taux : sa source peut etre indisponible
 * quand le reste du site se met a jour, et un chiffre sans date laisserait
 * croire qu'il est frais.
 */
export const dynamic = "force-static";

export function GET() {
  return reponseApi(
    {
      measuredAt: mesureLe,
      heroes: classementComplet.map((e) => ({
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
    { total: classementComplet.length },
  );
}
